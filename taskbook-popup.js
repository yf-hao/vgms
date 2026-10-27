(() => {
  const { createStore, parseTaskBook } = globalThis.vgmsTaskBook;
  const store = createStore();
  const fileInput = document.querySelector("#taskbook-file");
  const preview = document.querySelector("#taskbook-preview");
  const startButton = document.querySelector("#taskbook-start");
  const cancelButton = document.querySelector("#taskbook-cancel");
  const status = document.querySelector("#taskbook-status");
  let parsed = null;

  function show(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function describe({ data, problems }) {
    const lines = [
      data.title && `题目：${data.title}`,
      data.student.name && `学生：${data.student.name} ${data.student.id}`,
      `目的与任务：${data.purpose.length} 字`,
      `基本要求：${data.requirements.length} 字`,
      `进度安排：${data.schedule.length} 行`,
      `提交时间：${data.submitDate || "未识别"}`
    ];
    return lines.filter(Boolean).join("\n");
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    parsed = null;
    startButton.disabled = true;
    preview.textContent = "";
    if (!file) {
      return;
    }
    try {
      parsed = parseTaskBook(await file.text());
      preview.textContent = describe(parsed);
      if (parsed.problems.length) {
        show(`模板有问题：${parsed.problems.join("；")}`, true);
        return;
      }
      startButton.disabled = false;
      show("模板已解析，点击“保存并等待填表”。");
    } catch (error) {
      show(`读取失败：${error.message}`, true);
    }
  });

  startButton.addEventListener("click", async () => {
    if (!parsed || parsed.problems.length) {
      return;
    }
    try {
      await store.savePending(parsed.data);
      show("已保存。打开任务书表单后会自动填写，之后请自行检查并提交。");
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

  startButton.disabled = true;
  store
    .load()
    .then((state) => {
      if (state.pending) {
        show(`正在等待填写：${state.pending.title || "已导入的任务书"}`);
      }
    })
    .catch((error) => show(`读取失败：${error.message}`, true));
})();
