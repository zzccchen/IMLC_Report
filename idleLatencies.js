function plotIdleLatencies(data) {
    const section = document.getElementById('idleLatenciesSection');
    if (!data || data.values.length === 0) {
        section.style.display = 'none';
        console.warn('Idle Latencies data is missing or empty.');
        return;
    }
    section.style.display = 'block';

    const zValues = data.values;
    const yLabels = data.nodes.map(node => `Node ${node}`);
    const xLabels = data.nodes.map(node => `Node ${node}`);

    // Format zValues to one decimal place
    const formattedZValues = zValues.map(row => row.map(val => parseFloat(val.toFixed(1))));
    const textValues = formattedZValues.map(row => row.map(val => `${val} ns`));

    const plotData = [{
        z: formattedZValues,
        x: xLabels,
        y: yLabels,
        type: 'heatmap',
        colorscale: 'YlGnBu',
        reversescale: true,
        showscale: true,
        zmin: 0,
        text: textValues, // Display numbers on heatmap cells
        texttemplate: "%{text}", // Use the text array for display
        hoverinfo: 'text'
    }];

    const layout = {
        title: '内存空闲延迟热力图 (ns)',
        xaxis: { title: '目标 NUMA 节点' },
        yaxis: { title: '源 NUMA 节点', autorange: 'reversed', rangemode: 'tozero' }, // Ensure Y-axis starts at 0
        coloraxis: {cmin: 0}, // Ensure color scale starts at 0
        autosize: true,
        margin: { t: 50, b: 100, l: 100, r: 50 }
    };

    Plotly.newPlot('idleLatenciesChart', plotData, layout, {responsive: true});
} 