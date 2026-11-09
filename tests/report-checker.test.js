const assert = require("node:assert/strict");
const test = require("node:test");

require("../shared/report-checker.js");

const check = globalThis.vgmsReportChecker.check;

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
