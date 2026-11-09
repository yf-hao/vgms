(() => {
  if (window.top !== window || !location.pathname.startsWith("/manage/process/processData/show")) {
    return;
  }

  const namespace = "vgms-report-check";

  function extractReport() {
    if (!document.body?.innerText.includes("开题报告内容")) {
      throw new Error("当前页面没有识别到开题报告内容。");
    }

    const editorFrame = [...document.querySelectorAll("iframe.tox-edit-area__iframe")]
      .find((frame) => {
        try {
          return Boolean(frame.contentDocument?.body?.innerText.trim());
        } catch {
          return false;
        }
      });
    const body = editorFrame?.contentDocument?.body;
    if (!body) {
      throw new Error("未能读取报告编辑器，请确认报告正文已加载。");
    }

    const paragraphs = [...body.querySelectorAll("p")]
      .map((paragraph) => ({
        text: paragraph.innerText || paragraph.textContent || "",
        textIndent: getComputedStyle(paragraph).textIndent
      }));
    const text = body.innerText.trim();
    if (!text) {
      throw new Error("报告正文为空或尚未加载完成。");
    }

    return { text, paragraphs };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.namespace !== namespace || message.action !== "extract") {
      return;
    }

    try {
      sendResponse({ ok: true, report: extractReport() });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "读取报告内容失败。"
      });
    }
  });
})();
