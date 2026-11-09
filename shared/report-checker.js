(() => {
  const namespace = (globalThis.vgmsReportChecker ??= {});
  const SECTION_CHECKS = [
    {
      id: "significance",
      label: "研究意义",
      patterns: [/^研究意义(?=$|[：:])/, /^现实意义(?=$|[：:])/]
    },
    {
      id: "purpose",
      label: "研究目的",
      patterns: [/^研究目的(?=$|[：:])/, /^研究(?:设计)?的目的(?=$|[：:])/, /^设计目的(?=$|[：:])/]
    },
    {
      id: "literature",
      label: "文献综述或设计资料准备",
      patterns: [
        /^文献综述(?=$|[：:])/,
        /^设计资料(?:的)?准备(?:情况)?(?=$|[：:])/,
        /^资料准备情况(?=$|[：:])/
      ]
    },
    {
      id: "approach",
      label: "研究思路",
      patterns: [/^研究思路(?=$|[：:])/, /^技术路线(?=$|[：:])/]
    },
    {
      id: "methods",
      label: "研究方法",
      patterns: [/^研究方法(?=$|[：:])/]
    },
    {
      id: "content",
      label: "研究内容",
      patterns: [/^研究内容(?=$|[：:])/, /^主要内容(?=$|[：:])/, /^研究内容与预期成果/]
    },
    {
      id: "outcomes",
      label: "预期成果",
      patterns: [/^预期成果(?=$|[：:])/, /^预期结果(?=$|[：:])/, /^研究内容与预期成果/]
    },
    {
      id: "schedule",
      label: "时间安排",
      patterns: [/^时间安排(?=$|[：:])/, /^进度安排(?=$|[：:])/]
    }
  ];

  function normalize(value) {
    return String(value ?? "")
      .replace(/[\u200b\ufeff]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\u3000]+/g, " ")
      .trim();
  }

  function isHeading(text) {
    return /^[一二三四五六七八九十]+[、.．]\s*\S/.test(normalize(text));
  }

  function getParagraphs(report) {
    if (Array.isArray(report?.paragraphs)) {
      return report.paragraphs
        .map((paragraph) => ({
          text: String(paragraph?.text ?? ""),
          textIndent: String(paragraph?.textIndent ?? "0px")
        }));
    }

    return String(report?.text ?? "")
      .split(/\r?\n/)
      .map((text) => ({ text, textIndent: "0px" }))
      .filter((paragraph) => normalize(paragraph.text));
  }

  function findSectionEvidence(paragraphs, patterns) {
    const headingText = (text) =>
      normalize(text).replace(/^[一二三四五六七八九十]+[、.．]\s*/, "");
    const index = paragraphs.findIndex(({ text }) =>
      patterns.some((pattern) => pattern.test(headingText(text)))
    );
    if (index < 0) {
      return "";
    }

    const heading = headingText(paragraphs[index].text);
    const matchedPattern = patterns.find((pattern) => pattern.test(heading));
    const matchedTitle = heading.match(matchedPattern)?.[0] ?? "";
    const suffix = heading
      .slice(matchedTitle.length)
      .replace(/^[：:\s]+/, "");
    const evidence = [];
    if (suffix && !/^[与和及]/.test(suffix)) {
      evidence.push(suffix);
    }

    for (let next = index + 1; next < paragraphs.length && evidence.join(" ").length < 180; next += 1) {
      if (isHeading(paragraphs[next].text)) {
        break;
      }
      const paragraphText = headingText(paragraphs[next].text);
      if (SECTION_CHECKS.some((section) =>
        section.patterns.some((pattern) => pattern.test(paragraphText))
      )) {
        continue;
      }
      evidence.push(paragraphText);
    }
    return evidence.join(" ").trim().slice(0, 180);
  }

  function checkReferences(paragraphs, text) {
    const citedNumbers = [...new Set(
      [...text.matchAll(/\[(\d{1,3})\]/g)].map((match) => Number(match[1]))
    )].sort((a, b) => a - b);
    const headingIndex = paragraphs.findIndex(({ text: paragraph }) =>
      /^(?:主要)?参考文献\s*[:：]?$|^references\s*:?$/i.test(normalize(paragraph))
    );

    if (headingIndex < 0) {
      return {
        status: "missing",
        message: citedNumbers.length
          ? "正文检测到引用标记，但未找到参考文献列表。"
          : "未找到参考文献列表。",
        citedNumbers,
        referenceNumbers: [],
        unmatchedNumbers: citedNumbers
      };
    }

    const referenceNumbers = [];
    for (const paragraph of paragraphs.slice(headingIndex + 1)) {
      const match = normalize(paragraph.text).match(/^\[(\d{1,3})\]/);
      if (match) {
        referenceNumbers.push(Number(match[1]));
      }
    }

    if (!referenceNumbers.length) {
      return {
        status: "missing",
        message: "找到参考文献标题，但未识别到文献条目。",
        citedNumbers,
        referenceNumbers,
        unmatchedNumbers: citedNumbers
      };
    }

    const listed = new Set(referenceNumbers);
    const unmatchedNumbers = citedNumbers.filter((number) => !listed.has(number));
    return {
      status: unmatchedNumbers.length ? "warning" : "pass",
      message: unmatchedNumbers.length
        ? `正文引用编号未在文献列表中找到：${unmatchedNumbers.join("、")}。`
        : `找到 ${referenceNumbers.length} 条参考文献，正文引用编号均可对应。`,
      citedNumbers,
      referenceNumbers,
      unmatchedNumbers
    };
  }

  function checkFormatting(paragraphs) {
    const indented = paragraphs.filter(({ text, textIndent }) => {
      const normalizedText = normalize(text);
      const indent = Number.parseFloat(textIndent);
      if (!normalizedText) {
        return false;
      }
      return (
        /^[\t \u00a0\u3000]/.test(text) ||
        (Number.isFinite(indent) && indent !== 0)
      );
    });

    const firstContentIndex = paragraphs.findIndex(({ text }) => normalize(text));
    let lastContentIndex = -1;
    for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
      if (normalize(paragraphs[index].text)) {
        lastContentIndex = index;
        break;
      }
    }
    const blankParagraphs = [];
    for (let index = firstContentIndex + 1; index < lastContentIndex; index += 1) {
      if (!normalize(paragraphs[index].text)) {
        const nextContent = paragraphs
          .slice(index + 1)
          .find(({ text }) => normalize(text));
        const nextText = normalize(nextContent?.text);
        blankParagraphs.push({
          index,
          followingHeading: isHeading(nextText) ? nextText : ""
        });
      }
    }

    const numberedHeadings = new Map();
    for (const { text } of paragraphs) {
      const match = normalize(text).match(/^([一二三四五六七八九十]+)[、.．]\s*\S/);
      if (match) {
        numberedHeadings.set(match[1], (numberedHeadings.get(match[1]) ?? 0) + 1);
      }
    }
    const duplicateNumbers = [...numberedHeadings]
      .filter(([, count]) => count > 1)
      .map(([number]) => number);

    return {
      indentation: {
        status: indented.length ? "warning" : "pass",
        message: indented.length
          ? `有 ${indented.length} 个非空段落存在段首空格或首行缩进。`
          : "未发现非空段落的段首空格或首行缩进。"
      },
      blankParagraphs: {
        status: blankParagraphs.length ? "warning" : "pass",
        message: blankParagraphs.length
          ? `正文中间发现 ${blankParagraphs.length} 个空段落${blankParagraphs[0].followingHeading ? `，位于“${blankParagraphs[0].followingHeading}”之前` : ""}；按顶格填写要求建议删除。`
          : "未发现正文中间的空段落。",
        count: blankParagraphs.length
      },
      numbering: {
        status: duplicateNumbers.length ? "warning" : "pass",
        message: duplicateNumbers.length
          ? `章节编号重复：${duplicateNumbers.join("、")}。`
          : "未发现重复的中文章节编号。"
      }
    };
  }

  function checkTables(tables) {
    const narrativeTables = (Array.isArray(tables) ? tables : [])
      .filter((table) => table?.containsNarrative);
    return {
      status: narrativeTables.length ? "warning" : "pass",
      message: narrativeTables.length
        ? "报告正文中存在表格，请以纯文本的形式提交开题报告的内容，不需要课题来源、课题类型、指导教师、职称/学位、学生姓名、学号、专业、班级等信息。"
        : "未发现包裹报告正文内容的表格。",
      count: narrativeTables.length
    };
  }

  function check(report) {
    const paragraphs = getParagraphs(report);
    const text = normalize(report?.text || paragraphs.map(({ text: value }) => value).join("\n"));
    const sections = SECTION_CHECKS.map((section) => {
      const evidence = findSectionEvidence(paragraphs, section.patterns);
      return {
        id: section.id,
        label: section.label,
        status: evidence ? "pass" : "missing",
        evidence,
        message: evidence ? "已识别到相关内容。" : "未识别到该项内容。"
      };
    });
    const references = checkReferences(paragraphs, text);
    const formatting = checkFormatting(paragraphs);
    formatting.tables = checkTables(report?.tables);
    const hasIssues =
      sections.some(({ status }) => status !== "pass") ||
      references.status !== "pass" ||
      Object.values(formatting).some(({ status }) => status !== "pass");

    return {
      status: hasIssues ? "needs-attention" : "pass",
      sections,
      references,
      formatting
    };
  }

  namespace.check = check;
})();
