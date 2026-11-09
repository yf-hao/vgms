(() => {
  const runButton = document.querySelector("#report-check-run");
  const status = document.querySelector("#report-check-status");
  const results = document.querySelector("#report-check-results");

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function appendText(parent, tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) {
      element.className = className;
    }
    parent.appendChild(element);
    return element;
  }

  function addItem(list, label, statusValue, message, evidence = "") {
    const item = document.createElement("li");
    item.className = "report-check-item";
    item.dataset.status = statusValue;
    appendText(item, "strong", `${statusValue === "pass" ? "✓" : statusValue === "missing" ? "✕" : "!"} ${label}`);
    appendText(item, "p", message);
    if (evidence) {
      appendText(item, "p", `依据：${evidence}`);
    }
    list.appendChild(item);
  }

  function renderGroup(title, items) {
    const group = document.createElement("section");
    group.className = "report-check-group";
    appendText(group, "h2", title);
    const list = document.createElement("ul");
    list.className = "report-check-list";
    for (const item of items) {
      addItem(list, item.label, item.status, item.message, item.evidence);
    }
    group.appendChild(list);
    return group;
  }

  function render(result) {
    results.replaceChildren();
    results.hidden = false;

    const missingCount =
      result.sections.filter(({ status: itemStatus }) => itemStatus === "missing").length +
      Number(result.references.status === "missing");
    const summary = document.createElement("p");
    summary.className = `report-check-summary${result.status === "needs-attention" ? " needs-attention" : ""}`;
    summary.textContent = result.status === "pass"
      ? "检查完成：未发现明显缺项或格式问题。"
      : `检查完成：${missingCount ? `有 ${missingCount} 项需补充` : "发现格式提醒"}。`;
    results.appendChild(summary);
    results.appendChild(renderGroup("内容完整性", result.sections));
    results.appendChild(renderGroup("参考文献", [{
      label: "引用与参考文献",
      ...result.references,
      evidence: result.references.citedNumbers.length
        ? `正文引用编号：${result.references.citedNumbers.join("、")}`
        : ""
    }]));
    results.appendChild(renderGroup("格式检查", [
      { label: "顶格填写", ...result.formatting.indentation },
      { label: "空白段落", ...result.formatting.blankParagraphs },
      { label: "章节编号", ...result.formatting.numbering }
    ]));
  }

  runButton.addEventListener("click", async () => {
    runButton.disabled = true;
    results.hidden = true;
    setStatus("正在读取并检查当前报告……");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error("未找到当前浏览器标签页。");
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        namespace: "vgms-report-check",
        action: "extract"
      });
      if (!response?.ok) {
        throw new Error(response?.error || "读取报告内容失败。");
      }

      const result = globalThis.vgmsReportChecker.check(response.report);
      render(result);
      setStatus("检查结果仅在本地生成；如修改了正文，请重新检查。");
    } catch (error) {
      setStatus(
        error instanceof Error && error.message.includes("Receiving end does not exist")
          ? "未检测到开题报告页面，请打开 VGMS 的开题报告页面后重试。"
          : error instanceof Error
            ? error.message
            : "检查失败，请刷新 VGMS 页面后重试。",
        true
      );
    } finally {
      runButton.disabled = false;
    }
  });
})();
