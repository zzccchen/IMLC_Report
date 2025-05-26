function displayMLCReport(parsedData, reportContainer, charts) {
    reportContainer.innerHTML = ''; // Clear previous report
    let chartsLocal = destroyCharts(charts); // Destroy old charts and get a new charts object

    if (parsedData.toolVersion) {
        const versionEl = document.createElement('p');
        versionEl.innerHTML = `<strong>工具版本:</strong> Intel(R) Memory Latency Checker - ${parsedData.toolVersion}`;
        versionEl.style.textAlign = 'center';
        versionEl.style.marginBottom = '20px';
        reportContainer.appendChild(versionEl);
    }

    // 1. Idle Latencies (Heatmap Table)
    if (parsedData.idleLatencies && parsedData.idleLatencies.matrix.length > 0 && parsedData.idleLatencies.nodes.length > 0) {
        const section = createSection(reportContainer, "1. 空闲状态下随机访问延迟 (ns) - 热力图");
        const tableContainer = document.createElement('div');
        tableContainer.className = 'chart-container';
        const table = createHeatmapTable(parsedData.idleLatencies.nodes, parsedData.idleLatencies.matrix, "源NUMA节点", "目标NUMA节点", true);
        tableContainer.appendChild(table);
        section.appendChild(tableContainer);

        let localLatencies = [];
        let remoteLatencies = [];
        parsedData.idleLatencies.matrix.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
                if (isNaN(val)) return;
                if (parsedData.idleLatencies.nodes[rIdx] === parsedData.idleLatencies.nodes[cIdx]) localLatencies.push(val);
                else remoteLatencies.push(val);
            });
        });
        const avgLocal = localLatencies.length > 0 ? localLatencies.reduce((a, b) => a + b, 0) / localLatencies.length : 0;
        const avgRemote = remoteLatencies.length > 0 ? remoteLatencies.reduce((a, b) => a + b, 0) / remoteLatencies.length : 0;
        const interpretation = createInterpretation(`
            平均本地NUMA节点访问延迟: <strong>${avgLocal.toFixed(1)} ns</strong><br>
            平均远程NUMA节点访问延迟: <strong>${avgRemote.toFixed(1)} ns</strong><br>
        `);
        section.appendChild(interpretation);
    } else if (parsedData.idleLatencies) {
        console.warn("Idle latencies data present but matrix or nodes are empty, skipping section.", parsedData.idleLatencies);
    }

    // 2. Peak Injection Memory Bandwidths (Bar Chart)
    if (parsedData.peakBandwidths && parsedData.peakBandwidths.length > 0) {
        const section = createSection(reportContainer, "2. 系统峰值注入内存带宽 (GB/s)");
        const canvasId = "peakBandwidthChart";
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'chart-container';
        canvasContainer.style.height = '400px';
        const canvas = createCanvas(canvasContainer, canvasId);
        section.appendChild(canvasContainer);

        chartsLocal[canvasId] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: parsedData.peakBandwidths.map(item => item.label),
                datasets: [{
                    label: '带宽 (GB/s)',
                    data: parsedData.peakBandwidths.map(item => item.value / 1024),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: function(value) {
                            return value.toFixed(1) + ' GB/s';
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 0,
                        title: {
                            display: true,
                            text: 'GB/s'
                        }
                    }
                }
            }
        });
        let allReadsBw = parsedData.peakBandwidths.find(b => b.label.toLowerCase().includes("all reads") || b.label.toLowerCase().includes("read only"));
        let streamTriadBw = parsedData.peakBandwidths.find(b => b.label.toLowerCase().includes("stream-triad") || b.label.toLowerCase().includes("stream triad"));
        let interpText = `不同读写比率下的峰值内存带宽。`;
        if (allReadsBw) interpText += ` 全读带宽约为 <strong>${(allReadsBw.value / 1024).toFixed(1)} GB/s</strong>`;
        if (streamTriadBw) interpText += `<br>Stream-Triad 带宽 (一种更接近实际应用的指标) 约为 <strong>${(streamTriadBw.value / 1024).toFixed(1)} GB/s</strong>`;

        let increasingWithWrites = false;
        let prevWriteRatioValue = -1;
        let readHeavyValue = -1;
        parsedData.peakBandwidths.forEach(item => {
            const labelLower = item.label.toLowerCase();
            if (labelLower.includes("reads-writes") || labelLower.match(/\d+:\d+/)) { // e.g. 3:1 Reads-Writes or 1:1 R:W
                if (readHeavyValue === -1 && (labelLower.startsWith("3:1") || labelLower.startsWith("2:1"))) readHeavyValue = item.value;
                if (prevWriteRatioValue !== -1 && item.value > prevWriteRatioValue && (labelLower.startsWith("1:1") || labelLower.startsWith("1:3"))) {
                    if (readHeavyValue !== -1 && item.value > readHeavyValue * 1.05) {
                        increasingWithWrites = true;
                    }
                }
                if (labelLower.startsWith("1:1")) prevWriteRatioValue = item.value;
                else if (prevWriteRatioValue === -1) prevWriteRatioValue = item.value;
            } else if (labelLower.includes("all reads") || labelLower.includes("read only")) {
                if (readHeavyValue === -1) readHeavyValue = item.value;
            }
        });
        if (increasingWithWrites) {
            interpText += "<br><strong>注意:</strong> 观察到带宽随着写操作比例的增加而增加的趋势，这可能表明写操作被更有效地处理，或者特定的缓存/内存控制器行为";
        } else {
            interpText += "<br>通常，随着写操作比例的增加，由于写操作的复杂性，带宽会有所下降";
        }
        section.appendChild(createInterpretation(interpText));
    }

    // 3. Memory Bandwidths between nodes (Heatmap Table)
    if (parsedData.interNodeBandwidths && parsedData.interNodeBandwidths.matrix.length > 0 && parsedData.interNodeBandwidths.nodes.length > 0) {
        const section = createSection(reportContainer, "3. 系统内节点间内存带宽 (GB/s, 只读) - 热力图");
        const tableContainer = document.createElement('div');
        tableContainer.className = 'chart-container';
        const table = createHeatmapTable(parsedData.interNodeBandwidths.nodes, parsedData.interNodeBandwidths.matrix, "源NUMA节点", "目标NUMA节点", false);
        tableContainer.appendChild(table);
        section.appendChild(tableContainer);

        let localBw = [];
        let remoteBw = [];
        parsedData.interNodeBandwidths.matrix.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
                if (isNaN(val)) return;
                if (parsedData.interNodeBandwidths.nodes[rIdx] === parsedData.interNodeBandwidths.nodes[cIdx]) localBw.push(val);
                else remoteBw.push(val);
            });
        });
        const avgLocalBw = localBw.length > 0 ? localBw.reduce((a, b) => a + b, 0) / localBw.length : 0;
        const avgRemoteBw = remoteBw.length > 0 ? remoteBw.reduce((a, b) => a + b, 0) / remoteBw.length : 0;

        section.appendChild(createInterpretation(`
            每个NUMA节点访问其本地内存的平均带宽约为 <strong>${(avgLocalBw / 1024).toFixed(1)} GB/s</strong><br>
            跨NUMA节点访问远程内存的平均带宽约为 <strong>${(avgRemoteBw / 1024).toFixed(1)} GB/s</strong><br>
        `));
    } else if (parsedData.interNodeBandwidths) {
        console.warn("Inter-node bandwidth data present but matrix or nodes are empty, skipping section.", parsedData.interNodeBandwidths);
    }

    // 4. Loaded Latencies (Line Chart)
    if (parsedData.loadedLatencies && parsedData.loadedLatencies.length > 0) {
        const section = createSection(reportContainer, "4. 系统负载状态下延迟与带宽 (只读)");
        const canvasId = "loadedLatencyChart";
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'chart-container';
        canvasContainer.style.height = '400px';
        const canvas = createCanvas(canvasContainer, canvasId);
        section.appendChild(canvasContainer);

        chartsLocal[canvasId] = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: parsedData.loadedLatencies.map(item => item.delay),
                datasets: [{
                    label: '延迟 (ns)',
                    data: parsedData.loadedLatencies.map(item => item.latency),
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    yAxisID: 'y'
                }, {
                    label: '带宽 (GB/s)',
                    data: parsedData.loadedLatencies.map(item => item.bandwidth / 1024),
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 0,
                        title: {
                            display: true,
                            text: '延迟 (ns)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        title: {
                            display: true,
                            text: '带宽 (GB/s)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
        const peakLoad = parsedData.loadedLatencies[0];
        const lowLoad = parsedData.loadedLatencies[parsedData.loadedLatencies.length - 1];
        section.appendChild(createInterpretation(`
            在最高负载时 (注入延迟 ${peakLoad.delay} ns)，延迟为 <strong>${peakLoad.latency.toFixed(1)} ns</strong>，带宽为 <strong>${(peakLoad.bandwidth / 1024).toFixed(1)} GB/s</strong><br>
            在最低负载时 (注入延迟 ${lowLoad.delay} ns)，延迟降至 <strong>${lowLoad.latency.toFixed(1)} ns</strong>，带宽为 <strong>${(lowLoad.bandwidth / 1024).toFixed(1)} GB/s</strong><br>
            通常，要达到峰值带宽，需要容忍更高的延迟。曲线的拐点可以帮助识别系统在负载下的最佳工作点
        `));
    }

    // 5. Cache-to-Cache Transfer Latency (Heatmap Tables)
    if (parsedData.cacheToCache) {
        const section = createSection(reportContainer, "5. 缓存到缓存传输延迟 (ns) - 热力图");
        let c2cText = "";
        if (!isNaN(parsedData.cacheToCache.localHit)) {
            c2cText += `本地插槽 L2->L2 HIT 延迟: <strong>${parsedData.cacheToCache.localHit.toFixed(1)} ns</strong><br>`;
        }
        if (!isNaN(parsedData.cacheToCache.localHitm)) {
            c2cText += `本地插槽 L2->L2 HITM (脏数据) 延迟: <strong>${parsedData.cacheToCache.localHitm.toFixed(1)} ns</strong>`;
        }
        if (c2cText !== "") section.appendChild(createInterpretation(c2cText));

        const processCacheMatrix = (matrixData, title, isWriterHomed) => {
            if (matrixData && matrixData.matrix.length > 0 && matrixData.nodes.length > 0) {
                const subTitle = document.createElement('h3');
                subTitle.textContent = title;
                subTitle.style.fontSize = "1.1em";
                subTitle.style.marginTop = "15px";
                section.appendChild(subTitle);
                const tableContainer = document.createElement('div');
                tableContainer.className = 'chart-container';
                // For HITM matrices, row is Reader, column is Writer (as per MLC output typically)
                const table = createHeatmapTable(matrixData.nodes, matrixData.matrix, "读取者NUMA", "写入者NUMA", true, true);
                tableContainer.appendChild(table);
                section.appendChild(tableContainer);
            } else if (matrixData) {
                console.warn(`${title} data present but matrix or nodes are empty, skipping table.`);
            }
        };

        processCacheMatrix(parsedData.cacheToCache.remoteHitmWriterHomed, "远程插槽 L2->L2 HITM 延迟 (数据地址归属于写入者插槽)", true);
        processCacheMatrix(parsedData.cacheToCache.remoteHitmReaderHomed, "远程插槽 L2->L2 HITM 延迟 (数据地址归属于读取者插槽)", false);

        section.appendChild(createInterpretation(`
            本地插槽内的缓存传输通常最快<br>跨插槽传输（特别是涉及修改过的缓存行 - HITM）延迟会显著增加
        `));
    }

    // Check if any data was actually parsed and displayed
    let noDataParsed = true;
    for (const key in parsedData) {
        if (key === 'toolVersion' && parsedData.toolVersion) { noDataParsed = false; break; }
        if (key === 'numaNodeCount') continue;
        const sectionData = parsedData[key];
        if (sectionData) {
            if (Array.isArray(sectionData) && sectionData.length > 0) { noDataParsed = false; break; }
            if (typeof sectionData === 'object' && sectionData !== null) {
                if ( (sectionData.matrix && sectionData.matrix.length > 0) || 
                     (sectionData.nodes && sectionData.nodes.length > 0) || 
                     (!isNaN(sectionData.localHit)) || (!isNaN(sectionData.localHitm)) ) {
                    noDataParsed = false; break;
                }
            }
        }
    }

    if (noDataParsed && !parsedData.toolVersion) {
        reportContainer.innerHTML = '<p style="color: red; text-align: center;">未能从输入中解析到任何有效数据。请确保粘贴的是完整的MLC输出，并且格式与标准输出一致。</p>';
    }
    return chartsLocal; // Return the updated charts object
}

function displayMLCComparisonReport(parsedData1, parsedData2, reportContainer, charts) {
    reportContainer.innerHTML = ''; // Clear previous report
    let chartsLocal = destroyCharts(charts); // Destroy old charts and get a new charts object

    // 显示工具版本信息
    if (parsedData1.toolVersion || parsedData2.toolVersion) {
        const versionEl = document.createElement('p');
        versionEl.innerHTML = `
            <strong>工具版本对比:</strong><br>
            数据集1: ${parsedData1.toolVersion || '未知'}<br>
            数据集2: ${parsedData2.toolVersion || '未知'}
        `;
        versionEl.style.textAlign = 'center';
        versionEl.style.marginBottom = '20px';
        reportContainer.appendChild(versionEl);
    }

    // 1. Idle Latencies (Heatmap Table)
    if (parsedData1.idleLatencies && parsedData2.idleLatencies) {
        const section = createSection(reportContainer, "1. 空闲状态下随机访问延迟 (ns) - 热力图对比");
        
        // 计算两个数据集的全局最大最小值
        let globalMin = Infinity;
        let globalMax = -Infinity;
        
        // 处理数据集1
        parsedData1.idleLatencies.matrix.forEach(row => {
            row.forEach(val => {
                if (!isNaN(val)) {
                    globalMin = Math.min(globalMin, val);
                    globalMax = Math.max(globalMax, val);
                }
            });
        });
        
        // 处理数据集2
        parsedData2.idleLatencies.matrix.forEach(row => {
            row.forEach(val => {
                if (!isNaN(val)) {
                    globalMin = Math.min(globalMin, val);
                    globalMax = Math.max(globalMax, val);
                }
            });
        });
        
        // 创建两个热力图的容器
        const tablesContainer = document.createElement('div');
        tablesContainer.style.display = 'flex';
        tablesContainer.style.gap = '20px';
        tablesContainer.style.marginBottom = '20px';
        
        // 数据集1的热力图
        const tableContainer1 = document.createElement('div');
        tableContainer1.className = 'chart-container';
        tableContainer1.style.flex = '1';
        const table1 = createHeatmapTable(
            parsedData1.idleLatencies.nodes,
            parsedData1.idleLatencies.matrix,
            "源NUMA节点",
            "目标NUMA节点",
            true,
            "数据集1",
            globalMin,
            globalMax
        );
        tableContainer1.appendChild(table1);
        tablesContainer.appendChild(tableContainer1);

        // 数据集2的热力图
        const tableContainer2 = document.createElement('div');
        tableContainer2.className = 'chart-container';
        tableContainer2.style.flex = '1';
        const table2 = createHeatmapTable(
            parsedData2.idleLatencies.nodes,
            parsedData2.idleLatencies.matrix,
            "源NUMA节点",
            "目标NUMA节点",
            true,
            "数据集2",
            globalMin,
            globalMax
        );
        tableContainer2.appendChild(table2);
        tablesContainer.appendChild(tableContainer2);

        section.appendChild(tablesContainer);

        // 计算并显示平均值对比
        let localLatencies1 = [], remoteLatencies1 = [];
        let localLatencies2 = [], remoteLatencies2 = [];

        // 处理数据集1
        parsedData1.idleLatencies.matrix.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
                if (isNaN(val)) return;
                if (parsedData1.idleLatencies.nodes[rIdx] === parsedData1.idleLatencies.nodes[cIdx]) {
                    localLatencies1.push(val);
                } else {
                    remoteLatencies1.push(val);
                }
            });
        });

        // 处理数据集2
        parsedData2.idleLatencies.matrix.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
                if (isNaN(val)) return;
                if (parsedData2.idleLatencies.nodes[rIdx] === parsedData2.idleLatencies.nodes[cIdx]) {
                    localLatencies2.push(val);
                } else {
                    remoteLatencies2.push(val);
                }
            });
        });

        const avgLocal1 = localLatencies1.length > 0 ? localLatencies1.reduce((a, b) => a + b, 0) / localLatencies1.length : 0;
        const avgRemote1 = remoteLatencies1.length > 0 ? remoteLatencies1.reduce((a, b) => a + b, 0) / remoteLatencies1.length : 0;
        const avgLocal2 = localLatencies2.length > 0 ? localLatencies2.reduce((a, b) => a + b, 0) / localLatencies2.length : 0;
        const avgRemote2 = remoteLatencies2.length > 0 ? remoteLatencies2.reduce((a, b) => a + b, 0) / remoteLatencies2.length : 0;

        const interpretation = createInterpretation(`
            <div class="comparison-container">
                <div class="comparison-column">
                    <strong>数据集1:</strong><br>
                    平均本地NUMA节点访问延迟: ${avgLocal1.toFixed(1)} ns<br>
                    平均远程NUMA节点访问延迟: ${avgRemote1.toFixed(1)} ns
                </div>
                <div class="comparison-column">
                    <strong>数据集2:</strong><br>
                    平均本地NUMA节点访问延迟: ${avgLocal2.toFixed(1)} ns<br>
                    平均远程NUMA节点访问延迟: ${avgRemote2.toFixed(1)} ns
                </div>
            </div>
            <div class="diff-analysis">
                <strong>差异分析:</strong><br>
                本地访问延迟差异: ${Math.abs(avgLocal1 - avgLocal2).toFixed(1)} ns (${((Math.abs(avgLocal1 - avgLocal2) / Math.min(avgLocal1, avgLocal2)) * 100).toFixed(1)}%)<br>
                远程访问延迟差异: ${Math.abs(avgRemote1 - avgRemote2).toFixed(1)} ns (${((Math.abs(avgRemote1 - avgRemote2) / Math.min(avgRemote1, avgRemote2)) * 100).toFixed(1)}%)
            </div>
        `);
        section.appendChild(interpretation);
    }

    // 2. Peak Injection Memory Bandwidths (Bar Chart)
    if (parsedData1.peakBandwidths && parsedData2.peakBandwidths) {
        const section = createSection(reportContainer, "2. 系统峰值注入内存带宽 (GB/s) 对比");
        const canvasId = "peakBandwidthChart";
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'chart-container';
        canvasContainer.style.height = '400px';
        const canvas = createCanvas(canvasContainer, canvasId);
        section.appendChild(canvasContainer);

        // 准备数据集
        const labels = parsedData1.peakBandwidths.map(item => item.label);
        const dataset1 = parsedData1.peakBandwidths.map(item => item.value / 1024);
        const dataset2 = parsedData2.peakBandwidths.map(item => item.value / 1024);

        chartsLocal[canvasId] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '数据集1 带宽 (GB/s)',
                        data: dataset1,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '数据集2 带宽 (GB/s)',
                        data: dataset2,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: function(value) {
                            return value.toFixed(1) + ' GB/s';
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 0,
                        title: {
                            display: true,
                            text: 'GB/s'
                        }
                    }
                }
            }
        });

        // 添加带宽对比分析
        let allReadsBw1 = parsedData1.peakBandwidths.find(b => b.label.toLowerCase().includes("all reads") || b.label.toLowerCase().includes("read only"));
        let streamTriadBw1 = parsedData1.peakBandwidths.find(b => b.label.toLowerCase().includes("stream-triad") || b.label.toLowerCase().includes("stream triad"));
        let allReadsBw2 = parsedData2.peakBandwidths.find(b => b.label.toLowerCase().includes("all reads") || b.label.toLowerCase().includes("read only"));
        let streamTriadBw2 = parsedData2.peakBandwidths.find(b => b.label.toLowerCase().includes("stream-triad") || b.label.toLowerCase().includes("stream triad"));

        let interpText = `<strong>带宽对比分析:</strong><br>`;
        if (allReadsBw1 && allReadsBw2) {
            const bw1 = allReadsBw1.value / 1024;
            const bw2 = allReadsBw2.value / 1024;
            const diff = Math.abs(bw1 - bw2);
            const percentDiff = (diff / Math.min(bw1, bw2)) * 100;
            interpText += `全读带宽对比: ${bw1.toFixed(1)} vs ${bw2.toFixed(1)} GB/s (差异: ${diff.toFixed(1)} GB/s, ${percentDiff.toFixed(1)}%)<br>`;
        }
        if (streamTriadBw1 && streamTriadBw2) {
            const bw1 = streamTriadBw1.value / 1024;
            const bw2 = streamTriadBw2.value / 1024;
            const diff = Math.abs(bw1 - bw2);
            const percentDiff = (diff / Math.min(bw1, bw2)) * 100;
            interpText += `Stream-Triad带宽对比: ${bw1.toFixed(1)} vs ${bw2.toFixed(1)} GB/s (差异: ${diff.toFixed(1)} GB/s, ${percentDiff.toFixed(1)}%)<br>`;
        }

        section.appendChild(createInterpretation(interpText));
    }

    // 3. Memory Bandwidths between nodes (Heatmap Table)
    if (parsedData1.interNodeBandwidths && parsedData2.interNodeBandwidths) {
        const section = createSection(reportContainer, "3. 系统内节点间内存带宽 (GB/s, 只读) - 热力图对比");
        
        // 计算两个数据集的全局最大最小值
        let globalMin = Infinity;
        let globalMax = -Infinity;
        
        // 处理数据集1
        parsedData1.interNodeBandwidths.matrix.forEach(row => {
            row.forEach(val => {
                if (!isNaN(val)) {
                    globalMin = Math.min(globalMin, val);
                    globalMax = Math.max(globalMax, val);
                }
            });
        });
        
        // 处理数据集2
        parsedData2.interNodeBandwidths.matrix.forEach(row => {
            row.forEach(val => {
                if (!isNaN(val)) {
                    globalMin = Math.min(globalMin, val);
                    globalMax = Math.max(globalMax, val);
                }
            });
        });
        
        // 创建两个热力图的容器
        const tablesContainer = document.createElement('div');
        tablesContainer.style.display = 'flex';
        tablesContainer.style.gap = '20px';
        tablesContainer.style.marginBottom = '20px';
        
        // 数据集1的热力图
        const tableContainer1 = document.createElement('div');
        tableContainer1.className = 'chart-container';
        tableContainer1.style.flex = '1';
        const table1 = createHeatmapTable(
            parsedData1.interNodeBandwidths.nodes,
            parsedData1.interNodeBandwidths.matrix,
            "源NUMA节点",
            "目标NUMA节点",
            false,
            "数据集1",
            globalMin,
            globalMax
        );
        tableContainer1.appendChild(table1);
        tablesContainer.appendChild(tableContainer1);

        // 数据集2的热力图
        const tableContainer2 = document.createElement('div');
        tableContainer2.className = 'chart-container';
        tableContainer2.style.flex = '1';
        const table2 = createHeatmapTable(
            parsedData2.interNodeBandwidths.nodes,
            parsedData2.interNodeBandwidths.matrix,
            "源NUMA节点",
            "目标NUMA节点",
            false,
            "数据集2",
            globalMin,
            globalMax
        );
        tableContainer2.appendChild(table2);
        tablesContainer.appendChild(tableContainer2);

        section.appendChild(tablesContainer);

        // 计算并显示平均值对比
        let localBw1 = [], remoteBw1 = [];
        let localBw2 = [], remoteBw2 = [];

        // 处理数据集1
        parsedData1.interNodeBandwidths.matrix.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
                if (isNaN(val)) return;
                if (parsedData1.interNodeBandwidths.nodes[rIdx] === parsedData1.interNodeBandwidths.nodes[cIdx]) {
                    localBw1.push(val);
                } else {
                    remoteBw1.push(val);
                }
            });
        });

        // 处理数据集2
        parsedData2.interNodeBandwidths.matrix.forEach((row, rIdx) => {
            row.forEach((val, cIdx) => {
                if (isNaN(val)) return;
                if (parsedData2.interNodeBandwidths.nodes[rIdx] === parsedData2.interNodeBandwidths.nodes[cIdx]) {
                    localBw2.push(val);
                } else {
                    remoteBw2.push(val);
                }
            });
        });

        const avgLocalBw1 = localBw1.length > 0 ? localBw1.reduce((a, b) => a + b, 0) / localBw1.length : 0;
        const avgRemoteBw1 = remoteBw1.length > 0 ? remoteBw1.reduce((a, b) => a + b, 0) / remoteBw1.length : 0;
        const avgLocalBw2 = localBw2.length > 0 ? localBw2.reduce((a, b) => a + b, 0) / localBw2.length : 0;
        const avgRemoteBw2 = remoteBw2.length > 0 ? remoteBw2.reduce((a, b) => a + b, 0) / remoteBw2.length : 0;

        const interpretation = createInterpretation(`
            <div class="comparison-container">
                <div class="comparison-column">
                    <strong>数据集1:</strong><br>
                    平均本地NUMA节点访问带宽: ${(avgLocalBw1 / 1024).toFixed(1)} GB/s<br>
                    平均远程NUMA节点访问带宽: ${(avgRemoteBw1 / 1024).toFixed(1)} GB/s
                </div>
                <div class="comparison-column">
                    <strong>数据集2:</strong><br>
                    平均本地NUMA节点访问带宽: ${(avgLocalBw2 / 1024).toFixed(1)} GB/s<br>
                    平均远程NUMA节点访问带宽: ${(avgRemoteBw2 / 1024).toFixed(1)} GB/s
                </div>
            </div>
            <div class="diff-analysis">
                <strong>差异分析:</strong><br>
                本地访问带宽差异: ${Math.abs(avgLocalBw1 - avgLocalBw2).toFixed(1)} GB/s (${((Math.abs(avgLocalBw1 - avgLocalBw2) / Math.min(avgLocalBw1, avgLocalBw2)) * 100).toFixed(1)}%)<br>
                远程访问带宽差异: ${Math.abs(avgRemoteBw1 - avgRemoteBw2).toFixed(1)} GB/s (${((Math.abs(avgRemoteBw1 - avgRemoteBw2) / Math.min(avgRemoteBw1, avgRemoteBw2)) * 100).toFixed(1)}%)
            </div>
        `);
        section.appendChild(interpretation);
    }

    // 4. Loaded Latencies (Line Chart)
    if (parsedData1.loadedLatencies && parsedData2.loadedLatencies) {
        const section = createSection(reportContainer, "4. 系统负载状态下延迟与带宽 (只读) 对比");
        const canvasId = "loadedLatencyChart";
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'chart-container';
        canvasContainer.style.height = '400px';
        const canvas = createCanvas(canvasContainer, canvasId);
        section.appendChild(canvasContainer);

        chartsLocal[canvasId] = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: parsedData1.loadedLatencies.map(item => item.delay),
                datasets: [
                    {
                        label: '数据集1 延迟 (ns)',
                        data: parsedData1.loadedLatencies.map(item => item.latency),
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        yAxisID: 'y'
                    },
                    {
                        label: '数据集1 带宽 (GB/s)',
                        data: parsedData1.loadedLatencies.map(item => item.bandwidth / 1024),
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        yAxisID: 'y1'
                    },
                    {
                        label: '数据集2 延迟 (ns)',
                        data: parsedData2.loadedLatencies.map(item => item.latency),
                        borderColor: 'rgba(255, 159, 64, 1)',
                        backgroundColor: 'rgba(255, 159, 64, 0.2)',
                        yAxisID: 'y'
                    },
                    {
                        label: '数据集2 带宽 (GB/s)',
                        data: parsedData2.loadedLatencies.map(item => item.bandwidth / 1024),
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 0,
                        title: {
                            display: true,
                            text: '延迟 (ns)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        title: {
                            display: true,
                            text: '带宽 (GB/s)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });

        // 添加负载状态下的性能对比分析
        let maxLatency1 = Math.max(...parsedData1.loadedLatencies.map(item => item.latency));
        let maxLatency2 = Math.max(...parsedData2.loadedLatencies.map(item => item.latency));
        let maxBandwidth1 = Math.max(...parsedData1.loadedLatencies.map(item => item.bandwidth / 1024));
        let maxBandwidth2 = Math.max(...parsedData2.loadedLatencies.map(item => item.bandwidth / 1024));

        const interpretation = createInterpretation(`
            <strong>负载状态性能对比:</strong><br>
            最大延迟对比: ${maxLatency1.toFixed(1)} vs ${maxLatency2.toFixed(1)} ns (差异: ${Math.abs(maxLatency1 - maxLatency2).toFixed(1)} ns, ${((Math.abs(maxLatency1 - maxLatency2) / Math.min(maxLatency1, maxLatency2)) * 100).toFixed(1)}%)<br>
            最大带宽对比: ${maxBandwidth1.toFixed(1)} vs ${maxBandwidth2.toFixed(1)} GB/s (差异: ${Math.abs(maxBandwidth1 - maxBandwidth2).toFixed(1)} GB/s, ${((Math.abs(maxBandwidth1 - maxBandwidth2) / Math.min(maxBandwidth1, maxBandwidth2)) * 100).toFixed(1)}%)
        `);
        section.appendChild(interpretation);
    }

    // 5. Cache-to-Cache Transfer Latency (Heatmap Tables)
    if (parsedData1.cacheToCache && parsedData2.cacheToCache) {
        const section = createSection(reportContainer, "5. 缓存到缓存传输延迟 (ns) - 对比");
        
        // 创建对比容器
        const comparisonContainer = document.createElement('div');
        comparisonContainer.className = 'comparison-container';
        
        // 数据集1的缓存延迟信息
        const data1Container = document.createElement('div');
        data1Container.className = 'comparison-column';
        let c2cText1 = "<strong>数据集1:</strong><br>";
        if (!isNaN(parsedData1.cacheToCache.localHit)) {
            c2cText1 += `本地插槽 L2->L2 HIT 延迟: ${parsedData1.cacheToCache.localHit.toFixed(1)} ns<br>`;
        }
        if (!isNaN(parsedData1.cacheToCache.localHitm)) {
            c2cText1 += `本地插槽 L2->L2 HITM 延迟: ${parsedData1.cacheToCache.localHitm.toFixed(1)} ns`;
        }
        data1Container.innerHTML = c2cText1;
        comparisonContainer.appendChild(data1Container);

        // 数据集2的缓存延迟信息
        const data2Container = document.createElement('div');
        data2Container.className = 'comparison-column';
        let c2cText2 = "<strong>数据集2:</strong><br>";
        if (!isNaN(parsedData2.cacheToCache.localHit)) {
            c2cText2 += `本地插槽 L2->L2 HIT 延迟: ${parsedData2.cacheToCache.localHit.toFixed(1)} ns<br>`;
        }
        if (!isNaN(parsedData2.cacheToCache.localHitm)) {
            c2cText2 += `本地插槽 L2->L2 HITM 延迟: ${parsedData2.cacheToCache.localHitm.toFixed(1)} ns`;
        }
        data2Container.innerHTML = c2cText2;
        comparisonContainer.appendChild(data2Container);
        
        section.appendChild(comparisonContainer);

        // 处理远程缓存传输延迟矩阵
        const processCacheMatrix = (matrixData1, matrixData2, title, isWriterHomed) => {
            if (matrixData1 && matrixData2) {
                const subTitle = document.createElement('h3');
                subTitle.textContent = title;
                subTitle.style.fontSize = "1.1em";
                subTitle.style.marginTop = "15px";
                section.appendChild(subTitle);

                // 计算两个数据集的全局最大最小值
                let globalMin = Infinity;
                let globalMax = -Infinity;
                
                // 处理数据集1
                matrixData1.matrix.forEach(row => {
                    row.forEach(val => {
                        if (!isNaN(val)) {
                            globalMin = Math.min(globalMin, val);
                            globalMax = Math.max(globalMax, val);
                        }
                    });
                });
                
                // 处理数据集2
                matrixData2.matrix.forEach(row => {
                    row.forEach(val => {
                        if (!isNaN(val)) {
                            globalMin = Math.min(globalMin, val);
                            globalMax = Math.max(globalMax, val);
                        }
                    });
                });

                // 创建两个热力图的容器
                const tablesContainer = document.createElement('div');
                tablesContainer.style.display = 'flex';
                tablesContainer.style.gap = '20px';
                tablesContainer.style.marginBottom = '20px';

                // 数据集1的热力图
                const tableContainer1 = document.createElement('div');
                tableContainer1.className = 'chart-container';
                tableContainer1.style.flex = '1';
                const table1 = createHeatmapTable(
                    matrixData1.nodes,
                    matrixData1.matrix,
                    "读取者NUMA",
                    "写入者NUMA",
                    true,
                    "数据集1",
                    globalMin,
                    globalMax
                );
                tableContainer1.appendChild(table1);
                tablesContainer.appendChild(tableContainer1);

                // 数据集2的热力图
                const tableContainer2 = document.createElement('div');
                tableContainer2.className = 'chart-container';
                tableContainer2.style.flex = '1';
                const table2 = createHeatmapTable(
                    matrixData2.nodes,
                    matrixData2.matrix,
                    "读取者NUMA",
                    "写入者NUMA",
                    true,
                    "数据集2",
                    globalMin,
                    globalMax
                );
                tableContainer2.appendChild(table2);
                tablesContainer.appendChild(tableContainer2);

                section.appendChild(tablesContainer);
            }
        };

        processCacheMatrix(
            parsedData1.cacheToCache.remoteHitmWriterHomed,
            parsedData2.cacheToCache.remoteHitmWriterHomed,
            "远程插槽 L2->L2 HITM 延迟 (数据地址归属于写入者插槽)",
            true
        );
        processCacheMatrix(
            parsedData1.cacheToCache.remoteHitmReaderHomed,
            parsedData2.cacheToCache.remoteHitmReaderHomed,
            "远程插槽 L2->L2 HITM 延迟 (数据地址归属于读取者插槽)",
            false
        );
    }

    return chartsLocal;
}

function createHeatmapTable(nodes, matrix, rowLabel, colLabel, isLatency = false, title = "", min = null, max = null) {
    const table = document.createElement('table');
    table.className = 'heatmap-table';
    
    // 创建标题行
    if (title) {
        const titleRow = document.createElement('tr');
        const titleCell = document.createElement('th');
        titleCell.colSpan = nodes.length + 1;
        titleCell.textContent = title;
        titleCell.style.textAlign = 'center';
        titleCell.style.backgroundColor = '#f8f9fa';
        titleRow.appendChild(titleCell);
        table.appendChild(titleRow);
    }

    // 创建表头
    const headerRow = document.createElement('tr');
    const cornerCell = document.createElement('th');
    cornerCell.textContent = `${rowLabel} \\ ${colLabel}`;
    headerRow.appendChild(cornerCell);
    nodes.forEach(node => {
        const th = document.createElement('th');
        th.textContent = node;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // 计算全局最大最小值
    let globalMin = min !== null ? min : Infinity;
    let globalMax = max !== null ? max : -Infinity;
    if (min === null || max === null) {
        matrix.forEach(row => {
            row.forEach(val => {
                if (!isNaN(val)) {
                    globalMin = Math.min(globalMin, val);
                    globalMax = Math.max(globalMax, val);
                }
            });
        });
    }

    // 创建数据行
    matrix.forEach((row, rIdx) => {
        const tr = document.createElement('tr');
        const rowHeader = document.createElement('th');
        rowHeader.textContent = nodes[rIdx];
        tr.appendChild(rowHeader);
        
        row.forEach(val => {
            const td = document.createElement('td');
            if (isNaN(val)) {
                td.textContent = 'N/A';
                td.className = 'na';
            } else {
                td.textContent = isLatency ? val.toFixed(1) : (val / 1024).toFixed(1);
                // 使用全局最大最小值计算颜色
                const normalizedValue = (val - globalMin) / (globalMax - globalMin);
                const color = getColorForValue(normalizedValue, isLatency);
                td.style.backgroundColor = color;
                td.className = isDarkColor(color) ? 'dark-bg-text' : 'light-bg-text';
            }
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });

    // 添加颜色图例
    const legendRow = document.createElement('tr');
    const legendCell = document.createElement('td');
    legendCell.colSpan = nodes.length + 1;
    legendCell.style.padding = '10px';
    legendCell.style.textAlign = 'center';
    
    const legend = document.createElement('div');
    legend.style.display = 'flex';
    legend.style.justifyContent = 'center';
    legend.style.alignItems = 'center';
    legend.style.gap = '5px';
    
    // 创建渐变色条
    const gradientBar = document.createElement('div');
    gradientBar.style.width = '200px';
    gradientBar.style.height = '20px';
    gradientBar.style.background = 'linear-gradient(to right, rgb(18, 194, 233), rgb(196, 113, 237), rgb(246, 79, 89))';
    gradientBar.style.borderRadius = '3px';
    
    // 添加最小值和最大值标签
    const minLabel = document.createElement('span');
    minLabel.textContent = isLatency ? `${globalMin.toFixed(1)} ns` : `${(globalMin / 1024).toFixed(1)} GB/s`;
    
    const maxLabel = document.createElement('span');
    maxLabel.textContent = isLatency ? `${globalMax.toFixed(1)} ns` : `${(globalMax / 1024).toFixed(1)} GB/s`;
    
    // 对于延迟值，需要交换最小值和最大值的显示位置
    if (isLatency) {
        legend.appendChild(maxLabel);
        legend.appendChild(gradientBar);
        legend.appendChild(minLabel);
    } else {
        legend.appendChild(minLabel);
        legend.appendChild(gradientBar);
        legend.appendChild(maxLabel);
    }
    
    legendCell.appendChild(legend);
    legendRow.appendChild(legendCell);
    table.appendChild(legendRow);

    return table;
}

function getColorForValue(value, isLatency = false) {
    // 使用新的渐变色方案
    // 从 rgb(18, 194, 233) -> rgb(196, 113, 237) -> rgb(246, 79, 89)
    // 对于延迟值，需要反转颜色顺序
    if (isLatency) {
        value = 1 - value; // 反转值
    }
    
    if (value <= 0.5) {
        // 第一段渐变：rgb(18, 194, 233) -> rgb(196, 113, 237)
        const r = Math.round(18 + (196 - 18) * (value * 2));
        const g = Math.round(194 + (113 - 194) * (value * 2));
        const b = Math.round(233 + (237 - 233) * (value * 2));
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // 第二段渐变：rgb(196, 113, 237) -> rgb(246, 79, 89)
        const normalizedValue = (value - 0.5) * 2;
        const r = Math.round(196 + (246 - 196) * normalizedValue);
        const g = Math.round(113 + (79 - 113) * normalizedValue);
        const b = Math.round(237 + (89 - 237) * normalizedValue);
        return `rgb(${r}, ${g}, ${b})`;
    }
}

function isDarkColor(color) {
    // 将颜色字符串转换为RGB值
    const rgb = color.match(/\d+/g);
    if (!rgb) return false;
    
    // 计算颜色的亮度
    // 使用相对亮度公式：0.299*R + 0.587*G + 0.114*B
    const brightness = (parseInt(rgb[0]) * 0.299 + parseInt(rgb[1]) * 0.587 + parseInt(rgb[2]) * 0.114) / 255;
    
    // 如果亮度小于0.5，认为是深色
    return brightness < 0.5;
} 