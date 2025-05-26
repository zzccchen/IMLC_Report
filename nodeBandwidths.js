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

    const plotData = [{
        z: zValues,
        x: xLabels,
        y: yLabels,
        type: 'heatmap',
        colorscale: 'Viridis',
        showscale: true,
        text: zValues.map(row => row.map(val => `${parseFloat(val).toFixed(1)} MB/s`)),
        hoverinfo: 'text'
    }];

    const layout = {
        title: '节点间内存带宽热力图 (MB/sec) - 只读',
        xaxis: { title: '目标 NUMA 节点' },
        yaxis: { title: '源 NUMA 节点', autorange: 'reversed' },
        autosize: true,
        margin: { t: 50, b: 100, l: 100, r: 50 }
    };

    Plotly.newPlot('nodeBandwidthsChart', plotData, layout, {responsive: true});
} 