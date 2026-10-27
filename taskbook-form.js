(() => {
  const namespace = (globalThis.vgmsTaskBook ??= {});

  const defaultConfig = Object.freeze({
    formPath: "/manage/process/processData/modify",
    purposeId: "cid_7_widget",
    requirementsId: "cid_2_widget",
    submitDateId: "cid_12_widget",
    rangeId: (index) => `cid_10_${index}_widget`,
    taskId: (index) => `cid_11_${index}_widget`,
    addRowButton: ".bjkj-copy-btn"
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isVisible = (element) => Boolean(element?.getClientRects().length);

  function setValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    for (const type of ["input", "change", "blur"]) {
      element.dispatchEvent(new Event(type, { bubbles: true }));
    }
  }

  // 在顶层文档及其嵌套 iframe 中找到任务书表单所在的文档。
  namespace.createFormLocator = (rootDocument = document, config = defaultConfig) => {
    function search(doc, depth) {
      if (doc.location?.pathname.includes(config.formPath) && doc.getElementById(config.purposeId)) {
        return doc;
      }
      if (depth > 4) {
        return null;
      }
      for (const frame of doc.querySelectorAll("iframe")) {
        let child = null;
        try {
          child = frame.contentDocument;
        } catch {
          continue;
        }
        const found = child && search(child, depth + 1);
        if (found) {
          return found;
        }
      }
      return null;
    }
    return { find: () => search(rootDocument, 0) };
  };

  namespace.createTaskBookForm = (config = defaultConfig, wait = sleep) => {
    const isReady = (doc) => isVisible(doc.getElementById(config.purposeId));

    async function ensureRow(doc, index) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (doc.getElementById(config.rangeId(index))) {
          return true;
        }
        const buttons = [...doc.querySelectorAll(config.addRowButton)].filter(isVisible);
        if (attempt % 5 === 0) {
          buttons.at(-1)?.click();
        }
        await wait(100);
      }
      return Boolean(doc.getElementById(config.rangeId(index)));
    }

    function write(doc, id, value) {
      const element = doc.getElementById(id);
      if (!element) {
        return false;
      }
      setValue(element, value);
      return true;
    }

    // 返回无法填写的字段名列表，空数组表示全部成功。
    async function fill(doc, data) {
      const failed = [];
      const track = (label, ok) => ok || failed.push(label);

      track("目的与任务", write(doc, config.purposeId, data.purpose));
      track("基本要求", write(doc, config.requirementsId, data.requirements));
      track("提交时间", write(doc, config.submitDateId, data.submitDate));

      for (const [index, row] of data.schedule.entries()) {
        if (!(await ensureRow(doc, index))) {
          failed.push(`进度安排第 ${index + 1} 行（新增行失败）`);
          break;
        }
        track(`第 ${index + 1} 行起止日期`, write(doc, config.rangeId(index), row.range));
        track(`第 ${index + 1} 行任务`, write(doc, config.taskId(index), row.task));
      }
      return failed;
    }

    return Object.freeze({ isReady, fill });
  };
})();
