(() => {
  if (window.top !== window) {
    return;
  }

  const namespace = "vgms-report-check";

  function findReportBody() {
    const pending = [document];
    const visited = new Set();
    let foundReportForm = false;

    while (pending.length) {
      const current = pending.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (current.body?.innerText.includes("开题报告内容")) {
        foundReportForm = true;
        const editorFrame = [...current.querySelectorAll("iframe.tox-edit-area__iframe")]
          .find((frame) => {
            try {
              return Boolean(frame.contentDocument?.body?.innerText.trim());
            } catch {
              return false;
            }
          });
        const body = editorFrame?.contentDocument?.body;
        if (body) {
          return body;
        }
      }

      for (const frame of current.querySelectorAll("iframe")) {
        try {
          if (frame.contentDocument) {
            pending.push(frame.contentDocument);
          }
        } catch {
          // Cross-origin frames cannot be inspected; continue looking in accessible frames.
        }
      }
    }

    if (foundReportForm) {
      throw new Error("已找到开题报告表单，但编辑器正文尚未加载，请稍后重试。");
    }
    throw new Error("当前审核弹窗中没有识别到开题报告内容。");
  }

  function extractReport() {
    const body = findReportBody();

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
