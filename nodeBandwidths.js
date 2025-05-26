function plotNodeBandwidths(data) {
    const section = document.getElementById('nodeBandwidthsSection');
    if (!data || data.values.length === 0) {
        section.style.display = 'none';
        console.warn('Node Bandwidths data is missing or empty.');
        return;
    }
    section.style.display = 'block';

    const zValues = data.values;
    const yLabels = data.nodes.map(node => `Node ${node}`);
    const xLabels = data.nodes.map(node => `Node ${node}`);

    // Convert MB/s to GB/s and format to one decimal place
    const zValuesGB = data.values.map(row => 
        row.map(val => parseFloat((val / 1024).toFixed(1)))
    );
    const textValues = zValuesGB.map(row => row.map(val => `${val} GB/s`));

    const plotData = [{
        z: zValuesGB,
        x: xLabels,
        y: yLabels,
        type: 'heatmap',
        colorscale: 'Viridis',
        showscale: true,
        zmin: 0,
        text: textValues, // Display numbers on heatmap cells
        texttemplate: "%{text}", // Use the text array for display
        hoverinfo: 'text'
    }];

    const layout = {
        title: '节点间内存带宽热力图 (GB/sec) - 只读',
        xaxis: { title: '目标 NUMA 节点' },
        yaxis: { title: '源 NUMA 节点', autorange: 'reversed', rangemode: 'tozero' },
        autosize: true,
        margin: { t: 50, b: 100, l: 100, r: 50 }
    };

    Plotly.newPlot('nodeBandwidthsChart', plotData, layout, {responsive: true});
} 