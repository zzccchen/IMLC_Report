document.addEventListener('DOMContentLoaded', () => {
    const generateReportBtn = document.getElementById('generateReportBtn');
    const mlcOutputTextarea = document.getElementById('mlcOutput');
    const reportContainer = document.getElementById('reportContainer');
    let activeCharts = {}; // Keep track of Chart.js instances

    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            const outputText = mlcOutputTextarea.value;
            if (!outputText.trim()) {
                alert("请先粘贴MLC输出结果！");
                reportContainer.innerHTML = '<p style="color: orange; text-align: center;">请输入MLC输出内容。</p>';
                return;
            }
            try {
                const parsedData = parseMLCOutput(outputText);
                console.log("Parsed MLC Data:", parsedData); // For debugging
                activeCharts = displayMLCReport(parsedData, reportContainer, activeCharts);
            } catch (error) {
                console.error("Error generating report:", error);
                reportContainer.innerHTML = '<p style="color: red; text-align: center;">生成报告时发生错误。请检查控制台获取更多信息。</p>';
            }
        });
    } else {
        console.error('Generate report button not found.');
    }
}); 