(() => {
  const namespace = (globalThis.vgmsTopicReview ??= {});

  // 审核表单：判断是否加载完成，并选择审核状态、填写审核意见。
  namespace.createApproveForm = ({ statusTitle = "通过" } = {}) => {
    const findStatus = (doc) =>
      doc.querySelector(`input[type="radio"][name="status"][title="${statusTitle}"]`);
    const findComment = (doc) => doc.querySelector("textarea[name='content']");

    function isReady(doc) {
      return Boolean(doc && findStatus(doc) && findComment(doc));
    }

    function selectStatus(radio) {
      if (radio.checked) {
        return true;
      }
      const visualRadio = radio.nextElementSibling;
      if (visualRadio?.classList.contains("layui-form-radio")) {
        visualRadio.click();
      }
      if (!radio.checked) {
        radio.click();
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return radio.checked;
    }

    function writeComment(textarea, comment) {
      textarea.focus();
      textarea.value = comment;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      return textarea.value === comment;
    }

    async function fill(doc, comment) {
      return selectStatus(findStatus(doc)) && writeComment(findComment(doc), comment);
    }

    return Object.freeze({ isReady, fill });
  };
})();
