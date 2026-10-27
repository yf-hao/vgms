const textarea = document.querySelector("#form-data");
const status = document.querySelector("#status");
const saveButton = document.querySelector("#save");
const cancelButton = document.querySelector("#cancel");
const templateFile = document.querySelector("#template-file");
const templateFolder = document.querySelector("#template-folder");
const templatePicker = document.querySelector("#template-picker");
const templatePickerButton = document.querySelector("#template-picker-button");
const templatePickerMenu = document.querySelector("#template-picker-menu");
const importSingleButton = document.querySelector("#import-single");
const importFolderButton = document.querySelector("#import-folder");
const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
let batchTemplates = null;

function closeTemplatePicker() {
  templatePickerMenu.hidden = true;
  templatePickerButton.setAttribute("aria-expanded", "false");
}

templatePickerButton.addEventListener("click", () => {
  const isOpen = !templatePickerMenu.hidden;
  templatePickerMenu.hidden = isOpen;
  templatePickerButton.setAttribute("aria-expanded", String(!isOpen));
});

importSingleButton.addEventListener("click", () => {
  closeTemplatePicker();
  templateFile.click();
});

importFolderButton.addEventListener("click", () => {
  closeTemplatePicker();
  templateFolder.click();
});

document.addEventListener("click", (event) => {
  if (!templatePicker.contains(event.target)) {
    closeTemplatePicker();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !templatePickerMenu.hidden) {
    closeTemplatePicker();
    templatePickerButton.focus();
  }
});

function activateTab(selectedTab, focus = false) {
  for (const tab of tabs) {
    const isSelected = tab === selectedTab;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  }
  for (const panel of panels) {
    panel.hidden = panel.id !== selectedTab.getAttribute("aria-controls");
  }
  if (focus) {
    selectedTab.focus();
  }
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) {
      return;
    }
    event.preventDefault();
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    activateTab(tabs[nextIndex], true);
  });
});

const fieldNames = [
  "课题可选范围",
  "所属专业",
  "课题名称",
  "课题来源",
  "课题类型",
  "文科/理科",
  "课题简介"
];
const headingAliases = new Map([
  ["课题可选范围", 0],
  ["所属专业", 1],
  ["课题所属专业", 1],
  ["课题名称", 2],
  ["课题来源", 3],
  ["课题类型", 4],
  ["文科/理科", 5],
  ["文科／理科", 5],
  ["课题简介", 6]
]);

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function normalizeSection(value) {
  const lines = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u3000]+/g, " ").trim());
  const paragraphs = [];
  let currentParagraph = [];

  for (const line of lines) {
    if (line) {
      currentParagraph.push(line);
    } else if (currentParagraph.length) {
      paragraphs.push(currentParagraph.join(" "));
      currentParagraph = [];
    }
  }
  if (currentParagraph.length) {
    paragraphs.push(currentParagraph.join(" "));
  }

  return paragraphs.join("\n");
}

function parseMarkdownTemplate(markdown) {
  const sections = Array(fieldNames.length).fill("");
  let currentIndex = -1;
  let duplicateHeading = "";

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const normalizedHeading = heading[1].replace(/\s+/g, "");
      currentIndex = headingAliases.get(normalizedHeading) ?? -1;
      if (currentIndex >= 0 && sections[currentIndex]) {
        duplicateHeading = fieldNames[currentIndex];
      }
      continue;
    }
    if (currentIndex >= 0) {
      sections[currentIndex] += `${sections[currentIndex] ? "\n" : ""}${line}`;
    }
  }

  if (duplicateHeading) {
    throw new Error(`标题“${duplicateHeading}”重复，请检查模板。`);
  }

  const values = sections.map(normalizeSection);
  const missingFields = fieldNames.filter((_, index) => !values[index]);
  if (missingFields.length) {
    throw new Error(`以下标题下没有内容或标题缺失：${missingFields.join("、")}`);
  }
  return values;
}

function parseTextFields(value) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const firstSix = lines.slice(0, 6).map((line) => line.trim());
  const description = lines.slice(6).join("\n").trim();
  const values = [...firstSix, description];

  if (firstSix.some((line) => !line) || !description) {
    throw new Error("请填写前六项，并在第七项填写课题简介。");
  }
  return values;
}

