(() => {
  if (window.top !== window) {
    return;
  }

  const namespace = "vgms-report-check";

  function* accessibleDocuments() {
    const pending = [document];
    const visited = new Set();

    while (pending.length) {
      const current = pending.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);
      yield current;

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
  }

  function findReportBody() {
    let foundReportForm = false;
    for (const current of accessibleDocuments()) {
      if (!current.body?.innerText.includes("开题报告内容")) {
        continue;
      }
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
    const tables = [...body.querySelectorAll("table")].map((table) => {
      const tableText = table.innerText || table.textContent || "";
      return {
        rows: table.rows.length,
        columns: Math.max(0, ...[...table.rows].map((row) => row.cells.length)),
        containsNarrative:
          !table.querySelector("table") &&
          /研究意义|研究(?:（设计）|\(设计\))?的目的|文献综述|研究思路|研究方法|研究内容|预期成果|时间安排/.test(tableText)
      };
    });
    const text = body.innerText.trim();
    if (!text) {
      throw new Error("报告正文为空或尚未加载完成。");
    }

    return { text, paragraphs, tables };
  }

  function findReviewForm() {
    for (const current of accessibleDocuments()) {
      const statusRadios = [...current.querySelectorAll('input[type="radio"][name="status"]')];
      const commentField = current.querySelector('textarea[name="content"]');
      const dateField = current.querySelector('input[name="time1"]');
      if (
        statusRadios.some((radio) => radio.title === "通过") &&
        statusRadios.some((radio) => radio.title === "不通过") &&
        commentField &&
        dateField
      ) {
        return { statusRadios, commentField, dateField };
      }
    }
    throw new Error("未找到审核状态、审核意见或审核时间字段，请确认审核弹窗已打开。");
  }

  function dispatchFieldEvent(field, type) {
    const EventConstructor = field.ownerDocument.defaultView.Event;
    field.dispatchEvent(new EventConstructor(type, { bubbles: true }));
  }

  function setFieldValue(field, value) {
    field.focus();
    field.value = value;
    dispatchFieldEvent(field, "input");
    dispatchFieldEvent(field, "change");
    field.blur();
    return field.value === value;
  }

  function selectStatus(radio) {
    if (!radio.checked) {
      const visualRadio = radio.nextElementSibling;
      if (visualRadio?.classList.contains("layui-form-radio")) {
        visualRadio.click();
      }
      if (!radio.checked) {
        radio.click();
      }
      dispatchFieldEvent(radio, "change");
    }
    return radio.checked;
  }

  function fillReviewForm(payload) {
    if (!["通过", "不通过"].includes(payload?.statusTitle)) {
      throw new Error("审核状态无效。");
    }
    if (typeof payload?.comment !== "string" || !payload.comment.trim()) {
      throw new Error("审核意见不能为空。");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload?.date || "")) {
      throw new Error("请先在插件中选择有效的审核日期。");
    }

    const { statusRadios, commentField, dateField } = findReviewForm();
    const statusRadio = statusRadios.find((radio) => radio.title === payload.statusTitle);
    if (!statusRadio) {
      throw new Error(`审核表单中没有“${payload.statusTitle}”选项。`);
    }

    const dateSet = setFieldValue(dateField, payload.date);
    const commentSet = setFieldValue(commentField, payload.comment);
    const statusSet = selectStatus(statusRadio);
    if (!dateSet || !commentSet || !statusSet) {
      throw new Error("部分审核字段未能成功填写，请检查审核表单后手动补全。");
    }

    return { statusTitle: payload.statusTitle, date: payload.date };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.namespace !== namespace) {
      return;
    }

    try {
      if (message.action === "extract") {
        sendResponse({ ok: true, report: extractReport() });
      } else if (message.action === "fill-review") {
        sendResponse({ ok: true, filled: fillReviewForm(message.payload) });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "读取报告内容失败。"
      });
    }
  });
})();
