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

    const plotData = [{
        z: zValues,
        x: xLabels,
        y: yLabels,
        type: 'heatmap',
        colorscale: 'YlGnBu',
        reversescale: true,
        showscale: true,
        text: zValues.map(row => row.map(val => `${val} ns`)),
        hoverinfo: 'text'
    }];

    const layout = {
        title: '内存空闲延迟热力图 (ns)',
        xaxis: { title: '目标 NUMA 节点' },
        yaxis: { title: '源 NUMA 节点', autorange: 'reversed' },
        autosize: true,
        margin: { t: 50, b: 100, l: 100, r: 50 }
    };

    Plotly.newPlot('idleLatenciesChart', plotData, layout, {responsive: true});
} 