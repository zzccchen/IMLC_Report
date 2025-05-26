function parseMLCOutput(text) {
    const lines = text.split('\n');
    const data = {
        idleLatencies: null,
        peakBandwidths: null,
        interNodeBandwidths: null,
        loadedLatencies: null,
        cacheToCache: null,
        numaNodeCount: 0,
        toolVersion: ""
    };

    let currentSection = null;
    let sectionLines = [];

    const toolVersionRegex = /Intel\(R\) Memory Latency Checker - (v[0-9]+\.[0-9]+[a-zA-Z]?)/;
    const matchVersion = text.match(toolVersionRegex);
    if (matchVersion) {
        data.toolVersion = matchVersion[1];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith("Intel(R) Memory Latency Checker")) {
            continue;
        } else if (line.startsWith("Measuring idle latencies")) {
            currentSection = "idleLatencies";
            sectionLines = [];
        } else if (line.startsWith("Measuring Peak Injection Memory Bandwidths")) {
            currentSection = "peakBandwidths";
            sectionLines = [];
        } else if (line.startsWith("Measuring Memory Bandwidths between nodes")) {
            currentSection = "interNodeBandwidths";
            sectionLines = [];
        } else if (line.startsWith("Measuring Loaded Latencies")) {
            currentSection = "loadedLatencies";
            sectionLines = [];
        } else if (line.startsWith("Measuring cache-to-cache transfer latency")) {
            currentSection = "cacheToCache";
            sectionLines = [];
        }

        if (currentSection) {
            sectionLines.push(line);
            // Determine if the section ends
            let sectionEnd = false;
            if (i + 1 === lines.length) { // End of input
                sectionEnd = true;
            }
            else if (lines[i+1].trim().startsWith("Measuring")) { // Next line starts a new major section
                 sectionEnd = true;
            }
            // For cacheToCache, it might end with a blank line if it's the last section
            else if (currentSection === "cacheToCache" && lines[i+1].trim() === "" && (i + 2 === lines.length || (i + 2 < lines.length && lines[i+2].trim() === ""))){
                sectionEnd = true;
            }
            // Peak bandwidth can have internal blank lines, so it needs to be handled carefully
            // It usually ends when a new "Measuring" section starts or EOF.
            // Other sections usually end if the next line is blank AND the line after that is also blank or starts "Measuring"
            else if (currentSection !== "peakBandwidths" && line.trim() !== "" && (i + 1 < lines.length && lines[i+1].trim() === "")) {
                if (i + 2 === lines.length || (i + 2 < lines.length && (lines[i+2].trim() === "" || lines[i+2].trim().startsWith("Measuring")))) {
                    sectionEnd = true;
                }
            }


            if (sectionEnd) {
                try {
                    if (currentSection === "idleLatencies") {
                        data.idleLatencies = parseMatrixSection(sectionLines, "Numa node", "Numa node");
                        if (data.idleLatencies && data.idleLatencies.nodes && data.idleLatencies.nodes.length > data.numaNodeCount) {
                            data.numaNodeCount = data.idleLatencies.nodes.length;
                        }
                    } else if (currentSection === "peakBandwidths") {
                        data.peakBandwidths = parsePeakBandwidths(sectionLines);
                    } else if (currentSection === "interNodeBandwidths") {
                        data.interNodeBandwidths = parseMatrixSection(sectionLines, "Numa node", "Numa node");
                         if (data.interNodeBandwidths && data.interNodeBandwidths.nodes && data.interNodeBandwidths.nodes.length > data.numaNodeCount) {
                            data.numaNodeCount = data.interNodeBandwidths.nodes.length;
                        }
                    } else if (currentSection === "loadedLatencies") {
                        data.loadedLatencies = parseLoadedLatencies(sectionLines);
                    } else if (currentSection === "cacheToCache") {
                        data.cacheToCache = parseCacheToCache(sectionLines, data.numaNodeCount);
                    }
                } catch (e) {
                    console.error(`Error parsing section ${currentSection}:`, e, "Lines for section:", sectionLines.join('\n'));
                }
                currentSection = null; 
                sectionLines = [];
            }
        }
    }
    return data;
}