async function loadSavedData() {
  try {
    const stored = await chrome.storage.local.get([
      "pendingFill",
      "batchActive",
      "batchQueue",
      "batchIndex",
      "awaitingNext"
    ]);
    if (stored.batchActive) {
      const total = stored.batchQueue?.length || 0;
      showStatus(
        stored.awaitingNext
          ? `批量填报等待下一张表单（${(stored.batchIndex || 0) + 1}/${total}）。`
          : `批量填报进行中（${(stored.batchIndex || 0) + 1}/${total}）。`
      );
    } else if (stored.pendingFill) {
      showStatus("已保存，等待课题申报表单。");
    }
  } catch (error) {
    showStatus(`读取失败：${error.message}`, true);
  }
}

templateFile.addEventListener("change", async () => {
  const file = templateFile.files?.[0];
  if (!file) {
    return;
  }
  batchTemplates = null;
  templateFolder.value = "";
  saveButton.textContent = "保存并等待填表";
  showStatus("");
  try {
    const values = parseMarkdownTemplate(await file.text());
    textarea.value = values.join("\n");
  } catch (error) {
    showStatus(`模板读取失败：${error.message}`, true);
  } finally {
    templateFile.value = "";
  }
});

templateFolder.addEventListener("change", async () => {
  const files = [...(templateFolder.files || [])]
    .filter((file) => file.name.toLowerCase().endsWith(".md"))
    .sort((left, right) =>
      (left.webkitRelativePath || left.name).localeCompare(
        right.webkitRelativePath || right.name,
        "zh-CN",
        { numeric: true, sensitivity: "base" }
      )
    );
  templateFolder.value = "";
  templateFile.value = "";
  batchTemplates = null;
  saveButton.textContent = "保存并等待填表";

  if (!files.length) {
    showStatus("所选文件夹中没有 Markdown（.md）文件。", true);
    return;
  }

  try {
    const imported = [];
    for (const file of files) {
      try {
        imported.push({
          fileName: file.webkitRelativePath || file.name,
          formData: parseMarkdownTemplate(await file.text())
        });
      } catch (error) {
        throw new Error(`${file.webkitRelativePath || file.name}：${error.message}`);
      }
    }

    batchTemplates = imported;
    textarea.value = imported[0].formData.join("\n");
    saveButton.textContent = `开始批量填报（${imported.length}）`;
    showStatus(
      `已读取 ${imported.length} 个模板，按文件名自然排序；预览第一份，检查后开始批量填报。`
    );
  } catch (error) {
    textarea.value = "";
    showStatus(`文件夹读取失败：${error.message}`, true);
  }
});

textarea.addEventListener("input", () => {
  if (!batchTemplates) {
    return;
  }
  batchTemplates = null;
  saveButton.textContent = "保存并等待填表";
  showStatus("内容已编辑，已退出文件夹批量模式；当前将作为单条课题填报。");
});

saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  try {
    if (batchTemplates?.length) {
      await chrome.storage.local.set({
        formData: batchTemplates[0].formData,
        pendingFill: true,
        baseFilled: false,
        batchActive: true,
        batchQueue: batchTemplates,
        batchIndex: 0,
        batchRecordFilled: false,
        awaitingNext: false,
        finishRequested: false,
        continueRequestedAt: 0
      });
      showStatus(`批量填报已启动，共 ${batchTemplates.length} 个模板。`);
      batchTemplates = null;
      saveButton.textContent = "保存并等待填表";
    } else {
      const lines = parseTextFields(textarea.value);
      await chrome.storage.local.set({
        formData: lines,
        pendingFill: true,
        baseFilled: false,
        batchActive: false,
        batchQueue: [],
        batchIndex: -1,
        batchRecordFilled: false,
        awaitingNext: false,
        finishRequested: false,
        continueRequestedAt: 0
      });
      showStatus("已保存。打开或保持课题申报表单，即会尝试填写。");
    }
  } catch (error) {
    showStatus(`保存失败：${error.message}`, true);
  } finally {
    saveButton.disabled = false;
  }
});

cancelButton.addEventListener("click", async () => {
  try {
    await chrome.storage.local.set({
      pendingFill: false,
      baseFilled: false,
      formData: [],
      batchActive: false,
      batchQueue: [],
      batchIndex: -1,
      batchRecordFilled: false,
      awaitingNext: false,
      finishRequested: false,
      continueRequestedAt: 0
    });
    batchTemplates = null;
    textarea.value = "";
    templateFolder.value = "";
    saveButton.textContent = "保存并等待填表";
    showStatus("已取消等待并清除已保存的申报信息。");
  } catch (error) {
    showStatus(`取消失败：${error.message}`, true);
  }
});

loadSavedData();
