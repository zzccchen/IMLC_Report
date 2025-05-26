document.addEventListener('DOMContentLoaded', () => {
    const generateReportBtn = document.getElementById('generateReportBtn');
    const mlcOutputEl = document.getElementById('mlcOutput');

    generateReportBtn.addEventListener('click', () => {
        const mlcOutput = mlcOutputEl.value.trim();
        if (!mlcOutput) {
            alert('请输入 MLC 输出内容！');
            return;
        }
        try {
            const parsedData = parseMLCOutput(mlcOutput);
            
            plotIdleLatencies(parsedData.idleLatencies);
            plotPeakBandwidths(parsedData.peakBandwidths);
            plotNodeBandwidths(parsedData.nodeBandwidths);
            plotLoadedLatencies(parsedData.loadedLatencies);
            plotCacheToCache(parsedData.cacheToCache);

        } catch (error) {
            console.error("解析或绘图时发生错误:", error);
            alert(`处理数据时出错: ${error.message}`);
        }
    });

    function parseMLCOutput(output) {
        const lines = output.split('\n').map(line => line.trim());
        const data = {
            idleLatencies: { nodes: [], values: [] },
            peakBandwidths: { labels: [], values: [] },
            nodeBandwidths: { nodes: [], values: [] },
            loadedLatencies: { delays: [], latencies: [], bandwidths: [] },
            cacheToCache: {
                localHit: null,
                localHitm: null,
                remoteHitmWriter: { nodes: [], values: [] },
                remoteHitmReader: { nodes: [], values: [] }
            }
        };

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            if (line.includes('Measuring idle latencies for random access')) {
                i = parseMatrixData(lines, i + 2, data.idleLatencies, true, parseFloat);
                // console.log("Parsed idleLatencies:", JSON.stringify(data.idleLatencies));
            } else if (line.includes('Measuring Peak Injection Memory Bandwidths')) {
                i = parsePeakBandwidths(lines, i, data.peakBandwidths);
                // console.log("Parsed peakBandwidths:", JSON.stringify(data.peakBandwidths));
            } else if (line.includes('Measuring Memory Bandwidths between nodes')) {
                i = parseMatrixData(lines, i + 3, data.nodeBandwidths, true, parseFloat);
                 // console.log("Parsed nodeBandwidths:", JSON.stringify(data.nodeBandwidths));
            } else if (line.includes('Measuring Loaded Latencies for the system')) {
                i = parseLoadedLatencies(lines, i, data.loadedLatencies);
                // console.log("Parsed loadedLatencies:", JSON.stringify(data.loadedLatencies));
            } else if (line.includes('Measuring cache-to-cache transfer latency')) {
                i = parseCacheToCache(lines, i, data.cacheToCache);
                // console.log("Parsed cacheToCache:", JSON.stringify(data.cacheToCache));
            }
            i++;
        }
        return data;
    }

    function parseMatrixData(lines, startIndex, targetObject, nodesInHeader = true, valueParser = parseFloat) {
        let i = startIndex;
        // Get node headers if present
        const headerLine = lines[i];
        targetObject.nodes = headerLine.split(/\s+/).filter(s => s && !isNaN(s)).map(Number);
        i++;

        while (i < lines.length && lines[i] && !isNaN(lines[i].trim().split(/\s+/)[0])) {
            const parts = lines[i].trim().split(/\s+/);
            const rowNode = parseInt(parts[0]);
            // if (nodesInHeader) targetObject.nodes.add(rowNode); // Assuming nodes are consistent
            const rowValues = parts.slice(1).map(val => val === '-' ? null : valueParser(val));
            targetObject.values.push(rowValues);
            i++;
        }
        return i -1; // Return the last processed line index
    }
    
    function parsePeakBandwidths(lines, startIndex, targetObject) {
        let i = startIndex;
        while (i < lines.length) {
            const currentLine = lines[i];
            let parsedThisLine = false;

            if (currentLine.includes('ALL Reads') || 
                currentLine.match(/^\d+:\d+ Reads-Writes/) || 
                currentLine.includes('Stream-triad like')) {
                
                const lastColonIndex = currentLine.lastIndexOf(':');
                if (lastColonIndex > -1) {
                    const label = currentLine.substring(0, lastColonIndex).trim();
                    // Extract value: take part after colon, trim, then take first part if there are units like "MB/s"
                    const valueString = currentLine.substring(lastColonIndex + 1).trim().split(/\s+/)[0];
                    const value = parseFloat(valueString);
                    
                    if (!isNaN(value)) {
                        targetObject.labels.push(label);
                        targetObject.values.push(value);
                        parsedThisLine = true;
                    } else {
                        console.warn(`PeakBandwidths: Failed to parse numeric value for label "${label}" from "${currentLine.substring(lastColonIndex + 1).trim()}"`);
                    }
                } else {
                     console.warn(`PeakBandwidths: Colon delimiter not found in expected data line: "${currentLine}"`);
                }

                if (currentLine.includes('Stream-triad like')) {
                    break; // This is typically the last item in this section
                }
            } else if (targetObject.labels.length > 0 && currentLine.trim() !== '' && !currentLine.startsWith('-') && !currentLine.toLowerCase().includes('memory bandwidths')) {
                // If we have already parsed some data and the current line doesn't look like part of this data set,
                // (e.g. not empty, not a separator, not another header) it's likely the end of the section.
                // This helps prevent reading into subsequent unrelated data if "Stream-triad like" is missing.
                // console.log(`PeakBandwidths: Stopping, encountered non-data line after collecting some data: "${currentLine}"`);
                break; 
            }
            
            i++;
        }
        console.log("Parsed peakBandwidths in parsePeakBandwidths:", JSON.stringify(targetObject));
        return i;
    }

    function parseLoadedLatencies(lines, startIndex, targetObject) {
        let i = startIndex;
        // Skip until header
        while (i < lines.length && !lines[i].startsWith('Delay   (ns)    MB/sec')) {
            i++;
        }
        i++; // Skip header
        i++; // Skip ===== line

        while (i < lines.length && lines[i] && lines[i].trim() !== '') {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length === 3) {
                targetObject.delays.push(parseInt(parts[0]));
                targetObject.latencies.push(parseFloat(parts[1]));
                targetObject.bandwidths.push(parseFloat(parts[2]));
            } else {
                break; // End of data or malformed line
            }
            i++;
        }
        return i -1;
    }

    function parseCacheToCache(lines, startIndex, targetObject) {
        let i = startIndex;
        while (i < lines.length) {
            const line = lines[i];
            if (line.includes('Local Socket L2->L2 HIT  latency')) {
                targetObject.localHit = parseFloat(line.split(/\s+/).pop());
            } else if (line.includes('Local Socket L2->L2 HITM latency')) {
                targetObject.localHitm = parseFloat(line.split(/\s+/).pop());
            } else if (line.includes('Remote Socket L2->L2 HITM latency (data address homed in writer socket)')) {
                i = parseMatrixData(lines, i + 2, targetObject.remoteHitmWriter, true, (val) => val === '-' ? null : parseFloat(val));
            } else if (line.includes('Remote Socket L2->L2 HITM latency (data address homed in reader socket)')) {
                i = parseMatrixData(lines, i + 2, targetObject.remoteHitmReader, true, (val) => val === '-' ? null : parseFloat(val));
                break; // Assume this is the last part of cache-to-cache
            }
            i++;
        }
        return i;
    }
}); 