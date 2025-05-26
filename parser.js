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

    // 查找包含节点编号的标题行
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "" || line.startsWith("===") || line.startsWith("---N")) continue;

        // 匹配包含节点编号的行
        const nodeHeaderRegex = /(?:Numa node|Reader Numa Node|Writer Numa Node)\s+((?:\s*\d+\s*)+)$/i;
        const nodeMatch = line.match(nodeHeaderRegex);

        if (nodeMatch && nodeMatch[1]) {
            nodes = nodeMatch[1].trim().split(/\s+/).map(n => parseInt(n)).filter(n => !isNaN(n));
            if (nodes.length > 0) {
                dataStartIndex = i + 1;
                // 跳过分隔行
                if (lines[dataStartIndex] && lines[dataStartIndex].trim().match(/^[-=]+$/)) {
                    dataStartIndex++;
                }
                break;
            }
        }
    }

    // 如果没有找到节点编号，尝试从数据行推断
    if (nodes.length === 0) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === "" || line.startsWith("===") || line.startsWith("---N")) continue;
            
            const parts = line.split(/\s+/).filter(p => p !== "");
            if (parts.length > 1 && !isNaN(parseInt(parts[0]))) {
                nodes = Array.from({ length: parts.length - 1 }, (_, k) => k);
                dataStartIndex = i;
                break;
            }
        }
    }

    // 解析矩阵数据
    if (dataStartIndex !== -1) {
        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === "" || line.startsWith("===") || line.startsWith("---N")) {
                if (matrix.length > 0) break;
                continue;
            }
            if (line.toLowerCase().includes("average") || line.toLowerCase().includes("total")) continue;

            const parts = line.split(/\s+/).filter(p => p !== "");
            if (parts.length > 1) {
                // 检查第一个部分是否为数字（行节点ID）
                if (parts[0].match(/^\d+$/)) {
                    const rowData = parts.slice(1).map(val => {
                        if (val === '-' || val === 'N/A') return NaN;
                        const num = parseFloat(val);
                        return isNaN(num) ? NaN : num;
                    });

                    if (rowData.length > 0) {
                        // 确保行数据长度与节点数量匹配
                        if (rowData.length === nodes.length) {
                            matrix.push(rowData);
                        } else if (rowData.length > nodes.length && nodes.length > 0) {
                            matrix.push(rowData.slice(0, nodes.length));
                        }
                    }
                }
            }
        }
    }

    // 确保矩阵维度正确
    if (matrix.length !== nodes.length) {
        console.warn(`Matrix dimensions mismatch: expected ${nodes.length}x${nodes.length}, got ${matrix.length}x${matrix[0]?.length || 0}`);
    }

    return { nodes, matrix };
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
 