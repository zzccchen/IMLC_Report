function plotPeakBandwidths(data) {
    const section = document.getElementById('peakBandwidthsSection');
    if (!data || data.labels.length === 0) {
        section.style.display = 'none';
        console.warn('Peak Bandwidths data is missing or empty.');
        return;
    }
    section.style.display = 'block';

    // Convert MB/s to GB/s and format to one decimal place
    const yValuesGB = data.values.map(val => parseFloat((val / 1024).toFixed(1)));
    const textValues = yValuesGB.map(val => `${val} GB/s`);

    const plotData = [{
        x: data.labels,
        y: yValuesGB,
        type: 'bar',
        text: textValues,
        textposition: 'auto',
        hoverinfo: 'text',
        marker: {
            color: '#337ab7'
        }
    }];

    const layout = {
        title: '系统峰值内存带宽 (GB/sec)',
        xaxis: { title: '读写比' },
        yaxis: { title: '带宽 (GB/sec)', rangemode: 'tozero' }, // Ensure Y-axis starts at 0
        autosize: true,
        margin: { t: 50, b: 120, l: 80, r: 50 } // Increased bottom margin for labels
    };

    Plotly.newPlot('peakBandwidthsChart', plotData, layout, {responsive: true});
} 