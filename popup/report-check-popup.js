(() => {
  const fillButton = document.querySelector("#report-review-fill");
  const reviewDate = document.querySelector("#report-review-date");
  const status = document.querySelector("#report-check-status");
  const reviewStatus = document.querySelector("#report-review-status");
  const results = document.querySelector("#report-check-results");

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function setReviewStatus(message, isError = false) {
    reviewStatus.textContent = message;
    reviewStatus.classList.toggle("error", isError);
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
      Number(result.references.status === "missing") +
      Number(Object.values(result.formatting).some(({ status: itemStatus }) => itemStatus === "missing"));
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
      { label: "正文表格", ...result.formatting.tables },
      { label: "章节标题编号", ...result.formatting.numbering }
    ]));
  }

  async function checkCurrentReport() {
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
    return { tab, result };
  }

  function showError(error, setter) {
    setter(
      error instanceof Error && error.message.includes("Receiving end does not exist")
        ? "未检测到 VGMS 审核页面脚本，请重新加载扩展并刷新审核列表后重试。"
        : error instanceof Error
          ? error.message
          : "操作失败，请刷新 VGMS 页面后重试。",
      true
    );
  }

  fillButton.addEventListener("click", async () => {
    const date = reviewDate.value;
    if (!date) {
      reviewDate.focus();
      setReviewStatus("请先选择审核日期。", true);
      return;
    }

    fillButton.disabled = true;
    setReviewStatus("正在检查报告并填写审核表单……");
    try {
      const { tab, result } = await checkCurrentReport();
      const decision = globalThis.vgmsReportChecker.createReviewDecision(result);
      const response = await chrome.tabs.sendMessage(tab.id, {
        namespace: "vgms-report-check",
        action: "fill-review",
        payload: { ...decision, date }
      });
      if (!response?.ok) {
        throw new Error(response?.error || "填写审核表单失败。");
      }

      setStatus("检查结果已更新。");
      setReviewStatus(
        `已填写“${response.filled.statusTitle}”、审核意见和日期 ${response.filled.date}。请核对后手动提交。`
      );
    } catch (error) {
      showError(error, setReviewStatus);
    } finally {
      fillButton.disabled = false;
    }
  });
})();
