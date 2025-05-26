function plotCacheToCache(data) {
    const section = document.getElementById('cacheToCacheSection');
    const localCacheDiv = document.getElementById('localCacheLatency');

    if (!data) {
        section.style.display = 'none';
        console.warn('Cache-to-Cache data is missing.');
        return;
    }
    section.style.display = 'block';

    let localHtml = '';
    if (data.localHit) {
        localHtml += `<p>本地 Socket L2->L2 HIT 延迟: <strong>${parseFloat(data.localHit).toFixed(1)} ns</strong></p>`;
    }
    if (data.localHitm) {
        localHtml += `<p>本地 Socket L2->L2 HITM 延迟: <strong>${parseFloat(data.localHitm).toFixed(1)} ns</strong></p>`;
    }
    localCacheDiv.innerHTML = localHtml;

    // Remote HITM (writer homed)
    if (data.remoteHitmWriter && data.remoteHitmWriter.values.length > 0) {
        document.getElementById('remoteCacheHitmW_Chart').style.display = 'block';
        const zW_raw = data.remoteHitmWriter.values;
        const yW = data.remoteHitmWriter.nodes.map(node => `写入方 ${node}`);
        const xW = data.remoteHitmWriter.nodes.map(node => `读取方 ${node}`);

        const zW = zW_raw.map(row => row.map(val => val === null ? null : parseFloat(val.toFixed(1))));
        const textW = zW.map(row => row.map(val => val === null ? 'N/A' : `${val} ns`));

        const plotDataW = [{
            z: zW,
            x: xW,
            y: yW,
            type: 'heatmap',
            colorscale: 'Reds',
            showscale: true,
            zmin: 0,
            text: textW,
            texttemplate: "%{text}",
            hoverinfo: 'text'
        }];
        const layoutW = {
            title: '远端 Socket L2->L2 HITM 延迟 (数据地址归属于写入方)',
            xaxis: { title: '读取方 NUMA 节点' },
            yaxis: { title: '写入方 NUMA 节点', autorange: 'reversed', rangemode: 'tozero' },
            autosize: true,
            margin: { t: 60, b: 100, l: 100, r: 50 }
        };
        Plotly.newPlot('remoteCacheHitmW_Chart', plotDataW, layoutW, {responsive: true});
    } else {
        document.getElementById('remoteCacheHitmW_Chart').style.display = 'none';
    }

    // Remote HITM (reader homed)
    if (data.remoteHitmReader && data.remoteHitmReader.values.length > 0) {
        document.getElementById('remoteCacheHitmR_Chart').style.display = 'block';
        const zR_raw = data.remoteHitmReader.values;
        const yR = data.remoteHitmReader.nodes.map(node => `写入方 ${node}`);
        const xR = data.remoteHitmReader.nodes.map(node => `读取方 ${node}`);

        const zR = zR_raw.map(row => row.map(val => val === null ? null : parseFloat(val.toFixed(1))));
        const textR = zR.map(row => row.map(val => val === null ? 'N/A' : `${val} ns`));

        const plotDataR = [{
            z: zR,
            x: xR,
            y: yR,
            type: 'heatmap',
            colorscale: 'Blues',
            showscale: true,
            zmin: 0,
            text: textR,
            texttemplate: "%{text}",
            hoverinfo: 'text'
        }];
        const layoutR = {
            title: '远端 Socket L2->L2 HITM 延迟 (数据地址归属于读取方)',
            xaxis: { title: '读取方 NUMA 节点' },
            yaxis: { title: '写入方 NUMA 节点', autorange: 'reversed', rangemode: 'tozero' },
            autosize: true,
            margin: { t: 60, b: 100, l: 100, r: 50 }
        };
        Plotly.newPlot('remoteCacheHitmR_Chart', plotDataR, layoutR, {responsive: true});
    } else {
        document.getElementById('remoteCacheHitmR_Chart').style.display = 'none';
    }
} 