const storageBridgeNamespace = "vgms-batch-storage";

const modeKey = "panelMode";
const floatingNamespace = "vgms-floating-panel";

// 侧边栏模式下由浏览器直接打开侧边栏（保留用户手势）；浮动模式下才会触发 onClicked。
function applyMode(mode) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: mode !== "float" })
    .catch((error) => console.error("设置面板模式失败：", error));
}

async function loadMode() {
  const stored = await chrome.storage.local.get(modeKey);
  applyMode(stored[modeKey]);
}

chrome.runtime.onInstalled.addListener(() => void loadMode());
chrome.runtime.onStartup.addListener(() => void loadMode());
void loadMode();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[modeKey]) {
    applyMode(changes[modeKey].newValue);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    sender.id === chrome.runtime.id &&
    message?.namespace === floatingNamespace &&
    message.action === "open-side" &&
    sender.tab
  ) {
    chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs
    .sendMessage(tab.id, { namespace: floatingNamespace, action: "open" }, { frameId: 0 })
    .catch(() => {});
});

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
