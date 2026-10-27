(() => {
  const mainFormPath = "/manage/subject/subject/modify";
  const isMainForm = location.pathname === mainFormPath;
  const frameId = window.frameElement?.id || "";
  const isDynamicFormFrame = /^subjectDynamicFormIframe(?:_|$)/.test(frameId);

  if (!isMainForm && !isDynamicFormFrame) {
    return;
  }

  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  let fillingBase = false;
  let fillingDynamic = false;
  let lastMessage = "";
  let activePromptKey = "";
  const resolvedOptionIds = new Map();

  function showStatus(message, isError = false) {
    let notice = document.querySelector("#vgms-autofill-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "vgms-autofill-notice";
      Object.assign(notice.style, {
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: "2147483647",
        maxWidth: "min(460px, calc(100vw - 24px))",
        padding: "10px 14px",
        borderRadius: "5px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
        color: "#fff",
        font: "14px/1.5 sans-serif"
      });
      document.body.appendChild(notice);
    }
    notice.style.backgroundColor = isError ? "#b3261e" : "#137333";
    notice.textContent = `VGMS 填写助手：${message}`;
    lastMessage = message;
  }

  function findExactOptions(container, label) {
    return [...container.querySelectorAll(".xm-option-content")]
      .filter((element) => normalize(element.textContent) === label)
      .map((element) => element.closest(".xm-option"))
      .filter((row) => row && !row.classList.contains("disabled"));
  }

  function optionPath(row) {
    const labels = [
      normalize(row.querySelector(".xm-option-content")?.textContent)
    ];
    let tree = row.closest(".xm-tree");

    while (tree?.parentElement?.classList.contains("xm-tree-box")) {
      const treeBox = tree.parentElement;
      const parentRow = treeBox.previousElementSibling;
      const parentLabel =
        parentRow?.querySelector(".xm-option-content")?.textContent;
      if (parentLabel) {
        labels.unshift(normalize(parentLabel));
      }
      tree = treeBox.parentElement?.closest(".xm-tree") || null;
    }

    return labels.filter(Boolean);
  }

  function clearChoicePrompt() {
    document.querySelector("#vgms-autofill-choices")?.remove();
    activePromptKey = "";
  }

  function showChoicePrompt(fieldKey, fieldLabel, label, rows) {
    const promptKey = `${fieldKey}:${label}`;
    if (activePromptKey === promptKey) {
      return;
    }
    clearChoicePrompt();
    activePromptKey = promptKey;
    showStatus(`${fieldLabel}“${label}”有多个匹配项，请按组织路径选择。`, true);

    const panel = document.createElement("div");
    panel.id = "vgms-autofill-choices";
    Object.assign(panel.style, {
      position: "fixed",
      top: "72px",
      right: "12px",
      zIndex: "2147483647",
      width: "min(460px, calc(100vw - 24px))",
      maxHeight: "min(65vh, 520px)",
      overflowY: "auto",
      padding: "12px",
      border: "1px solid #dadce0",
      borderRadius: "6px",
      background: "#fff",
      boxShadow: "0 2px 12px rgba(0, 0, 0, 0.22)",
      color: "#202124",
      font: "14px/1.5 sans-serif"
    });

    const heading = document.createElement("strong");
    heading.textContent = `请选择${fieldLabel}：`;
    panel.appendChild(heading);

    const paths = rows.map(optionPath);
    const pathCounts = new Map();
    for (const path of paths) {
      const key = path.join(" > ");
      pathCounts.set(key, (pathCounts.get(key) || 0) + 1);
    }

    rows.forEach((row, index) => {
      const button = document.createElement("button");
      const path = paths[index].join(" > ");
      const optionId = row.getAttribute("value") || "";
      const needsId = pathCounts.get(path) > 1;
      button.type = "button";
      button.textContent = needsId
        ? `${path}（选项 ${index + 1}，编号 ${optionId || "未知"}）`
        : path;
      Object.assign(button.style, {
        display: "block",
        width: "100%",
        marginTop: "8px",
        padding: "8px",
        border: "1px solid #dadce0",
        borderRadius: "4px",
        background: "#f8f9fa",
        color: "#202124",
        cursor: "pointer",
        textAlign: "left",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        font: "inherit"
      });
      button.addEventListener("click", () => {
        resolvedOptionIds.set(fieldKey, optionId);
        clearChoicePrompt();
        void runFill();
      });
      panel.appendChild(button);
    });

    document.body.appendChild(panel);
  }

  function resolveOption(container, fieldKey, fieldLabel, label) {
    const matches = findExactOptions(container, label);
    if (!matches.length) {
      return {
        error: `${fieldLabel}中没有找到“${label}”，请确认名称或手动选择。`
      };
    }

    const resolvedId = resolvedOptionIds.get(fieldKey);
    const resolvedRow = matches.find(
      (row) => row.getAttribute("value") === resolvedId
    );
    if (resolvedRow) {
      return { row: resolvedRow };
    }
    if (matches.length === 1) {
      return { row: matches[0] };
    }

    showChoicePrompt(fieldKey, fieldLabel, label, matches);
    return { needsChoice: true };
  }

  function hasSelectedValue(container, inputName, optionId, label) {
    const input = container.querySelector(`input[name="${inputName}"]`);
    const selectedLabels = normalize(
      container.querySelector(".xm-label")?.textContent
    );
    return Boolean(
      (optionId && input?.value.includes(optionId)) ||
      selectedLabels.includes(label)
    );
  }

  async function selectOption(container, inputName, label, row) {
    const optionId = row.getAttribute("value");
    if (hasSelectedValue(container, inputName, optionId, label)) {
      return { selected: true };
    }

    const widget = container.querySelector("xm-select");
    if (!widget) {
      return { error: "找不到树形选择组件，请手动选择。" };
    }

    widget.click();
    await sleep(150);

    const current = findExactOptions(container, label).find(
      (option) => option.getAttribute("value") === optionId
    );
    if (!current) {
      return { error: `选择器中的“${label}”选项已变化，请重新尝试。` };
    }

    current.scrollIntoView({ block: "nearest" });
    const iconSelector =
      inputName === "org_ids"
        ? ".xm-option-icon.xm-icon-duox"
        : ".xm-option-icon.xm-icon-danx";
    const optionIcon = current.querySelector(iconSelector);
    if (!optionIcon) {
      return { error: `找不到“${label}”选项的选择图标，请手动选择。` };
    }
    optionIcon.click();

    if (inputName === "org_ids") {
      await sleep(100);
      const confirmButton = [...container.querySelectorAll(".xm-toolbar .toolbar-tag")]
        .find((button) => normalize(button.textContent) === "确定");
      if (!confirmButton) {
        return { error: "找不到课题可选范围选择器中的“确定”按钮，请手动确认。" };
      }
      confirmButton.click();
    }

    const timeoutAt = Date.now() + 2000;
    while (!hasSelectedValue(container, inputName, optionId, label) && Date.now() < timeoutAt) {
      await sleep(100);
    }

    if (!hasSelectedValue(container, inputName, optionId, label)) {
      return {
        error: `已尝试选择“${label}”，但无法确认组件已接受该选项；请检查后手动确认。`
      };
    }
    return { selected: true };
  }

  async function fillBaseForm(stored) {
    if (!isMainForm || fillingBase || !stored.pendingFill || stored.baseFilled) {
      return;
    }
    if (!Array.isArray(stored.formData) || stored.formData.length !== 7) {
      showStatus("请在插件中提供恰好七行内容。", true);
      return;
    }

    const [
      scopeName,
      majorName,
      subjectName,
      sourceName,
      subjectTypeName,
      disciplineName,
      description
    ] = stored.formData;
    if (
      !scopeName ||
      !majorName ||
      !subjectName ||
      !sourceName ||
      !subjectTypeName ||
      !disciplineName ||
      !description
    ) {
      showStatus("七项内容中有空行，请在插件中补全后重新保存。", true);
      return;
    }

    const nameInput = document.querySelector("#name[name='name']");
    const scopeContainer = document.querySelector("#choice-org");
    const majorContainer = document.querySelector("#choice-org2");
    if (!nameInput || !scopeContainer || !majorContainer) {
      return;
    }
    if (nameInput.value.trim() && nameInput.value.trim() !== subjectName) {
      showStatus("课题名称字段已有不同内容，为避免覆盖，本次未填写。", true);
      return;
    }

    const scopeMatch = resolveOption(
      scopeContainer,
      "scope",
      "课题可选范围",
      scopeName
    );
    if (scopeMatch.error) {
      clearChoicePrompt();
      if (scopeMatch.error !== lastMessage) {
        showStatus(scopeMatch.error, true);
      }
      return;
    }
    if (scopeMatch.needsChoice) {
      return;
    }

    const majorMatch = resolveOption(
      majorContainer,
      "major",
      "课题所属专业",
      majorName
    );
    if (majorMatch.error) {
      clearChoicePrompt();
      if (majorMatch.error !== lastMessage) {
        showStatus(majorMatch.error, true);
      }
      return;
    }
    if (majorMatch.needsChoice) {
      return;
    }

    fillingBase = true;
    try {
      const scopeResult = await selectOption(
        scopeContainer,
        "org_ids",
        scopeName,
        scopeMatch.row
      );
      if (scopeResult.error) {
        showStatus(scopeResult.error, true);
        return;
      }

      const majorResult = await selectOption(
        majorContainer,
        "org_id",
        majorName,
        majorMatch.row
      );
      if (majorResult.error) {
        showStatus(majorResult.error, true);
        return;
      }

      nameInput.focus();
      nameInput.value = subjectName;
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));

      await chrome.storage.local.set({ baseFilled: true });
      const progress = stored.batchActive
        ? `当前是第 ${(stored.batchIndex || 0) + 1} 条批量记录。`
        : "";
      showStatus(`${progress}前 3 项已填写；动态表单出现后会继续填写。`);
    } catch (error) {
      showStatus(`填写基础信息时发生错误：${error.message}`, true);
    } finally {
      fillingBase = false;
    }
  }

  function findRadio(form, name, title) {
    return form.querySelector(
      `input[type="radio"][name="${name}"][title="${title}"]`
    );
  }

  async function selectRadio(input) {
    if (input.checked) {
      return true;
    }

    const visualRadio = input.nextElementSibling;
    if (visualRadio?.classList.contains("layui-form-radio")) {
      visualRadio.click();
      await sleep(100);
    }
    if (!input.checked) {
      input.click();
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(100);
    }
    return input.checked;
  }

  async function fillDynamicForm(stored) {
    if (fillingDynamic || !stored.pendingFill || !stored.baseFilled) {
      return;
    }
    if (!Array.isArray(stored.formData) || stored.formData.length !== 7) {
      return;
    }

    const form = document.querySelector("#form_content");
    if (!form) {
      return;
    }

    const [, , , sourceName, subjectTypeName, disciplineName, description] =
      stored.formData;
    const sourceRadio = findRadio(form, "source", sourceName);
    const subjectTypeRadio = findRadio(form, "subjectType", subjectTypeName);
    const disciplineRadio = findRadio(form, "tpltypes", disciplineName);
    const descriptionInput = form.querySelector("#cid_4_widget[name='text1']");
    if (
      !sourceRadio ||
      !subjectTypeRadio ||
      !disciplineRadio ||
      !descriptionInput
    ) {
      return;
    }
    if (
      descriptionInput.value.trim() &&
      descriptionInput.value !== description
    ) {
      showStatus("课题简介已有不同内容，为避免覆盖，本次未填写。", true);
      return;
    }

    fillingDynamic = true;
    try {
      const radios = [
        [sourceRadio, sourceName],
        [subjectTypeRadio, subjectTypeName],
        [disciplineRadio, disciplineName]
      ];
      for (const [radio, label] of radios) {
        if (!(await selectRadio(radio))) {
          showStatus(`未能选择“${label}”，请检查动态表单后手动选择。`, true);
          return;
        }
      }

      descriptionInput.focus();
      descriptionInput.value = description;
      descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));
      descriptionInput.dispatchEvent(new Event("change", { bubbles: true }));

      if (stored.batchActive && Array.isArray(stored.batchQueue)) {
        await chrome.storage.local.set({
          pendingFill: false,
          baseFilled: false,
          batchRecordFilled: true
        });
        const current = (stored.batchIndex || 0) + 1;
        const total = stored.batchQueue.length;
        showStatus(
          current < total
            ? `第 ${current}/${total} 条已填写。检查后点击“确定并继续”处理下一份模板。`
            : `第 ${current}/${total} 条已填写。检查后点击“确定”结束；如点击“确定并继续”，批次不会再填入额外记录。`
        );
      } else {
        await chrome.storage.local.set({
          pendingFill: false,
          baseFilled: false,
          formData: []
        });
        showStatus("七项内容已填写，请检查表单后手动提交。");
      }
    } catch (error) {
      showStatus(`填写动态表单时发生错误：${error.message}`, true);
    } finally {
      fillingDynamic = false;
    }
  }

  async function runFill() {
    if (!document.body) {
      return;
    }
    try {
      const stored = await chrome.storage.local.get([
        "formData",
        "pendingFill",
        "baseFilled",
        "batchActive",
        "batchQueue",
        "batchIndex",
        "batchRecordFilled"
      ]);
      await fillBaseForm(stored);
      await fillDynamicForm(stored);
    } catch (error) {
      showStatus(`读取填写信息时发生错误：${error.message}`, true);
    }
  }

  function start() {
    if (!document.body) {
      return;
    }
    const observer = new MutationObserver(() => {
      void runFill();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    void runFill();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes.pendingFill?.newValue) {
      resolvedOptionIds.clear();
      clearChoicePrompt();
    }
    if (
      changes.pendingFill?.newValue ||
      changes.baseFilled?.newValue ||
      changes.formData ||
      changes.batchIndex
    ) {
      void runFill();
    }
  });
})();
