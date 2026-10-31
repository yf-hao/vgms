(() => {
  const { createStore, parseTaskBook } = globalThis.vgmsTaskBook;
  const store = createStore();
  const importButton = document.querySelector("#taskbook-import");
  const fileInput = document.querySelector("#taskbook-file");
  const text = document.querySelector("#taskbook-text");
  const startButton = document.querySelector("#taskbook-start");
  const cancelButton = document.querySelector("#taskbook-cancel");
  const status = document.querySelector("#taskbook-status");

  function show(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function summarize({ data }) {
    return `已识别：目的与任务 ${data.purpose.length} 字，基本要求 ${data.requirements.length} 字，进度安排 ${data.schedule.length} 行，提交时间 ${data.submitDate || "未识别"}。`;
  }

  // 等待中：不能重复保存，只能取消；其余状态：没有可取消的内容。
  function render(state) {
    const waiting = Boolean(state.pending);
    startButton.disabled = waiting;
    cancelButton.hidden = !waiting;
    if (waiting) {
      show(`正在等待填写：${state.pending.title || "已保存的任务书"}。请打开任务书表单。`);
    } else if (state.result) {
      show(state.result.message, !state.result.ok);
    }
  }

  importButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) {
      return;
    }
    try {
      text.value = await file.text();
      const result = parseTaskBook(text.value);
      show(result.problems.length ? `模板有问题：${result.problems.join("；")}` : summarize(result), result.problems.length > 0);
    } catch (error) {
      show(`读取失败：${error.message}`, true);
    } finally {
      fileInput.value = "";
    }
  });

  startButton.addEventListener("click", async () => {
    if (!text.value.trim()) {
      show("请先导入模板或输入任务书内容。", true);
      return;
    }
    const result = parseTaskBook(text.value);
    if (result.problems.length) {
      show(`内容有问题：${result.problems.join("；")}`, true);
      return;
    }
    try {
      await store.savePending(result.data);
    } catch (error) {
      show(`保存失败：${error.message}`, true);
    }
  });

  cancelButton.addEventListener("click", async () => {
    try {
      await store.savePending(null);
      show("已取消等待。");
    } catch (error) {
      show(`取消失败：${error.message}`, true);
    }
  });

  store.onChange(render);
  store
    .load()
    .then(render)
    .catch((error) => show(`读取失败：${error.message}`, true));
})();
