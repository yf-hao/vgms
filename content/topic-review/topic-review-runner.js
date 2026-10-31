(() => {
  const namespace = (globalThis.vgmsTopicReview ??= {});

  // 只依赖注入的抽象：settings、dialogLocator、form、notify、timer。
  namespace.createReviewRunner = ({
    settings,
    dialogLocator,
    form,
    notify,
    timer = globalThis,
    intervalMs = 500
  }) => {
    let current = { enabled: false, comment: "" };
    let filledDocument = null;
    let filledCount = 0;
    let busy = false;

    async function tick() {
      if (busy || !current.enabled) {
        return;
      }
      const dialog = dialogLocator.find();
      if (
        !dialog?.document ||
        dialog.document === filledDocument ||
        !form.isReady(dialog.document)
      ) {
        return;
      }

      busy = true;
      filledDocument = dialog.document;
      try {
        if (await form.fill(dialog.document, current.comment)) {
          filledCount += 1;
          notify(`第 ${filledCount} 条已填写，请检查后点击“确定并继续”。`);
        } else {
          notify("未能选择“通过”或填写审核意见，请手动处理。", true);
        }
      } catch (error) {
        notify(`自动填写失败：${error.message}`, true);
      } finally {
        busy = false;
      }
    }

    function applySettings(next) {
      const justEnabled = next.enabled && !current.enabled;
      const justDisabled = !next.enabled && current.enabled;
      current = next;
      if (justEnabled) {
        filledDocument = null;
        filledCount = 0;
      }
      if (justDisabled) {
        notify("选题审核自动填写已停止。");
      }
    }

    async function start() {
      applySettings(await settings.load());
      settings.onChange(applySettings);
      timer.setInterval(() => void tick(), intervalMs);
    }

    return Object.freeze({ start });
  };
})();
