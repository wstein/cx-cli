import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ROOT, collectTestFiles } from "./test-lane-policy.js";

const TEST_BLOCK_PATTERN =
  /^\s*test\(\s*["'`](?<name>[^"'`]+)["'`]\s*,\s*(?:async\s*)?\(\)\s*=>\s*{(?<body>[\s\S]*?)^\s*}\s*\);/gm;

export const VERIFY_AGAINST_TAG_PREFIX = "verify-against-integration:";
export const VERIFY_AGAINST_REPORT_SCHEMA_VERSION = 1;

function lineNumberAt(content, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1;
    }
  }
  return line;
}

function extractTagReason(lines, testLine) {
  for (let index = testLine - 2; index >= 0; index -= 1) {
    const trimmed = lines[index]?.trim();
    if (trimmed === undefined) {
      return undefined;
    }
    if (trimmed === "") {
      continue;
    }
    if (!trimmed.startsWith("//")) {
      return undefined;
    }
    const tag = `// ${VERIFY_AGAINST_TAG_PREFIX}`;
    if (!trimmed.startsWith(tag)) {
      return undefined;
    }
    const reason = trimmed.slice(tag.length).trim();
    return reason.length > 0 ? reason : undefined;
  }
  return undefined;
}

export function collectAgainstDirVerifyTests(rootDir = ROOT) {
  const testDir = path.join(rootDir, "tests");
  const files = collectTestFiles(testDir);
  const entries = [];

  for (const fullPath of files) {
    const relativePath = path.relative(rootDir, fullPath).split(path.sep).join("/");
    const source = fs.readFileSync(fullPath, "utf8");
    const lines = source.split("\n");

    for (const match of source.matchAll(TEST_BLOCK_PATTERN)) {
      const testName = match.groups?.name;
      const testBody = match.groups?.body;
      if (!testName || !testBody) {
        continue;
      }
      if (!testBody.includes("runVerifyCommand(") || !testBody.includes("againstDir:")) {
        continue;
      }

      const line = lineNumberAt(source, match.index ?? 0);
      entries.push({
        relativePath,
        testName,
        line,
        reason: extractTagReason(lines, line),
      });
    }
  }

  return entries;
}

export function validateAgainstDirVerifyPolicy(rootDir = ROOT) {
  const entries = collectAgainstDirVerifyTests(rootDir);
  const missingJustifications = entries
    .filter((entry) => entry.reason === undefined)
    .map(
      (entry) =>
        `${entry.relativePath}:${entry.line} (${entry.testName}) is missing // ${VERIFY_AGAINST_TAG_PREFIX} <reason>`,
    );
  return { entries, missingJustifications };
}

export function buildAgainstDirVerifyReport(rootDir = ROOT) {
  const { entries, missingJustifications } =
    validateAgainstDirVerifyPolicy(rootDir);
  return {
    schemaVersion: VERIFY_AGAINST_REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ok: missingJustifications.length === 0,
    summary: {
      againstDirTestCount: entries.length,
      missingJustificationCount: missingJustifications.length,
    },
    entries: entries.map((entry) => ({
      ...entry,
      hasJustification: entry.reason !== undefined,
    })),
    missingJustifications,
  };
}

export function renderAgainstDirVerifyReport(
  report,
  format = "text",
) {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  const lines = [
    "verify-against-policy report",
    `- schemaVersion: ${report.schemaVersion}`,
    `- generatedAt: ${report.generatedAt}`,
    `- ok: ${report.ok}`,
    `- againstDir tests: ${report.summary.againstDirTestCount}`,
    `- missing justifications: ${report.summary.missingJustificationCount}`,
  ];

  if (report.missingJustifications.length > 0) {
    lines.push("- violations:");
    for (const violation of report.missingJustifications) {
      lines.push(`  - ${violation}`);
    }
  }

  return lines.join("\n");
}

function parseCliArgs(args) {
  const parsed = {
    rootDir: ROOT,
    format: "text",
    outputPath: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root-dir requires a path value.");
      }
      parsed.rootDir = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--format") {
      const value = args[index + 1];
      if (value !== "text" && value !== "json") {
        throw new Error('--format must be either "text" or "json".');
      }
      parsed.format = value;
      index += 1;
      continue;
    }
    if (arg === "--output") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output requires a file path.");
      }
      parsed.outputPath = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--help") {
      return { ...parsed, help: true };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function helpText() {
  return [
    "Usage: node scripts/verify-against-policy.js [options]",
    "",
    "Options:",
    "  --format <text|json>   Output format for stdout (default: text)",
    "  --output <path>        Optional JSON report path for CI bots",
    "  --root-dir <path>      Project root to scan (default: repository root)",
    "  --help                 Show this help message",
  ].join("\n");
}

function defaultCliIo() {
  return {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  };
}

export function runVerifyAgainstPolicyCli(args = process.argv.slice(2), io = defaultCliIo()) {
  try {
    const options = parseCliArgs(args);
    if (options.help === true) {
      io.stdout(`${helpText()}\n`);
      return 0;
    }

    const report = buildAgainstDirVerifyReport(options.rootDir);
    const output = renderAgainstDirVerifyReport(report, options.format);
    io.stdout(`${output}\n`);

    if (options.outputPath) {
      fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
      fs.writeFileSync(
        options.outputPath,
        `${JSON.stringify(report, null, 2)}\n`,
        "utf8",
      );
    }

    return report.ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`verify-against-policy: ${message}\n`);
    return 2;
  }
}

const invokedDirectly = (() => {
  const invokedPath = process.argv[1];
  if (!invokedPath) {
    return false;
  }
  return path.resolve(invokedPath) === path.resolve(fileURLToPath(import.meta.url));
})();

if (invokedDirectly) {
  process.exitCode = runVerifyAgainstPolicyCli();
}