function parseMatrixSection(lines, header1Keyword, header2Keyword) {
    const matrix = [];
    let nodes = [];
    let dataStartIndex = -1;
    let headerLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "" || line.startsWith("===") || line.startsWith("---N")) continue;

        // Try to find a line that contains column headers (NUMA nodes)
        // Regex looks for multiple numbers separated by spaces, possibly after header keywords.
        const nodeHeaderRegex = new RegExp(`(?:${header1Keyword}|${header2Keyword}|Socket|Node|From\\\\To|Reader Numa Node|Writer Numa Node)?\\s*((?:\\s*\\d+\\s*)+)$`, 'i');
        const nodeMatch = line.match(nodeHeaderRegex);

        if (nodeMatch && nodeMatch[1]) {
            const potentialNodes = nodeMatch[1].trim().split(/\\s+/).map(n => parseInt(n)).filter(n => !isNaN(n));
            if (potentialNodes.length > 0) {
                nodes = potentialNodes;
                headerLineIndex = i;
                dataStartIndex = i + 1;
                // Skip separator line if present
                if (lines[dataStartIndex] && (lines[dataStartIndex].trim().match(/^[-=]+$/) || lines[dataStartIndex].trim().includes("latency") || lines[dataStartIndex].trim().includes("Bandwidth"))) {
                    dataStartIndex++;
                }
                break; // Found header, proceed to data parsing
            }
        }
    }
    
    // Fallback if nodes array is still empty (e.g. headers like "Reader Numa Node   0      1   ")
    if (nodes.length === 0) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if(line.toLowerCase().includes(header1Keyword.toLowerCase()) || line.toLowerCase().includes(header2Keyword.toLowerCase())){
                 const parts = line.split(/\\s+/);
                 const potentialNodes = parts.slice(1).map(p => parseInt(p)).filter(p => !isNaN(p));
                 if(potentialNodes.length > 0){
                     nodes = potentialNodes;
                     headerLineIndex = i;
                     dataStartIndex = i + 1;
                     if (lines[dataStartIndex] && lines[dataStartIndex].trim().match(/^[-=]+$/)) dataStartIndex++;
                     break;
                 }
            }
        }
    }

    if (dataStartIndex === -1) { // No clear header or data start found
        // Try to find the first line that looks like data (NodeID val val val ...)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(/\\s+/).filter(p => p !== "");
            if (parts.length > 1 && parts[0].match(/^\\d+$/) && (parts.slice(1).every(p => !isNaN(parseFloat(p)) || p === '-' || p === 'N/A'))) {
                dataStartIndex = i;
                // Infer nodes if not found
                if (nodes.length === 0) {
                    nodes = Array.from({length: parts.length - 1}, (_, k) => k);
                }
                break;
            }
        }
        if (dataStartIndex === -1 && lines.some(l => l.match(/[-\d.]+/))) { // if still no start, but some numbers exist, assume data starts from line 0 and nodes are 0,1,2...
            dataStartIndex = 0;
        }
    }

    if (dataStartIndex !== -1) {
        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === "" || line.startsWith("===") || line.startsWith("---N")) {
                if (matrix.length > 0) break; // Stop if we have some matrix data and hit a separator/empty line
                else continue;
            }
            if (line.toLowerCase().includes("average") || line.toLowerCase().includes("total")) continue;

            const parts = line.split(/\\s+/).filter(p => p !== "");
            let rowData = [];

            // Check if the first part is a number (likely the row's NUMA node ID)
            if (parts.length > 0 && parts[0].match(/^\\d+$/)) {
                //const rowNodeId = parseInt(parts[0]);
                rowData = parts.slice(1).map(val => (val === '-' || val === 'N/A') ? NaN : parseFloat(val));
            } else if (parts.length > 0 && parts.every(p => !isNaN(parseFloat(p)) || p === '-' || p === 'N/A')) {
                // No explicit row header node, all parts are data
                rowData = parts.map(val => (val === '-' || val === 'N/A') ? NaN : parseFloat(val));
            }

            if (rowData.length > 0) {
                if (nodes.length === 0) { // Infer nodes from the first valid data row if not found in header
                    nodes = Array.from({ length: rowData.length }, (_, k) => k);
                }
                // Ensure rowData matches the number of node columns, truncate if necessary
                if (rowData.length > nodes.length && nodes.length > 0) {
                    matrix.push(rowData.slice(0, nodes.length));
                } else if (rowData.length === nodes.length) {
                    matrix.push(rowData);
                }
            }
        }
    }
    
    // Final validation: if nodes were inferred but matrix columns differ, adjust nodes
    if (matrix.length > 0 && matrix[0].length > 0 && nodes.length !== matrix[0].length) {
        if (nodes.every((val, index) => val === index)) { // Check if nodes are default 0,1,2...
             nodes = Array.from({length: matrix[0].length}, (_, k) => k);
        } else {
            console.warn("Mismatch between parsed node headers and matrix columns. Matrix columns will be prioritized for node count if nodes were default.", header1Keyword, nodes, matrix[0]);
        }
    }
    // Filter matrix again to ensure all rows match the final node count
    const finalMatrix = matrix.filter(row => row.length === nodes.length);

    return { nodes, matrix: finalMatrix };
}

