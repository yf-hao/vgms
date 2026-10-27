(() => {
  const namespace = (globalThis.vgmsTaskBook ??= {});

  const sectionNames = Object.freeze({
    purpose: "研究（设计）目的与任务",
    requirements: "基本要求",
    schedule: "进度安排",
    submitDate: "提交时间"
  });

  function splitFrontMatter(markdown) {
    const match = markdown.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return { meta: {}, body: markdown };
    }
    const meta = {};
    for (const line of match[1].split(/\r?\n/)) {
      const pair = line.match(/^([^:#\s][^:]*):\s*(.*)$/);
      if (pair) {
        meta[pair[1].trim()] = pair[2].trim().replace(/^["']|["']$/g, "");
      }
    }
    return { meta, body: match[2] };
  }

  function splitSections(body) {
    const sections = new Map();
    let name = null;
    for (const line of body.split(/\r?\n/)) {
      const heading = line.match(/^#\s+(.+?)\s*$/);
      if (heading) {
        name = heading[1];
        sections.set(name, []);
      } else if (name) {
        sections.get(name).push(line);
      }
    }
    return new Map([...sections].map(([key, lines]) => [key, lines.join("\n").trim()]));
  }

  // “2026年10月27日” 或 “2026-10-27” → “2026-10-27”
  function normalizeDate(text) {
    const match = text.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!match) {
      return "";
    }
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  function normalizeRange(text) {
    const dates = text.split(/\s+[-–—~至到]\s+|\s*[-–—~至到]\s*(?=\d{4}\s*[年\-/])/).map(normalizeDate);
    return dates.length === 2 && dates[0] && dates[1] ? `${dates[0]} - ${dates[1]}` : "";
  }

  function parseSchedule(text) {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim().startsWith("|") || /^\s*\|[\s:|-]+\|\s*$/.test(line)) {
        continue;
      }
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      if (cells.length < 3 || cells.some((cell) => /^\{\{.*\}\}$/.test(cell))) {
        continue;
      }
      rows.push({ range: normalizeRange(cells[1]), task: cells.slice(2).join("|").trim() });
    }
    return rows;
  }

  namespace.parseTaskBook = (markdown) => {
    const { meta, body } = splitFrontMatter(markdown);
    const sections = splitSections(body);
    const data = {
      student: { name: meta.studentName || "", id: meta.studentId || "" },
      title: meta.thesisTitle || "",
      purpose: sections.get(sectionNames.purpose) || "",
      requirements: sections.get(sectionNames.requirements) || "",
      schedule: parseSchedule(sections.get(sectionNames.schedule) || ""),
      submitDate: normalizeDate(sections.get(sectionNames.submitDate) || "")
    };

    const problems = [];
    if (!data.purpose) problems.push("缺少“研究（设计）目的与任务”");
    if (!data.requirements) problems.push("缺少“基本要求”");
    if (!data.schedule.length) problems.push("缺少“进度安排”表格");
    if (data.schedule.some((row) => !row.range || !row.task)) problems.push("进度安排中有日期或任务无法识别");
    if (!data.submitDate) problems.push("缺少“提交时间”");
    return { data, problems };
  };
})();
