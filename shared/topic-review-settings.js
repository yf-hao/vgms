(() => {
  const storageKey = "topicReview";
  const defaults = Object.freeze({ enabled: false, comment: "" });
  const namespace = (globalThis.vgmsTopicReview ??= {});

  // 对外只暴露 load / save / onChange，调用方不依赖具体存储实现。
  namespace.createSettingsStore = (storage = globalThis.chrome?.storage) => {
    async function load() {
      const stored = await storage.local.get(storageKey);
      return { ...defaults, ...stored[storageKey] };
    }

    async function save(patch) {
      const current = await load();
      await storage.local.set({ [storageKey]: { ...current, ...patch } });
    }

    function onChange(listener) {
      storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[storageKey]) {
          listener({ ...defaults, ...changes[storageKey].newValue });
        }
      });
    }

    return Object.freeze({ load, save, onChange });
  };
})();