function parsePeakBandwidths(lines) {
    const bandwidths = [];
    const regex = /^(.*?\S+.*?)\s*:\s*([0-9.]+)\s*(?:MB\/sec)?/i;
    let startParsing = false;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!startParsing && (trimmedLine.toLowerCase().includes("peak memory bandwidths") || 
            trimmedLine.toLowerCase().includes("read-write ratios") ||
            trimmedLine.match(regex))) {
            startParsing = true;
        }

        if (!startParsing || trimmedLine === "" || trimmedLine.startsWith("===") || trimmedLine.startsWith("---")) {
            if (startParsing && bandwidths.length > 0 && trimmedLine === "") break; 
            continue;
        }
        
        const match = trimmedLine.match(regex);
        if (match) {
            let label = match[1].trim();
            label = label.replace(/\s*\(.*?\)/gi, "").trim(); // Remove content in parentheses
            if (label.endsWith("MB/sec")) label = label.substring(0, label.length - "MB/sec".length).trim();
            bandwidths.push({ label: label, value: parseFloat(match[2]) });
        }
    }
    return bandwidths;
}

function parseLoadedLatencies(lines) {
    const latencies = [];
    let headerFound = false;
    const headerRegex = /Inject(?:\s+Delay)?\s+Latency(?:\s+Cycles)?\s+Bandwidth/i;
    const dataRegex = /^(\d+)\s+([0-9.]+)\s+(?:[0-9.]+\s+)?([0-9.]+)/; 

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (headerRegex.test(trimmedLine)) {
            headerFound = true;
            continue;
        }
        if (trimmedLine.startsWith("======") || trimmedLine === "") {
            if (headerFound && latencies.length > 0 && trimmedLine === "") break; // Stop if section ended
            continue;
        }
        if (!headerFound) continue;

        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 3 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1])) && !isNaN(parseFloat(parts[parts.length-1]))) {
             latencies.push({
                delay: parseInt(parts[0]),
                latency: parseFloat(parts[1]),
                bandwidth: parseFloat(parts[parts.length-1]) 
            });
        } else {
            const match = trimmedLine.match(dataRegex);
             if (match) {
                latencies.push({
                    delay: parseInt(match[1]),
                    latency: parseFloat(match[2]),
                    bandwidth: parseFloat(match[3])
                });
            }
        }
    }
    return latencies;
}

function parseCacheToCache(lines, numaNodeCount = 0) {
    const data = {
        localHit: NaN,
        localHitm: NaN,
        remoteHitmWriterHomed: {nodes: [], matrix: []},
        remoteHitmReaderHomed: {nodes: [], matrix: []}
    };

    let currentSubSectionMatrixLines = [];
    let currentSubSectionType = null;
    let linesForCurrentMatrix = [];

    function processSubSection() {
        if (currentSubSectionType && linesForCurrentMatrix.length > 0) {
            const parsedMatrix = parseMatrixSection(linesForCurrentMatrix, "Reader Numa Node", "Writer Numa Node");
            data[currentSubSectionType] = parsedMatrix;
            // If parsedMatrix.nodes is empty but we have a numaNodeCount and the matrix columns match, populate nodes.
            if (parsedMatrix && parsedMatrix.nodes.length === 0 && numaNodeCount > 0 && 
                parsedMatrix.matrix.length > 0 && parsedMatrix.matrix[0].length === numaNodeCount) {
                 data[currentSubSectionType].nodes = Array.from({length: numaNodeCount}, (_,k) => k);
            }
        }
        linesForCurrentMatrix = [];
        currentSubSectionType = null;
    }

    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i].trim();

        if (line.startsWith("Local Socket L2->L2 HIT  latency")) {
            processSubSection(); 
            const parts = line.split(/\s+/);
            data.localHit = parseFloat(parts.pop());
        } else if (line.startsWith("Local Socket L2->L2 HITM latency")) {
            processSubSection(); 
            const parts = line.split(/\s+/);
            data.localHitm = parseFloat(parts.pop());
        } else if (line.includes("Remote Socket L2->L2 HITM latency")) {
            processSubSection(); 
            if (line.includes("(data address homed in writer socket)")) {
                currentSubSectionType = "remoteHitmWriterHomed";
            } else if (line.includes("(data address homed in reader socket)")) {
                currentSubSectionType = "remoteHitmReaderHomed";
            }
            linesForCurrentMatrix.push(line); // Add the header line itself to be parsed by parseMatrixSection
        } else if (currentSubSectionType) {
            if (line.startsWith("Local Socket") || 
                (line === "" && linesForCurrentMatrix.length > 0 && lines[i-1] && lines[i-1].trim() === "") ||
                (line === "" && linesForCurrentMatrix.length > 0 && i+1 < lines.length && lines[i+1].trim().startsWith("Remote Socket"))
               ) {
                processSubSection();
                // Re-check current line if it started a new local section
                if (line.startsWith("Local Socket L2->L2 HIT  latency")) {data.localHit = parseFloat(line.split(/\s+/).pop());}
                if (line.startsWith("Local Socket L2->L2 HITM latency")) {data.localHitm = parseFloat(line.split(/\s+/).pop());}
            } else if (line !== "") { // Only add non-empty lines to the matrix lines
                 linesForCurrentMatrix.push(line);
            }
        }
    }
    processSubSection(); // Process any remaining subsection

    return data;
}
 