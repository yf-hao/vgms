(() => {
  const modeKey = "panelMode";
  const button = document.querySelector("#mode-switch");
  const hint = document.querySelector("#mode-hint");
  const icons = {
    // 当前为侧边栏：图标表示“切换为浮动窗口”
    float:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="12" height="10" rx="1.5"/><path d="M9 19h12V9"/></svg>',
    // 当前为浮动：图标表示“切换为侧边栏”
    side:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>'
  };
  const inFrame = window.top !== window;
  let mode = "side";

  // 浮动面板的标题栏已有标题和切换图标，面板内整行隐藏避免重复。
  if (inFrame) {
    document.querySelector(".title-row").hidden = true;
  }

  function renderButton() {
    const target = mode === "float" ? "side" : "float";
    const label = target === "float" ? "切换为浮动窗口" : "切换为侧边栏";
    button.innerHTML = icons[target];
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  async function switchMode() {
    mode = mode === "float" ? "side" : "float";
    await chrome.storage.local.set({ [modeKey]: mode });
    renderButton();
    if (mode === "float" && !inFrame) {
      // 当前在侧边栏中，浮动面板已在页面内展开，关闭侧边栏。
      window.close();
    } else if (mode === "side" && inFrame) {
      // 当前在浮动面板中，尝试直接打开侧边栏；失败时提示用户点击工具栏图标。
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch {
        hint.textContent = "已切换为侧边栏模式，请点击浏览器工具栏图标打开。";
        hint.hidden = false;
      }
    }
  }

  button.addEventListener("click", () => void switchMode());
  chrome.storage.local.get(modeKey).then((stored) => {
    mode = stored[modeKey] === "float" ? "float" : "side";
    renderButton();
  });
})();
