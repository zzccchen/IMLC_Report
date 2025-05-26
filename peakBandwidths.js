function plotPeakBandwidths(data) {
    const section = document.getElementById('peakBandwidthsSection');
    if (!data || data.labels.length === 0) {
        section.style.display = 'none';
        console.warn('Peak Bandwidths data is missing or empty.');
        return;
    }
    section.style.display = 'block';

    const plotData = [{
        x: data.labels,
        y: data.values,
        type: 'bar',
        text: data.values.map(val => `${parseFloat(val).toFixed(1)} MB/s`),
        hoverinfo: 'text',
        marker: {
            color: '#337ab7'
        }
    }];

    const layout = {
        title: '系统峰值内存带宽 (MB/sec)',
        xaxis: { title: '读写比' },
        yaxis: { title: '带宽 (MB/sec)' },
        autosize: true,
        margin: { t: 50, b: 120, l: 80, r: 50 } // Increased bottom margin for labels
    };

    Plotly.newPlot('peakBandwidthsChart', plotData, layout, {responsive: true});
} 