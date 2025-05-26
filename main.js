document.addEventListener('DOMContentLoaded', () => {
    const generateReportBtn = document.getElementById('generateReportBtn');
    const mlcOutput1Textarea = document.getElementById('mlcOutput1');
    const mlcOutput2Textarea = document.getElementById('mlcOutput2');
    const reportContainer = document.getElementById('reportContainer');
    let activeCharts = {}; // Keep track of Chart.js instances

    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            const outputText1 = mlcOutput1Textarea.value;
            const outputText2 = mlcOutput2Textarea.value;

            if (!outputText1.trim() || !outputText2.trim()) {
                alert("请确保两个输入框都包含MLC输出结果！");
                reportContainer.innerHTML = '<p style="color: orange; text-align: center;">请输入两组MLC输出内容。</p>';
                return;
            }

            try {
                const parsedData1 = parseMLCOutput(outputText1);
                const parsedData2 = parseMLCOutput(outputText2);
                console.log("Parsed MLC Data 1:", parsedData1); // For debugging
                console.log("Parsed MLC Data 2:", parsedData2); // For debugging
                activeCharts = displayMLCComparisonReport(parsedData1, parsedData2, reportContainer, activeCharts);
            } catch (error) {
                console.error("Error generating comparison report:", error);
                reportContainer.innerHTML = '<p style="color: red; text-align: center;">生成对比报告时发生错误。请检查控制台获取更多信息。</p>';
            }
        });
    } else {
        console.error('Generate report button not found.');
    }
}); 