import fs from "node:fs/promises";

const readLcovFile = async (filePath) => {
  const content = await fs.readFile(filePath, "utf-8");
  const coverage = new Map();
  let current = null;

  for (const line of content.split("\n")) {
    if (line.startsWith("SF:")) {
      const file = line.slice(3);
      current = { file, lines: new Map(), total: 0, hit: 0 };
      coverage.set(file, current);
    } else if (line.startsWith("DA:") && current) {
      const parts = line.slice(3).split(",");
      const lineNum = Number(parts[0]);
      const count = Number(parts[1]);
      current.lines.set(lineNum, count);
      current.total++;
      if (count > 0) current.hit++;
    }
  }

  return coverage;
};

const readSourceFile = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.split("\n");
  } catch {
    return [];
  }
};

const getUncoveredRanges = (lines) => {
  const uncovered = [];
  let start = -1;

  const sorted = Array.from(lines.entries()).sort(([a], [b]) => a - b);

  for (const [lineNum, count] of sorted) {
    if (count === 0) {
      if (start === -1) start = lineNum;
    } else if (start !== -1) {
      uncovered.push([start, lineNum - 1]);
      start = -1;
    }
  }

  if (start !== -1) uncovered.push([start, Math.max(...lines.keys())]);
  return uncovered;
};

const formatCodeBlock = async (startLine, endLine, source) => {
  const lines = [];
  for (let i = startLine - 1; i < endLine; i++) {
    lines.push(source[i] || "");
  }
  return ["```text", ...lines, "```"];
};

const shouldInclude = (filePath) => {
  if (filePath.includes("/tests/") || filePath.startsWith("tests/"))
    return false;
  if (filePath.startsWith("/tmp/") || filePath.includes("/var/folders/"))
    return false;
  if (filePath.startsWith("/private/")) return false;
  return true;
};

const main = async () => {
  const lcovPath = "coverage/lcov.info";
  const outputPath = "coverage/COVERAGE.md";

  try {
    await fs.access(lcovPath);
  } catch {
    console.log(
      "⚠️  No full-suite coverage data found. Run `make verify` first.",
    );
    return;
  }

  const rawCoverage = await readLcovFile(lcovPath);
  const coverage = new Map(
    Array.from(rawCoverage.entries()).filter(([file]) => shouldInclude(file)),
  );
  const sorted = Array.from(coverage.values()).sort(
    (a, b) => a.hit / a.total - b.hit / b.total,
  );

  const totalHit = Array.from(coverage.values()).reduce(
    (sum, c) => sum + c.hit,
    0,
  );
  const totalLines = Array.from(coverage.values()).reduce(
    (sum, c) => sum + c.total,
    0,
  );
  const overall = ((totalHit / totalLines) * 100).toFixed(2);

  const below80 = sorted.filter((c) => c.hit / c.total < 0.8);
  const output = [];
  const push = (...lines) => {
    output.push(...lines);
  };

  push("# Coverage Report", "");
  push(`Generated: ${new Date().toISOString()}`, "");
  push("## Summary", "");
  push(`- Overall: ${overall}% (${totalHit}/${totalLines} lines)`);
  if (below80.length > 0) {
    push(`- Below 80%: ${below80.length} files`);
  }
  push("");

  for (const file of sorted) {
    const pct = ((file.hit / file.total) * 100).toFixed(2);
    if (file.hit === file.total) continue;

    push(`## ${file.file}`, "");
    push(`Coverage: ${pct}% (${file.hit}/${file.total})`, "");

    const source = await readSourceFile(file.file);
    const ranges = getUncoveredRanges(file.lines);

    for (const [start, end] of ranges) {
      push(`### ${file.file} lines ${start}-${end}`, "");
      push(...(await formatCodeBlock(start, end, source)), "");
    }
  }

  const markdown = `${output.join("\n").replace(/\n+$/, "")}\n`;
  await fs.writeFile(outputPath, markdown);

  const belowThreshold = sorted.filter((c) => c.hit / c.total < 0.8);
  console.log(`\n📊 Coverage: ${overall}% (${totalHit}/${totalLines})`);
  if (belowThreshold.length > 0) {
    console.log(`⚠️  ${belowThreshold.length} files below 80%:`);
    belowThreshold.forEach((f) => {
      const pct = ((f.hit / f.total) * 100).toFixed(1);
      console.log(`   - ${f.file}: ${pct}%`);
    });
  }
  console.log(`📄 Details: ${outputPath}`);
};

main().catch(console.error);
