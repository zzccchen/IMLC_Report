function destroyCharts(charts) {
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    return {}; // Return a new empty object
}

function createSection(container, titleText) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'report-section';
    const title = document.createElement('h2');
    title.textContent = titleText;
    sectionDiv.appendChild(title);
    container.appendChild(sectionDiv);
    return sectionDiv;
}

function createCanvas(container, id) {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    container.appendChild(canvas);
    return canvas;
}

function createInterpretation(htmlContent) {
    const div = document.createElement('div');
    div.className = 'interpretation';
    div.innerHTML = htmlContent;
    return div;
}

/**
 * Creates an HTML table with cells colored as a heatmap.
 * @param {number[]} nodes - Array of NUMA node IDs.
 * @param {number[][]} matrixData - The 2D array of data.
 * @param {string} rowHeaderPrefix - Prefix for row headers.
 * @param {string} colHeaderPrefix - Prefix for column headers.
 * @param {boolean} isLatency - True if data is latency (lower is better), false for bandwidth (higher is better).
 * @param {boolean} isCacheMatrix - Special handling for cache matrices diagonal.
 */
function createHeatmapTable(nodes, matrixData, rowHeaderPrefix, colHeaderPrefix, isLatency, isCacheMatrix = false) {
    const table = document.createElement('table');
    table.className = 'heatmap-table';

    // 过滤有效值并计算范围
    const allValues = matrixData.flat().filter(v => !isNaN(v) && (isCacheMatrix ? true : v >= 0));
    let minVal = 0; // 强制最小值从0开始
    let maxVal = Math.max(...allValues);

    // 处理特殊情况
    if (maxVal === 0) {
        maxVal = 1; // 避免除以零的情况
    }

    // 定义渐变色
    const gradientColors = [
        { r: 18, g: 194, b: 233 },  // 蓝色
        { r: 196, g: 113, b: 237 }, // 紫色
        { r: 246, g: 79, b: 89 }    // 红色
    ];

    // 创建表头
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const th = document.createElement('th');
    th.textContent = '';
    headerRow.appendChild(th);
    
    // 添加列标题
    nodes.forEach(nodeId => {
        const thNode = document.createElement('th');
        thNode.textContent = nodeId;
        headerRow.appendChild(thNode);
    });

    // 创建表格主体
    const tbody = table.createTBody();
    matrixData.forEach((rowData, rIdx) => {
        const tr = tbody.insertRow();
        
        // 添加行标题
        const tdNode = tr.insertCell();
        tdNode.textContent = nodes[rIdx];
        tdNode.style.fontWeight = 'bold';

        // 添加数据单元格
        rowData.forEach((val, cIdx) => {
            const cell = tr.insertCell();
            if (isNaN(val)) {
                cell.textContent = '-';
                cell.classList.add('na');
            } else {
                // 对于带宽数据（isLatency为false），将值转换为GB/s
                if (!isLatency) {
                    cell.textContent = (val / 1024).toFixed(1);
                } else {
                    cell.textContent = val.toFixed(1);
                }
                
                // 计算颜色 - 使用指定的渐变色
                let normalizedValue = (maxVal - minVal === 0) ? 0.5 : (val - minVal) / (maxVal - minVal);
                let r, g, b;
                
                if (isLatency) {
                    // 延迟：蓝色（低）到紫色到红色（高）
                    if (normalizedValue < 0.5) {
                        // 蓝色到紫色
                        normalizedValue = normalizedValue * 2;
                        r = gradientColors[0].r + (gradientColors[1].r - gradientColors[0].r) * normalizedValue;
                        g = gradientColors[0].g + (gradientColors[1].g - gradientColors[0].g) * normalizedValue;
                        b = gradientColors[0].b + (gradientColors[1].b - gradientColors[0].b) * normalizedValue;
                    } else {
                        // 紫色到红色
                        normalizedValue = (normalizedValue - 0.5) * 2;
                        r = gradientColors[1].r + (gradientColors[2].r - gradientColors[1].r) * normalizedValue;
                        g = gradientColors[1].g + (gradientColors[2].g - gradientColors[1].g) * normalizedValue;
                        b = gradientColors[1].b + (gradientColors[2].b - gradientColors[1].b) * normalizedValue;
                    }
                } else {
                    // 带宽：红色（低）到紫色到蓝色（高）
                    if (normalizedValue < 0.5) {
                        // 红色到紫色
                        normalizedValue = normalizedValue * 2;
                        r = gradientColors[2].r + (gradientColors[1].r - gradientColors[2].r) * normalizedValue;
                        g = gradientColors[2].g + (gradientColors[1].g - gradientColors[2].g) * normalizedValue;
                        b = gradientColors[2].b + (gradientColors[1].b - gradientColors[2].b) * normalizedValue;
                    } else {
                        // 紫色到蓝色
                        normalizedValue = (normalizedValue - 0.5) * 2;
                        r = gradientColors[1].r + (gradientColors[0].r - gradientColors[1].r) * normalizedValue;
                        g = gradientColors[1].g + (gradientColors[0].g - gradientColors[1].g) * normalizedValue;
                        b = gradientColors[1].b + (gradientColors[0].b - gradientColors[1].b) * normalizedValue;
                    }
                }
                
                cell.style.backgroundColor = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

                // 根据背景色调整文字颜色
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                if (brightness > 128) {
                    cell.classList.add('dark-bg-text');
                } else {
                    cell.classList.add('light-bg-text');
                }
            }

            // 处理缓存矩阵的对角线
            if (isCacheMatrix && rIdx === cIdx && nodes[rIdx] === nodes[cIdx]) {
                cell.textContent = '-';
                cell.classList.add('na');
                cell.style.backgroundColor = '#e0e0e0';
                cell.classList.remove('dark-bg-text', 'light-bg-text');
            }
        });
    });

    // 创建表格和标题的容器
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.alignItems = 'center';
    container.style.marginLeft = '60px'; // 为Y轴标题留出空间

    // 创建Y轴标题
    const yAxisTitle = document.createElement('div');
    yAxisTitle.textContent = rowHeaderPrefix;
    yAxisTitle.style.transform = 'rotate(-90deg)';
    yAxisTitle.style.position = 'absolute';
    yAxisTitle.style.left = '-50px';
    yAxisTitle.style.top = '50%';
    yAxisTitle.style.fontWeight = 'bold';

    // 创建X轴标题容器
    const xAxisContainer = document.createElement('div');
    xAxisContainer.style.display = 'flex';
    xAxisContainer.style.flexDirection = 'column';
    xAxisContainer.style.alignItems = 'center';

    // 创建X轴标题
    const xAxisTitle = document.createElement('div');
    xAxisTitle.textContent = colHeaderPrefix;
    xAxisTitle.style.marginTop = '5px';
    xAxisTitle.style.fontWeight = 'bold';

    // 添加表格和标题到容器
    xAxisContainer.appendChild(table);
    xAxisContainer.appendChild(xAxisTitle);
    container.appendChild(yAxisTitle);
    container.appendChild(xAxisContainer);

    return container;
} 