(() => {
  const { createStore, createFormLocator, createTaskBookForm, createRunner } = globalThis.vgmsTaskBook;

  function notify(message, isError = false) {
    if (!document.body) {
      return;
    }
    let notice = document.querySelector("#vgms-taskbook-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "vgms-taskbook-notice";
      Object.assign(notice.style, {
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: "2147483647",
        maxWidth: "min(420px, calc(100vw - 24px))",
        padding: "10px 14px",
        borderRadius: "5px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
        color: "#fff",
        font: "14px/1.5 sans-serif"
      });
      document.body.appendChild(notice);
    }
    notice.style.backgroundColor = isError ? "#b3261e" : "#137333";
    notice.textContent = `VGMS任务书：${message}`;
  }

  void createRunner({
    store: createStore(),
    formLocator: createFormLocator(),
    form: createTaskBookForm(),
    notify
  }).start();
})();
