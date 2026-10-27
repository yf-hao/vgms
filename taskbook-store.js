(() => {
  const storageKey = "taskBook";
  const namespace = (globalThis.vgmsTaskBook ??= {});

  // 保存待填写的任务书（pending）；填写完成后由 runner 清除。
  namespace.createStore = (storage = globalThis.chrome?.storage) => ({
    async load() {
      const stored = await storage.local.get(storageKey);
      return { pending: null, ...stored[storageKey] };
    },
    async savePending(pending) {
      await storage.local.set({ [storageKey]: { pending } });
    },
    onChange(listener) {
      storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[storageKey]) {
          listener({ pending: null, ...changes[storageKey].newValue });
        }
      });
    }
  });
})();
