import fs from "node:fs";
import path from "node:path";

import { ROOT, collectTestFiles } from "./test-lane-policy.js";

const TEST_BLOCK_PATTERN =
  /^\s*test\(\s*["'`](?<name>[^"'`]+)["'`]\s*,\s*(?:async\s*)?\(\)\s*=>\s*{(?<body>[\s\S]*?)^\s*}\s*\);/gm;

export const VERIFY_AGAINST_TAG_PREFIX = "verify-against-integration:";

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
