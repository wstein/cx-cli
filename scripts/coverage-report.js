import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_INPUT_PATH = "coverage/vitest/coverage-summary.json";
export const DEFAULT_OUTPUT_PATH = ".ci/coverage-summary.md";

function formatPercent(value) {
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(2)}`;
}

export async function generateCoverageSummaryMarkdown({
  inputPath = DEFAULT_INPUT_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const summary = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const total = summary.total;

  const markdown = [
    "# Coverage Summary",
    "",
    "| Metric | % | Covered / Total |",
    "|---|---:|---:|",
    `| Lines | ${formatPercent(total.lines.pct)}% | ${total.lines.covered} / ${total.lines.total} |`,
    `| Functions | ${formatPercent(total.functions.pct)}% | ${total.functions.covered} / ${total.functions.total} |`,
    `| Branches | ${formatPercent(total.branches.pct)}% | ${total.branches.covered} / ${total.branches.total} |`,
    `| Statements | ${formatPercent(total.statements.pct)}% | ${total.statements.covered} / ${total.statements.total} |`,
    "",
  ].join("\n");

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");
  return markdown;
}

async function main() {
  const markdown = await generateCoverageSummaryMarkdown();
  console.log(markdown);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate coverage summary: ${message}`);
  process.exitCode = 1;
});
