(() => {
  // 只在顶层页面注入，避免每个 iframe 都出现一个面板。
  if (window.top !== window || document.querySelector("#vgms-floating-root")) {
    return;
  }

  const storageKey = "floatingPanel";
  const modeKey = "panelMode";
  const defaults = { open: false, left: null, top: 80 };
  const fixedSize = Object.freeze({ width: 360, height: 540 });
  const storage = chrome.storage.local;
  let state = { ...defaults };
  let mode = "side";

  const save = () => storage.set({ [storageKey]: state }).catch(() => {});
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

  function applyBounds(panel) {
    const width = Math.min(fixedSize.width, window.innerWidth - 16);
    const height = Math.min(fixedSize.height, window.innerHeight - 16);
    const left = state.left ?? window.innerWidth - width - 16;
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    panel.style.left = `${clamp(left, 0, window.innerWidth - width)}px`;
    panel.style.top = `${clamp(state.top, 0, window.innerHeight - 40)}px`;
  }

  function createElement(tag, styles, text) {
    const element = document.createElement(tag);
    Object.assign(element.style, styles);
    if (text) {
      element.textContent = text;
    }
    return element;
  }

  function build() {
    const root = createElement("div", { position: "fixed", zIndex: "2147483646", top: "0", left: "0" });
    root.id = "vgms-floating-root";

    const launcher = createElement(
      "button",
      {
        position: "fixed",
        right: "16px",
        bottom: "16px",
        padding: "8px 14px",
        border: "0",
        borderRadius: "18px",
        background: "#1a73e8",
        color: "#fff",
        font: "14px/1.4 sans-serif",
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(0,0,0,.3)"
      },
      "VGMS助手"
    );

    const panel = createElement("div", {
      position: "fixed",
      display: "none",
      flexDirection: "column",
      background: "#fff",
      border: "1px solid #dadce0",
      borderRadius: "8px",
      boxShadow: "0 4px 20px rgba(0,0,0,.3)",
      overflow: "hidden"
    });

    const header = createElement(
      "div",
      {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 10px",
        background: "#f1f3f4",
        font: "13px/1.4 sans-serif",
        cursor: "move",
        userSelect: "none",
        flex: "none"
      },
      "VGMS填报助手"
    );
    const close = createElement(
      "span",
      { cursor: "pointer", padding: "0 4px", fontSize: "16px" },
      "×"
    );
    const sideIcon =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>';
    const switchToSide = createElement("span", {
      display: "inline-flex",
      alignItems: "center",
      cursor: "pointer",
      padding: "0 6px",
      color: "#5f6368"
    });
    switchToSide.innerHTML = sideIcon;
    switchToSide.title = "切换为侧边栏";
    const actions = createElement("span", { display: "inline-flex", alignItems: "center" });
    actions.append(switchToSide, close);
    header.appendChild(actions);

    const frame = createElement("iframe", { flex: "1", border: "0", width: "100%" });
    frame.src = chrome.runtime.getURL("popup.html");
    panel.append(header, frame);
    root.append(launcher, panel);
    document.documentElement.appendChild(root);
    return { root, launcher, panel, header, close, switchToSide, frame };
  }

  // 仅浮动模式显示；默认（侧边栏模式）不注入任何可见元素。
  function render({ root, launcher, panel }) {
    const floating = mode === "float";
    root.style.display = floating ? "block" : "none";
    panel.style.display = floating && state.open ? "flex" : "none";
    launcher.style.display = floating && !state.open ? "block" : "none";
    if (floating && state.open) {
      applyBounds(panel);
    }
  }

  function enableDrag({ panel, header, frame }) {
    header.addEventListener("pointerdown", (event) => {
      if (event.target !== header && event.target.parentElement !== header) {
        return;
      }
      const rect = panel.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      header.setPointerCapture(event.pointerId);
      frame.style.pointerEvents = "none";
      const move = (e) => {
        state.left = e.clientX - offsetX;
        state.top = e.clientY - offsetY;
        applyBounds(panel);
      };
      const stop = () => {
        header.removeEventListener("pointermove", move);
        header.removeEventListener("pointerup", stop);
        frame.style.pointerEvents = "";
        const bounds = panel.getBoundingClientRect();
        state = { ...state, left: bounds.left, top: bounds.top };
        save();
      };
      header.addEventListener("pointermove", move);
      header.addEventListener("pointerup", stop);
    });
  }

  async function start() {
    const stored = await storage.get([storageKey, modeKey]);
    state = { ...defaults, ...stored[storageKey] };
    mode = stored[modeKey] === "float" ? "float" : "side";
    const parts = build();
    const setOpen = (open) => {
      state.open = open;
      render(parts);
      save();
    };
    parts.launcher.addEventListener("click", () => setOpen(true));
    parts.close.addEventListener("click", () => setOpen(false));
    parts.switchToSide.addEventListener("click", () => {
      // 先请求后台打开侧边栏（保留用户手势），再写入模式，浮动面板随之隐藏。
      chrome.runtime.sendMessage({ namespace: "vgms-floating-panel", action: "open-side" }).catch(() => {});
      storage.set({ [modeKey]: "side" });
    });
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.namespace === "vgms-floating-panel" && message.action === "open") {
        setOpen(true);
      }
    });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[modeKey]) {
        mode = changes[modeKey].newValue === "float" ? "float" : "side";
        state.open = mode === "float";
        render(parts);
        save();
      }
    });
    // 页面脚本若移除了面板，自动挂回。
    new MutationObserver(() => {
      if (!parts.root.isConnected) {
        document.documentElement.appendChild(parts.root);
      }
    }).observe(document.documentElement, { childList: true });
    enableDrag(parts);
    render(parts);
  }

  start().catch((error) => console.error("VGMS浮动面板启动失败：", error));
})();
