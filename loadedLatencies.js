function plotLoadedLatencies(data) {
    const section = document.getElementById('loadedLatenciesSection');
    if (!data || data.delays.length === 0) {
        section.style.display = 'none';
        console.warn('Loaded Latencies data is missing or empty.');
        return;
    }
    section.style.display = 'block';

    // Latency vs Delay
    const latencyTrace = {
        x: data.delays,
        y: data.latencies,
        type: 'scatter',
        mode: 'lines+markers',
        name: '延迟 (ns)',
        text: data.latencies.map((val, i) => `延迟: ${val} ns<br>注入延迟: ${data.delays[i]}`),
        hoverinfo: 'text',
        marker: {color: '#ff7f0e'}
    };

    const latencyLayout = {
        title: '加载延迟 vs 注入延迟',
        xaxis: { title: '注入延迟 (cycles)', type: 'log', autorange: true },
        yaxis: { title: '延迟 (ns)' },
        autosize: true,
        margin: { t: 50, b: 70, l: 80, r: 50 }
    };

    Plotly.newPlot('loadedLatenciesChart', [latencyTrace], latencyLayout, {responsive: true});

    // Bandwidth vs Delay
    const bandwidthTrace = {
        x: data.delays,
        y: data.bandwidths,
        type: 'scatter',
        mode: 'lines+markers',
        name: '带宽 (MB/sec)',
        text: data.bandwidths.map((val, i) => `带宽: ${parseFloat(val).toFixed(1)} MB/s<br>注入延迟: ${data.delays[i]}`),
        hoverinfo: 'text',
        marker: {color: '#1f77b4'}
    };

    const bandwidthLayout = {
        title: '加载带宽 vs 注入延迟',
        xaxis: { title: '注入延迟 (cycles)', type: 'log', autorange: true },
        yaxis: { title: '带宽 (MB/sec)' },
        autosize: true,
        margin: { t: 50, b: 70, l: 80, r: 50 }
    };

    Plotly.newPlot('loadedBandwidthsChart', [bandwidthTrace], bandwidthLayout, {responsive: true});
} 