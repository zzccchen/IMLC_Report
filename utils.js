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

    const allValues = matrixData.flat().filter(v => !isNaN(v) && (isCacheMatrix ? true : v >= 0));
    let minVal = Math.min(...allValues);
    let maxVal = Math.max(...allValues);

    if (minVal === maxVal) {
        minVal = maxVal -1; 
        if (maxVal === 0) { // Handle case where all values are 0
          minVal = -1;
          maxVal = 1;
        } else if (maxVal < 0) { // Handle all negative
            minVal = maxVal * 1.1 -1; // make slightly more negative
            maxVal = maxVal * 0.9 +1; // make slightly less negative
        } else {
            minVal = maxVal * 0.9 -1;
            maxVal = maxVal * 1.1 +1;
        }
         if (minVal === maxVal) { // if still equal after adjustment (e.g. maxVal was 1)
            minVal = 0;
            maxVal = 2;
        }
    }

    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const th = document.createElement('th');
    th.textContent = `${rowHeaderPrefix} \\ ${colHeaderPrefix}`;
    headerRow.appendChild(th);
    nodes.forEach(nodeId => {
        const thNode = document.createElement('th');
        thNode.textContent = nodeId;
        headerRow.appendChild(thNode);
    });

    const tbody = table.createTBody();
    matrixData.forEach((rowData, rIdx) => {
        const tr = tbody.insertRow();
        const tdNode = tr.insertCell();
        tdNode.textContent = nodes[rIdx]; 
        tdNode.style.fontWeight = 'bold';

        rowData.forEach((val, cIdx) => {
            const cell = tr.insertCell();
            if (isNaN(val)) {
                cell.textContent = '-';
                cell.classList.add('na');
            } else {
                cell.textContent = val.toFixed(1);
                let normalizedValue = (maxVal - minVal === 0) ? 0.5 : (val - minVal) / (maxVal - minVal);

                let hue, lightness;
                if (isLatency) { // Lower is better: Green (low) to Yellow to Red (high)
                    hue = 120 * (1 - normalizedValue);
                    lightness = 75 - (normalizedValue * 25); 
                } else { // Higher is better (Bandwidth): Red (low) to Yellow to Green (high)
                    hue = 120 * normalizedValue;
                    lightness = 75 - ((1 - normalizedValue) * 25); 
                }
                cell.style.backgroundColor = `hsl(${hue}, 70%, ${lightness}%)`;

                // Determine text color for contrast
                if ((isLatency && normalizedValue > 0.6 && lightness < 60) || 
                    (!isLatency && normalizedValue < 0.4 && lightness < 60) || 
                     lightness < 50 ) { 
                    cell.classList.add('dark-bg-text');
                } else {
                    cell.classList.add('light-bg-text');
                }
                        
                if (isCacheMatrix && rIdx === cIdx && nodes[rIdx] === nodes[cIdx]) {
                   cell.textContent = '-'; // Or some other indicator like 'Local'
                   cell.classList.add('na'); 
                   cell.style.backgroundColor = '#e0e0e0'; 
                   cell.classList.remove('dark-bg-text', 'light-bg-text');
                }
            }
        });
    });
    return table;
} 