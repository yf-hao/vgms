(() => {
  const defaultPaths = Object.freeze({
    dialog: "/manage/subject/subjectSelection/show",
    form: "/manage/subject/subjectSelection/auditPage"
  });
  const namespace = (globalThis.vgmsTopicReview ??= {});

  function findFrame(root, path) {
    return [...(root?.querySelectorAll("iframe") || [])].find((frame) =>
      (frame.getAttribute("src") || "").includes(path)
    );
  }

  // 定位审核表单所在文档：弹窗 iframe 内还嵌套了一层表单 iframe。
  namespace.createDialogLocator = (
    rootDocument = document,
    paths = defaultPaths
  ) => ({
    find() {
      for (const layer of rootDocument.querySelectorAll(".layui-layer")) {
        const dialogFrame = findFrame(layer, paths.dialog);
        const formFrame = findFrame(dialogFrame?.contentDocument, paths.form);
        if (formFrame?.contentDocument) {
          return {
            id: formFrame.getAttribute("src"),
            document: formFrame.contentDocument
          };
        }
      }
      return null;
    }
  });
})();
