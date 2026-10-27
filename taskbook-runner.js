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
        const ok = failed.length === 0;
        const message = ok
          ? "任务书已填写完成，请检查后自行提交。"
          : `部分内容未能填写：${failed.join("、")}，请手动处理。`;
        await store.saveResult({ ok, message });
        notify(message, !ok);
      } catch (error) {
        const message = `自动填写失败：${error.message}`;
        await store.saveResult({ ok: false, message }).catch(() => {});
        notify(message, true);
      } finally {
        busy = false;
      }
    }

    async function start() {
      pending = (await store.load()).pending;
      store.onChange((state) => {
        pending = state.pending;
      });
      timer.setInterval(() => void tick(), intervalMs);
    }

    return Object.freeze({ start });
  };
})();
