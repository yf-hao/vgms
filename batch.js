(() => {
  const subjectFormPath = "/manage/subject/subject/modify";
  const isSubjectForm = location.pathname === subjectFormPath;
  const isTopFrame = window === window.top;
  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  let advancing = false;
  let advancePoll = null;
  let finishObserver = null;
  let finishing = false;
  let initialFormStateChecked = false;

  function showStatus(message, isError = false) {
    if (!document.body) {
      return;
    }
    let notice = document.querySelector("#vgms-autofill-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "vgms-autofill-notice";
      Object.assign(notice.style, {
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: "2147483647",
        maxWidth: "min(460px, calc(100vw - 24px))",
        padding: "10px 14px",
        borderRadius: "5px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
        color: "#fff",
        font: "14px/1.5 sans-serif"
      });
      document.body.appendChild(notice);
    }
    notice.style.backgroundColor = isError ? "#b3261e" : "#137333";
    notice.textContent = `VGMS填报助手：${message}`;
  }

  function watchFinishLayerClose() {
    if (!isTopFrame || finishObserver || !document.documentElement) {
      return;
    }
    finishObserver = new MutationObserver(() => {
      void finishIfLayerClosed();
    });
    finishObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    void finishIfLayerClosed();
  }

  function isSubjectLayer(layer) {
    return [...layer.querySelectorAll("iframe")].some((frame) =>
      (frame.getAttribute("src") || "").includes(subjectFormPath)
    );
  }

  function subjectLayerExists() {
    return [...document.querySelectorAll(".layui-layer")].some(isSubjectLayer);
  }

  function clearBatchState() {
    return vgmsBatchStorage.set({
      pendingFill: false,
      baseFilled: false,
      formData: [],
      batchActive: false,
      batchQueue: [],
      batchIndex: -1,
      batchRecordFilled: false,
      awaitingNext: false,
      finishRequested: false,
      continueRequestedAt: 0
    });
  }

  async function finishBatch(message) {
    try {
      await clearBatchState();
      showStatus(message);
    } catch (error) {
      showStatus(`清理批量任务失败：${error.message}`, true);
    }
  }

  async function handleSubmitButton(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest(".layui-layer-btn0, .layui-layer-btn1");
    if (!button || !button.closest(".layui-layer") || !isSubjectLayer(button.closest(".layui-layer"))) {
      return;
    }

    const isContinue = button.classList.contains("layui-layer-btn1") &&
      normalize(button.textContent).includes("确定并继续");
    const isConfirm = button.classList.contains("layui-layer-btn0");
    if (!isContinue && !isConfirm) {
      return;
    }

    try {
      const stored = await vgmsBatchStorage.get([
        "batchActive",
        "batchQueue",
        "batchIndex",
        "batchRecordFilled",
        "awaitingNext"
      ]);
      if (!stored.batchActive) {
        return;
      }

      if (isConfirm) {
        await vgmsBatchStorage.set({
          finishRequested: true,
          awaitingNext: false
        });
        showStatus("正在结束批量任务；剩余未处理模板将清除。");
        if (isTopFrame) {
          watchFinishLayerClose();
        }
        return;
      }

      if (!stored.batchRecordFilled) {
        showStatus("当前模板尚未完成自动填写，暂不切换到下一份。", true);
        return;
      }

      const layer = button.closest(".layui-layer");
      const formFrame = [...layer.querySelectorAll("iframe")].find((frame) =>
        (frame.getAttribute("src") || "").includes(subjectFormPath)
      );
      const titleInput = formFrame?.contentDocument?.querySelector("#name");
      if (titleInput && !titleInput.value.trim()) {
        showStatus("当前课题名称为空，批量任务不会前进；请检查表单后再试。", true);
        return;
      }

      const requestedAt = Date.now();
      await vgmsBatchStorage.set({
        awaitingNext: true,
        finishRequested: false,
        continueRequestedAt: requestedAt
      });
      showStatus("已检测到“确定并继续”，等待网站打开下一张空白表单。");
      if (isTopFrame) {
        setTimeout(() => {
          void checkContinueTimeout(requestedAt);
        }, 60000);
      }
    } catch (error) {
      showStatus(`处理按钮状态失败：${error.message}`, true);
    }
  }

  async function finishIfLayerClosed() {
    if (!isTopFrame || finishing) {
      return;
    }
    try {
      const stored = await vgmsBatchStorage.get(["finishRequested"]);
      if (stored.finishRequested && !subjectLayerExists()) {
        finishing = true;
        finishObserver?.disconnect();
        finishObserver = null;
        await finishBatch("批量任务已结束。");
      }
    } catch (error) {
      showStatus(`检查弹窗状态失败：${error.message}`, true);
    } finally {
      finishing = false;
    }
  }

  async function checkContinueTimeout(requestedAt) {
    try {
      const stored = await vgmsBatchStorage.get([
        "batchActive",
        "batchQueue",
        "batchIndex",
        "awaitingNext",
        "continueRequestedAt"
      ]);
      if (
        !stored.batchActive ||
        !stored.awaitingNext ||
        stored.continueRequestedAt !== requestedAt
      ) {
        return;
      }

      const isLastRecord =
        stored.batchIndex >= (stored.batchQueue?.length || 0) - 1;
      if (isLastRecord && !subjectLayerExists()) {
        await finishBatch("文件夹中的模板已处理完毕，批量任务完成。");
        return;
      }

      showStatus(
        "尚未检测到下一张表单；批量任务仍在等待。请确认网站已保存并继续打开了新表单。",
        true
      );
    } catch (error) {
      showStatus(`检查下一张表单失败：${error.message}`, true);
    }
  }

  async function advanceBatchIfReady() {
    if (!isSubjectForm || advancing) {
      return false;
    }

    advancing = true;
    try {
      const stored = await vgmsBatchStorage.get([
        "batchActive",
        "batchQueue",
        "batchIndex",
        "batchRecordFilled",
        "awaitingNext"
      ]);
      if (!stored.batchActive) {
        stopAdvancePolling();
        return false;
      }
      if (
        !stored.batchRecordFilled ||
        !Array.isArray(stored.batchQueue)
      ) {
        return false;
      }

      const titleInput = document.querySelector("#name[name='name']");
      if (!titleInput) {
        return false;
      }
      const isRecoveringSubmittedRecord =
        !initialFormStateChecked &&
        !stored.awaitingNext &&
        !titleInput.value.trim();
      initialFormStateChecked = true;
      if (
        (!stored.awaitingNext && !isRecoveringSubmittedRecord) ||
        titleInput.value.trim()
      ) {
        return false;
      }

      const nextIndex = stored.batchIndex + 1;
      if (nextIndex >= stored.batchQueue.length) {
        await finishBatch("文件夹中的模板已处理完毕，批量任务完成。");
        stopAdvancePolling();
        return true;
      }

      const next = stored.batchQueue[nextIndex];
      if (!next || !Array.isArray(next.formData) || next.formData.length !== 7) {
        showStatus(`第 ${nextIndex + 1} 份模板数据无效，批量任务已暂停。`, true);
        return false;
      }

      await vgmsBatchStorage.set({
        formData: next.formData,
        pendingFill: true,
        baseFilled: false,
        batchIndex: nextIndex,
        batchRecordFilled: false,
        awaitingNext: false,
        continueRequestedAt: 0
      });
      showStatus(
        `检测到新表单，开始第 ${nextIndex + 1}/${stored.batchQueue.length} 份：${next.fileName}`
      );
      return true;
    } catch (error) {
      showStatus(`切换到下一份模板失败：${error.message}`, true);
      return false;
    } finally {
      advancing = false;
    }
  }

  function stopAdvancePolling() {
    if (advancePoll !== null) {
      clearInterval(advancePoll);
      advancePoll = null;
    }
  }

  function startAdvancePolling() {
    if (!isSubjectForm || advancePoll !== null) {
      return;
    }
    advancePoll = setInterval(async () => {
      const advanced = await advanceBatchIfReady();
      if (advanced) {
        stopAdvancePolling();
      }
    }, 1000);
  }

  document.addEventListener("click", (event) => {
    void handleSubmitButton(event);
  }, true);

  if (isSubjectForm && document.body) {
    const observer = new MutationObserver(() => {
      void advanceBatchIfReady();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    void advanceBatchIfReady();
  }

  if (isSubjectForm) {
    startAdvancePolling();
    void advanceBatchIfReady();
  }
})();
