function plotLoadedLatencies(data) {
    const section = document.getElementById('loadedLatenciesSection');
    if (!data || data.delays.length === 0) {
        section.style.display = 'none';
        console.warn('Loaded Latencies data is missing or empty.');
        return;
    }
    section.style.display = 'block';

    // Latency vs Delay
    const formattedLatencies = data.latencies.map(val => parseFloat(val.toFixed(1)));
    const latencyText = formattedLatencies.map((val, i) => `延迟: ${val} ns<br>注入延迟: ${data.delays[i]}`);

    const latencyTrace = {
        x: data.delays,
        y: formattedLatencies,
        type: 'scatter',
        mode: 'lines+markers+text',
        name: '延迟 (ns)',
        text: formattedLatencies.map(val => val.toString()),
        textposition: 'top center',
        hovertext: latencyText,
        hoverinfo: 'text',
        marker: {color: '#ff7f0e'}
    };

    const latencyLayout = {
        title: '加载延迟 vs 注入延迟',
        xaxis: { title: '注入延迟 (cycles)', type: 'log', autorange: true },
        yaxis: { title: '延迟 (ns)', rangemode: 'tozero' },
        autosize: true,
        margin: { t: 50, b: 70, l: 80, r: 50 }
    };

    Plotly.newPlot('loadedLatenciesChart', [latencyTrace], latencyLayout, {responsive: true});

    // Bandwidth vs Delay
    const bandwidthsGB = data.bandwidths.map(val => parseFloat((val / 1024).toFixed(1)));
    const bandwidthText = bandwidthsGB.map((val, i) => `带宽: ${val} GB/s<br>注入延迟: ${data.delays[i]}`);

    const bandwidthTrace = {
        x: data.delays,
        y: bandwidthsGB,
        type: 'scatter',
        mode: 'lines+markers+text',
        name: '带宽 (GB/sec)',
        text: bandwidthsGB.map(val => val.toString()),
        textposition: 'top center',
        hovertext: bandwidthText,
        hoverinfo: 'text',
        marker: {color: '#1f77b4'}
    };

    const bandwidthLayout = {
        title: '加载带宽 vs 注入延迟',
        xaxis: { title: '注入延迟 (cycles)', type: 'log', autorange: true },
        yaxis: { title: '带宽 (GB/sec)', rangemode: 'tozero' },
        autosize: true,
        margin: { t: 50, b: 70, l: 80, r: 50 }
    };

    Plotly.newPlot('loadedBandwidthsChart', [bandwidthTrace], bandwidthLayout, {responsive: true});
} 