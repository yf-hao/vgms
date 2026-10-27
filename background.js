const storageBridgeNamespace = "vgms-batch-storage";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    sender.id !== chrome.runtime.id ||
    message?.namespace !== storageBridgeNamespace
  ) {
    return;
  }

  if (message.action === "get") {
    if (!Array.isArray(message.payload?.keys)) {
      sendResponse({ ok: false, error: "批量状态读取参数无效。" });
      return;
    }

    chrome.storage.local
      .get(message.payload.keys)
      .then((value) => sendResponse({ ok: true, value }))
      .catch((error) =>
        sendResponse({ ok: false, error: `读取批量状态失败：${error.message}` })
      );
    return true;
  }

  if (message.action === "set") {
    const data = message.payload?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      sendResponse({ ok: false, error: "批量状态写入参数无效。" });
      return;
    }

    chrome.storage.local
      .set(data)
      .then(() => sendResponse({ ok: true, value: null }))
      .catch((error) => {
        sendResponse({ ok: false, error: `写入批量状态失败：${error.message}` });
      });
    return true;
  }
});
