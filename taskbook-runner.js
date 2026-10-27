(() => {
  const namespace = (globalThis.vgmsTaskBook ??= {});

  // 只依赖注入的抽象：store、formLocator、form、notify、timer。
  namespace.createRunner = ({ store, formLocator, form, notify, timer = globalThis, intervalMs = 500 }) => {
    let pending = null;
    let busy = false;

    async function tick() {
      if (busy || !pending) {
        return;
      }
      const doc = formLocator.find();
      if (!doc || !form.isReady(doc)) {
        return;
      }

      busy = true;
      const data = pending;
      pending = null;
      try {
        const failed = await form.fill(doc, data);
        await store.savePending(null);
        if (failed.length) {
          notify(`部分内容未能填写：${failed.join("、")}，请手动处理。`, true);
        } else {
          notify("任务书已填写，请检查后自行提交。");
        }
      } catch (error) {
        notify(`自动填写失败：${error.message}`, true);
      } finally {
        busy = false;
      }
    }

    async function start() {
      pending = (await store.load()).pending;
      store.onChange((state) => {
        pending = state.pending;
        if (!pending) {
          notify("任务书自动填写已取消。");
        }
      });
      timer.setInterval(() => void tick(), intervalMs);
    }

    return Object.freeze({ start });
  };
})();
