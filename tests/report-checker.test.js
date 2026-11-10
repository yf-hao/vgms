const assert = require("node:assert/strict");
const test = require("node:test");

require("../shared/report-checker.js");

const { check, createReviewDecision } = globalThis.vgmsReportChecker;

function paragraph(text, textIndent = "0px") {
  return { text, textIndent };
}

test("finds required sections and missing references when citations are present", () => {
  const report = {
    text: [
      "一、研究意义",
      "说明本研究的意义和实际价值。",
      "二、研究目的",
      "说明本研究的目标。",
      "三、文献综述",
      "国内研究方面：已有成果[1]。",
      "四、研究思路",
      "说明研究路线。",
      "五、研究方法",
      "采用文献研究法开展研究。",
      "六、研究内容",
      "说明主要研究内容。",
      "七、预期成果",
      "预期完成系统和论文。",
      "八、时间安排",
      "2026年10月完成第一阶段任务。"
    ].join("\n"),
    paragraphs: [
      paragraph("一、研究意义"),
      paragraph("说明本研究的意义和实际价值。"),
      paragraph("二、研究目的"),
      paragraph("说明本研究的目标。"),
      paragraph("三、文献综述"),
      paragraph("国内研究方面：已有成果[1]。"),
      paragraph("四、研究思路"),
      paragraph("说明研究路线。"),
      paragraph("五、研究方法"),
      paragraph("采用文献研究法开展研究。"),
      paragraph("六、研究内容"),
      paragraph("说明主要研究内容。"),
      paragraph("七、预期成果"),
      paragraph("预期完成系统和论文。"),
      paragraph("八、时间安排"),
      paragraph("2026年10月完成第一阶段任务。")
    ]
  };

  const result = check(report);
  assert.equal(result.sections.every(({ status }) => status === "pass"), true);
  assert.equal(result.references.status, "missing");
  assert.deepEqual(result.references.citedNumbers, [1]);
  assert.equal(result.formatting.numbering.status, "pass");
  assert.equal(result.status, "needs-attention");
});

test("recognizes bibliography entries and flags unmatched citation numbers", () => {
  const report = {
    text: "研究综述引用[1][2]\n参考文献\n[1] 作者. 文献标题. 2024.",
    paragraphs: [
      paragraph("研究综述引用[1][2]"),
      paragraph("参考文献"),
      paragraph("[1] 作者. 文献标题. 2024.")
    ]
  };

  const result = check(report);
  assert.equal(result.references.status, "warning");
  assert.deepEqual(result.references.unmatchedNumbers, [2]);
});

test("detects repeated section numbering and indented non-empty paragraphs", () => {
  const report = {
    text: "一、研究意义\n正文\n一、研究目的\n正文",
    paragraphs: [
      paragraph("一、研究意义"),
      paragraph("正文", "21px"),
      paragraph("一、研究目的"),
      paragraph("正文")
    ]
  };

  const result = check(report);
  assert.equal(result.formatting.indentation.status, "warning");
  assert.equal(result.formatting.numbering.status, "warning");
});

test("ignores an indented blank paragraph", () => {
  const report = {
    text: "一、研究意义\n正文",
    paragraphs: [
      paragraph("一、研究意义"),
      paragraph("正文"),
      paragraph("　", "28px")
    ]
  };

  const result = check(report);
  assert.equal(result.formatting.indentation.status, "pass");
  assert.equal(result.formatting.blankParagraphs.status, "pass");
});

test("does not pass a section from a mention in unrelated body text", () => {
  const report = {
    text: "一、研究意义\n正文提到了研究目的，但未单独填写该项。",
    paragraphs: [
      paragraph("一、研究意义"),
      paragraph("正文提到了研究目的，但未单独填写该项。")
    ]
  };

  const result = check(report);
  assert.equal(result.sections.find(({ id }) => id === "significance").status, "pass");
  assert.equal(result.sections.find(({ id }) => id === "purpose").status, "missing");
});

test("does not pass a heading without section content", () => {
  const result = check({
    text: "一、研究意义\n二、研究目的",
    paragraphs: [paragraph("一、研究意义"), paragraph("二、研究目的")]
  });

  assert.equal(result.sections.find(({ id }) => id === "significance").status, "missing");
  assert.equal(result.sections.find(({ id }) => id === "purpose").status, "missing");
});

test("flags an empty paragraph before a numbered section heading", () => {
  const result = check({
    text: "三、研究思路\n思路内容\n\n四、研究方法\n方法内容",
    paragraphs: [
      paragraph("三、研究思路"),
      paragraph("思路内容"),
      paragraph(""),
      paragraph("四、研究方法"),
      paragraph("方法内容")
    ]
  });

  assert.equal(result.formatting.blankParagraphs.status, "warning");
  assert.match(result.formatting.blankParagraphs.message, /位于“四、研究方法/);
});

