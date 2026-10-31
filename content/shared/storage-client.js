(() => {
  const namespace = "vgms-batch-storage";

  async function send(action, payload) {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) {
      throw new Error("扩展消息通道不可用，请重新加载扩展和 VGMS 页面。");
    }

    const response = await runtime.sendMessage({
      namespace,
      action,
      payload
    });
    if (!response?.ok) {
      throw new Error(response?.error || "扩展后台未返回存储结果。");
    }
    return response.value;
  }

  globalThis.vgmsBatchStorage = Object.freeze({
    get(keys) {
      return send("get", { keys });
    },
    set(data) {
      return send("set", { data });
    }
  });
})();
