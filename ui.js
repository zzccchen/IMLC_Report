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
            平均本地NUMA节点访问延迟: <strong>${avgLocal.toFixed(1)} ns</strong>。<br>
            平均远程NUMA节点访问延迟: <strong>${avgRemote.toFixed(1)} ns</strong>。<br>
            (热力图说明: 延迟越低颜色越偏绿/浅，越高则越偏红/深)。
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
        let interpText = `此图表显示了不同读写比率下的峰值内存带宽。`;
        if (allReadsBw) interpText += ` 全读带宽约为 <strong>${(allReadsBw.value / 1000).toFixed(1)} GB/s</strong>。`;
        if (streamTriadBw) interpText += ` Stream-Triad 带宽 (一种更接近实际应用的指标) 约为 <strong>${(streamTriadBw.value / 1000).toFixed(1)} GB/s</strong>。`;

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
            interpText += "<br><strong>注意:</strong> 观察到带宽随着写操作比例的增加而增加的趋势，这可能表明写操作被更有效地处理，或者特定的缓存/内存控制器行为。";
        } else {
            interpText += " 通常，随着写操作比例的增加，由于写操作的复杂性，带宽可能会有所下降或保持稳定。";
        }
        section.appendChild(createInterpretation(interpText));
    }

    // 3. Memory Bandwidths between nodes (Heatmap Table)
    if (parsedData.interNodeBandwidths && parsedData.interNodeBandwidths.matrix.length > 0 && parsedData.interNodeBandwidths.nodes.length > 0) {
        const section = createSection(reportContainer, "3. 系统内节点间内存带宽 (MB/s, 只读) - 热力图");
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
            每个NUMA节点访问其本地内存的平均带宽约为 <strong>${(avgLocalBw / 1000).toFixed(1)} GB/s</strong>。<br>
            跨NUMA节点访问远程内存的平均带宽约为 <strong>${(avgRemoteBw / 1000).toFixed(1)} GB/s</strong>。<br>
            (热力图说明: 带宽越高颜色越偏绿/浅，越低则越偏红/深)。
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
            此图表展示了在不同内存负载（通过注入延迟控制，值越小表示负载越高）下的延迟和带宽关系。<br>
            在最高负载时 (注入延迟 ${peakLoad.delay} ns)，延迟为 <strong>${peakLoad.latency.toFixed(1)} ns</strong>，带宽为 <strong>${(peakLoad.bandwidth / 1000).toFixed(1)} GB/s</strong>。<br>
            在最低负载时 (注入延迟 ${lowLoad.delay} ns)，延迟降至 <strong>${lowLoad.latency.toFixed(1)} ns</strong>，带宽为 <strong>${(lowLoad.bandwidth / 1000).toFixed(1)} GB/s</strong>。<br>
            通常，要达到峰值带宽，需要容忍更高的延迟。曲线的拐点可以帮助识别系统在负载下的最佳工作点。
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
            c2cText += `本地插槽 L2->L2 HITM (脏数据) 延迟: <strong>${parsedData.cacheToCache.localHitm.toFixed(1)} ns</strong><br><br>`;
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
            (热力图说明: 延迟越低颜色越偏绿/浅，越高则越偏红/深)。<br>
            本地插槽内的缓存传输通常最快。跨插槽传输（特别是涉及修改过的缓存行 - HITM）延迟会显著增加。<br>
            数据地址的归属节点（即数据由哪个插槽的内存控制器管理）对远程缓存一致性延迟有重要影响。"
            +"通常，当数据地址归属于读取者一方的Socket时，其访问延迟可能更低，因为数据更"靠近"请求者。
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