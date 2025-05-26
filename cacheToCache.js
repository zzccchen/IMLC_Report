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
        localHtml += `<p>本地 Socket L2->L2 HIT 延迟: <strong>${data.localHit} ns</strong></p>`;
    }
    if (data.localHitm) {
        localHtml += `<p>本地 Socket L2->L2 HITM 延迟: <strong>${data.localHitm} ns</strong></p>`;
    }
    localCacheDiv.innerHTML = localHtml;

    // Remote HITM (writer homed)
    if (data.remoteHitmWriter && data.remoteHitmWriter.values.length > 0) {
        document.getElementById('remoteCacheHitmW_Chart').style.display = 'block';
        const zW = data.remoteHitmWriter.values;
        const yW = data.remoteHitmWriter.nodes.map(node => `写入方 ${node}`);
        const xW = data.remoteHitmWriter.nodes.map(node => `读取方 ${node}`);

        const plotDataW = [{
            z: zW,
            x: xW,
            y: yW,
            type: 'heatmap',
            colorscale: 'Reds',
            showscale: true,
            text: zW.map(row => row.map(val => val === null ? 'N/A' : `${val} ns`)),
            hoverinfo: 'text'
        }];
        const layoutW = {
            title: '远端 Socket L2->L2 HITM 延迟 (数据地址归属于写入方)',
            xaxis: { title: '读取方 NUMA 节点' },
            yaxis: { title: '写入方 NUMA 节点', autorange: 'reversed' },
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
        const zR = data.remoteHitmReader.values;
        const yR = data.remoteHitmReader.nodes.map(node => `写入方 ${node}`);
        const xR = data.remoteHitmReader.nodes.map(node => `读取方 ${node}`);

        const plotDataR = [{
            z: zR,
            x: xR,
            y: yR,
            type: 'heatmap',
            colorscale: 'Blues',
            showscale: true,
            text: zR.map(row => row.map(val => val === null ? 'N/A' : `${val} ns`)),
            hoverinfo: 'text'
        }];
        const layoutR = {
            title: '远端 Socket L2->L2 HITM 延迟 (数据地址归属于读取方)',
            xaxis: { title: '读取方 NUMA 节点' },
            yaxis: { title: '写入方 NUMA 节点', autorange: 'reversed' },
            autosize: true,
            margin: { t: 60, b: 100, l: 100, r: 50 }
        };
        Plotly.newPlot('remoteCacheHitmR_Chart', plotDataR, layoutR, {responsive: true});
    } else {
        document.getElementById('remoteCacheHitmR_Chart').style.display = 'none';
    }
} 