test("ignores empty paragraphs at the beginning and end of the editor", () => {
  const result = check({
    text: "\n一、研究意义\n正文\n",
    paragraphs: [
      paragraph(""),
      paragraph("一、研究意义"),
      paragraph("正文"),
      paragraph("")
    ]
  });

  assert.equal(result.formatting.blankParagraphs.status, "pass");
});

test("flags a table containing report narrative but ignores metadata tables", () => {
  const result = check({
    text: "研究意义\n正文",
    paragraphs: [paragraph("研究意义"), paragraph("正文")],
    tables: [
      { rows: 4, columns: 8, containsNarrative: false },
      { rows: 1, columns: 1, containsNarrative: true }
    ]
  });

  assert.equal(result.formatting.tables.status, "warning");
  assert.equal(result.formatting.tables.count, 1);
  assert.equal(
    result.formatting.tables.message,
    "报告正文中存在表格，请以纯文本的形式提交开题报告的内容，不需要课题来源、课题类型、指导教师、职称/学位、学生姓名、学号、专业、班级等信息。"
  );
});

test("passes when only form metadata tables are present", () => {
  const result = check({
    text: "研究意义\n正文",
    paragraphs: [paragraph("研究意义"), paragraph("正文")],
    tables: [{ rows: 4, columns: 8, containsNarrative: false }]
  });

  assert.equal(result.formatting.tables.status, "pass");
});

test("flags required section titles without numbering", () => {
  const result = check({
    text: "研究意义\n正文\n研究（设计）的目的\n正文\n文献综述\n综述正文",
    paragraphs: [
      paragraph("研究意义"),
      paragraph("意义正文"),
      paragraph("研究（设计）的目的"),
      paragraph("目的正文"),
      paragraph("文献综述"),
      paragraph("综述正文"),
      paragraph("研究思路"),
      paragraph("思路正文"),
      paragraph("研究方法"),
      paragraph("方法正文"),
      paragraph("研究内容与预期成果"),
      paragraph("内容和预期成果正文"),
      paragraph("时间安排"),
      paragraph("时间安排正文")
    ]
  });

  assert.equal(result.formatting.numbering.status, "missing");
  assert.match(result.formatting.numbering.message, /研究意义/);
  assert.match(result.formatting.numbering.message, /研究目的/);
  assert.equal(result.sections.find(({ id }) => id === "purpose").status, "pass");
  assert.match(result.formatting.numbering.message, /研究内容与预期成果/);
});

test("accepts numbered section titles including an explicit combined content/outcome title", () => {
  const result = check({
    text: "一、研究意义\n正文\n二、研究目的\n正文",
    paragraphs: [
      paragraph("一、研究意义"),
      paragraph("意义正文"),
      paragraph("二、研究目的"),
      paragraph("目的正文"),
      paragraph("三、文献综述"),
      paragraph("综述正文"),
      paragraph("四、研究思路"),
      paragraph("思路正文"),
      paragraph("五、研究方法"),
      paragraph("方法正文"),
      paragraph("六、研究内容与预期成果"),
      paragraph("内容和预期成果正文"),
      paragraph("七、时间安排"),
      paragraph("时间安排正文")
    ]
  });

  assert.equal(result.formatting.numbering.status, "pass");
});

test("builds a pass decision with a concise approval comment", () => {
  const result = createReviewDecision({
    sections: [{ label: "研究意义", status: "pass" }],
    references: { status: "pass", message: "" },
    formatting: {
      tables: { status: "pass" },
      indentation: { status: "pass" },
      blankParagraphs: { status: "pass" },
      numbering: { status: "pass" }
    }
  });

  assert.equal(result.statusTitle, "通过");
  assert.equal(result.comment, "通过");
  assert.deepEqual(result.issues, []);
});

test("builds a reject decision with numbered issues and no redundant rejection text", () => {
  const result = createReviewDecision({
    sections: [{ label: "研究意义", status: "missing" }],
    references: { status: "missing", message: "未找到参考文献列表。" },
    formatting: {
      tables: { status: "warning", message: "报告正文中存在表格。" },
      indentation: { status: "pass" },
      blankParagraphs: { status: "pass" },
      numbering: { status: "pass" }
    }
  });

  assert.equal(result.statusTitle, "不通过");
  assert.equal(result.comment, "1. 研究意义缺少或未识别到有效内容。\n2. 未找到参考文献列表。\n3. 报告正文中存在表格。");
  assert.equal(result.comment.includes("未通过"), false);
});
