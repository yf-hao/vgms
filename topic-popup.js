(() => {
  const settings = globalThis.vgmsTopicReview.createSettingsStore();
  const comment = document.querySelector("#topic-comment");
  const startButton = document.querySelector("#topic-start");
  const stopButton = document.querySelector("#topic-stop");
  const status = document.querySelector("#topic-status");

  function show(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  startButton.addEventListener("click", async () => {
    const value = comment.value.trim();
    if (!value) {
      show("请输入审核意见。", true);
      return;
    }
    try {
      await settings.save({ enabled: true, comment: value });
      show("已保存。打开审核弹窗后会自动选择“通过”并填写意见。");
    } catch (error) {
      show(`保存失败：${error.message}`, true);
    }
  });

  stopButton.addEventListener("click", async () => {
    try {
      await settings.save({ enabled: false });
      show("已停止自动填写。");
    } catch (error) {
      show(`停止失败：${error.message}`, true);
    }
  });

  settings
    .load()
    .then((saved) => {
      comment.value = saved.comment;
      if (saved.enabled) {
        show("自动填写进行中。");
      }
    })
    .catch((error) => show(`读取失败：${error.message}`, true));
})();
