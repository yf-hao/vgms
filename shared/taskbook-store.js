(() => {
  const storageKey = "taskBook";
  const namespace = (globalThis.vgmsTaskBook ??= {});

  // 保存待填写的任务书（pending）；填写完成后由 runner 清除。
  namespace.createStore = (storage = globalThis.chrome?.storage) => ({
    async load() {
      const stored = await storage.local.get(storageKey);
      return { pending: null, result: null, ...stored[storageKey] };
    },
    // 导入新任务书时清除上次结果；pending 为 null 表示取消等待。
    async savePending(pending) {
      await storage.local.set({ [storageKey]: { pending, result: null } });
    },
    // 填写结束后清除待填数据并记录结果，供弹窗/面板展示。
    async saveResult(result) {
      await storage.local.set({ [storageKey]: { pending: null, result } });
    },
    onChange(listener) {
      storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[storageKey]) {
          listener({ pending: null, result: null, ...changes[storageKey].newValue });
        }
      });
    }
  });
})();
