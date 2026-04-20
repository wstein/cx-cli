import type { StructuredRenderEntry } from "../types.js";

function buildTree(paths: string[]): Array<{ line: string; depth: number }> {
  type Node = { dirs: Map<string, Node>; files: string[] };
  const root: Node = { dirs: new Map(), files: [] };

  for (const filePath of paths) {
    const segments = filePath.split("/");
    let cursor = root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment) continue;
      if (i === segments.length - 1) {
        cursor.files.push(segment);
      } else {
        if (!cursor.dirs.has(segment)) {
          cursor.dirs.set(segment, { dirs: new Map(), files: [] });
        }
        cursor = cursor.dirs.get(segment) as Node;
      }
    }
  }

  const lines: Array<{ line: string; depth: number }> = [];
  const visit = (node: Node, depth: number) => {
    for (const [dirName, child] of [...node.dirs.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push({ line: `${dirName}/`, depth });
      visit(child, depth + 1);
    }
    for (const fileName of [...node.files].sort((a, b) => a.localeCompare(b))) {
      lines.push({ line: fileName, depth });
    }
  };

  visit(root, 0);
  return lines;
}

export function buildDirectoryStructureText(paths: string[]): string {
  return buildTree(paths)
    .map(({ line, depth }) => `${"  ".repeat(depth)}${line}`)
    .join("\n");
}

function securityPreamble(securityCheck: boolean): string[] {
  return securityCheck
    ? [
        "This file is a merged representation of the entire codebase, combined into a single document by Repomix.",
        "",
      ]
    : [
        "This file is a merged representation of the entire codebase, combined into a single document by Repomix.",
        "The content has been processed where security check has been disabled.",
        "",
      ];
}

function securityNotes(
  securityCheck: boolean,
  _style: "xml" | "markdown",
): string[] {
  const lines = [
    "- Some files may have been excluded based on .gitignore rules and Repomix's configuration",
    "- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files",
  ];

  lines.push(
    "- Long base64 data strings (e.g., data:image/png;base64,...) have been truncated to reduce token count",
  );

  if (!securityCheck) {
    lines.push(
      "- Security check has been disabled - content may contain sensitive information",
    );
  }

  return lines;
}

export function buildXmlSummaryText(securityCheck: boolean): string {
  return [
    ...securityPreamble(securityCheck),
    "<file_summary>",
    "This section contains a summary of this file.",
    "",
    "<purpose>",
    "This file contains a packed representation of the entire repository's contents.",
    "It is designed to be easily consumable by AI systems for analysis, code review,",
    "or other automated processes.",
    "</purpose>",
    "",
    "<file_format>",
    "The content is organized as follows:",
    "1. This summary section",
    "2. Repository information",
    "3. Directory structure",
    "4. Repository files (if enabled)",
    "5. Multiple file entries, each consisting of:",
    "  - File path as an attribute",
    "  - Full contents of the file",
    "</file_format>",
    "",
    "<usage_guidelines>",
    "- This file should be treated as read-only. Any changes should be made to the",
    "  original repository files, not this packed version.",
    "- When processing this file, use the file path to distinguish",
    "  between different files in the repository.",
    "- Be aware that this file may contain sensitive information. Handle it with",
    "  the same level of security as you would the original repository.",
    "- Pay special attention to the Repository Description. These contain important context and guidelines specific to this project.",
    "</usage_guidelines>",
    "",
    "<notes>",
    ...securityNotes(securityCheck, "xml"),
    "</notes>",
    "",
    "</file_summary>",
    "",
    "",
  ].join("\n");
}

export function buildMarkdownSummaryText(securityCheck: boolean): string {
  return [
    ...securityPreamble(securityCheck),
    "# File Summary",
    "",
    "## Purpose",
    "This file contains a packed representation of the entire repository's contents.",
    "It is designed to be easily consumable by AI systems for analysis, code review,",
    "or other automated processes.",
    "",
    "## File Format",
    "The content is organized as follows:",
    "1. This summary section",
    "2. Repository information",
    "3. Directory structure",
    "4. Repository files (if enabled)",
    "5. Multiple file entries, each consisting of:",
    "  a. A header with the file path (## File: path/to/file)",
    "  b. The full contents of the file in a code block",
    "",
    "## Usage Guidelines",
    "- This file should be treated as read-only. Any changes should be made to the",
    "  original repository files, not this packed version.",
    "- When processing this file, use the file path to distinguish",
    "  between different files in the repository.",
    "- Be aware that this file may contain sensitive information. Handle it with",
    "  the same level of security as you would the original repository.",
    "- Pay special attention to the Repository Description. These contain important context and guidelines specific to this project.",
    "",
    "## Notes",
    ...securityNotes(securityCheck, "markdown"),
    "",
    "",
  ].join("\n");
}

export function chooseMarkdownFence(content: string): string {
  const matches = content.match(/`+/g) ?? [];
  const longest = matches.reduce((max, run) => Math.max(max, run.length), 0);
  return "`".repeat(Math.max(4, longest + 1));
}

export function normalizedLogicalLineCount(content: string): number {
  if (content === "") {
    return 1;
  }

  const parts = content.split("\n");
  return content.endsWith("\n") ? parts.length - 1 : parts.length;
}

export function renderMarkdownFileBlock(entry: StructuredRenderEntry): string {
  const fence = chooseMarkdownFence(entry.content);
  const language = entry.language ?? "";
  const openingFence = `${fence}${language}`;

  return [`## File: ${entry.path}`, openingFence, entry.content, fence].join(
    "\n",
  );
}
