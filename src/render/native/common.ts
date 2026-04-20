import type { StructuredRenderEntry } from "../types.js";

export const PLAIN_SHORT_SEPARATOR = "=".repeat(16);
export const PLAIN_LONG_SEPARATOR = "=".repeat(64);

function buildTree(paths: string[]): Array<{ line: string; depth: number }> {
  type Node = { dirs: Map<string, Node>; files: string[] };
  const root: Node = { dirs: new Map(), files: [] };

  for (const filePath of paths) {
    const segments = filePath.split("/");
    let cursor = root;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!segment) {
        continue;
      }

      if (index === segments.length - 1) {
        cursor.files.push(segment);
        continue;
      }

      if (!cursor.dirs.has(segment)) {
        cursor.dirs.set(segment, { dirs: new Map(), files: [] });
      }
      cursor = cursor.dirs.get(segment) as Node;
    }
  }

  const lines: Array<{ line: string; depth: number }> = [];
  const visit = (node: Node, depth: number) => {
    for (const [dirName, child] of [...node.dirs.entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      lines.push({ line: `${dirName}/`, depth });
      visit(child, depth + 1);
    }
    for (const fileName of [...node.files].sort((left, right) =>
      left.localeCompare(right),
    )) {
      lines.push({ line: fileName, depth });
    }
  };

  visit(root, 0);
  return lines;
}

function standardSecurityPreamble(securityCheck: boolean): string[] {
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

function standardSecurityNotes(securityCheck: boolean): string[] {
  const lines = [
    "- Some files may have been excluded based on .gitignore rules and Repomix's configuration",
    "- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files",
    "- Long base64 data strings (e.g., data:image/png;base64,...) have been truncated to reduce token count",
  ];

  if (!securityCheck) {
    lines.push(
      "- Security check has been disabled - content may contain sensitive information",
    );
  }

  return lines;
}

function currentJsonAndPlainGenerationHeader(): string {
  return [
    "This file is a merged representation of the entire codebase, combined into a single document by Repomix.",
    "The content has been processed where security check has been disabled.",
  ].join("\n");
}

function currentJsonNotes(): string {
  return [
    "- Some files may have been excluded based on .gitignore rules and Repomix's configuration",
    "- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files",
    "- Content has been formatted for parsing in json style",
    "- Long base64 data strings (e.g., data:image/png;base64,...) have been truncated to reduce token count",
    "- Security check has been disabled - content may contain sensitive information",
  ].join("\n");
}

export function buildDirectoryStructureText(paths: string[]): string {
  return buildTree(paths)
    .map(({ line, depth }) => `${"  ".repeat(depth)}${line}`)
    .join("\n");
}

export function buildXmlSummaryText(securityCheck: boolean): string {
  return [
    ...standardSecurityPreamble(securityCheck),
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
    ...standardSecurityNotes(securityCheck),
    "</notes>",
    "",
    "</file_summary>",
    "",
    "",
  ].join("\n");
}

export function buildMarkdownSummaryText(securityCheck: boolean): string {
  return [
    ...standardSecurityPreamble(securityCheck),
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
    ...standardSecurityNotes(securityCheck),
    "",
    "",
  ].join("\n");
}

export function buildPlainSummaryText(): string {
  return [
    currentJsonAndPlainGenerationHeader(),
    "",
    PLAIN_LONG_SEPARATOR,
    "File Summary",
    PLAIN_LONG_SEPARATOR,
    "",
    "Purpose:",
    "--------",
    "This file contains a packed representation of the entire repository's contents.",
    "It is designed to be easily consumable by AI systems for analysis, code review,",
    "or other automated processes.",
    "",
    "File Format:",
    "------------",
    "The content is organized as follows:",
    "1. This summary section",
    "2. Repository information",
    "3. Directory structure",
    "4. Repository files (if enabled)",
    "5. Multiple file entries, each consisting of:",
    "  a. A separator line (================)",
    "  b. The file path (File: path/to/file)",
    "  c. Another separator line",
    "  d. The full contents of the file",
    "  e. A blank line",
    "",
    "Usage Guidelines:",
    "-----------------",
    "- This file should be treated as read-only. Any changes should be made to the",
    "  original repository files, not this packed version.",
    "- When processing this file, use the file path to distinguish",
    "  between different files in the repository.",
    "- Be aware that this file may contain sensitive information. Handle it with",
    "  the same level of security as you would the original repository.",
    "- Pay special attention to the Repository Description. These contain important context and guidelines specific to this project.",
    "",
    "Notes:",
    "------",
    "- Some files may have been excluded based on .gitignore rules and Repomix's configuration",
    "- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files",
    "- Long base64 data strings (e.g., data:image/png;base64,...) have been truncated to reduce token count",
    "- Security check has been disabled - content may contain sensitive information",
    "",
    "",
  ].join("\n");
}

export function buildPlainBlockHeading(title: string): string {
  return [PLAIN_LONG_SEPARATOR, title, PLAIN_LONG_SEPARATOR].join("\n");
}

export function buildJsonSummary(
  headerText: string,
  ordering: string[],
): {
  fileSummary: {
    generationHeader: string;
    purpose: string;
    fileFormat: string;
    usageGuidelines: string;
    notes: string;
  };
  userProvidedHeader: string;
  directoryStructure: string;
} {
  return {
    fileSummary: {
      generationHeader: [
        "This file is a merged representation of the entire codebase, combined into a single document by Repomix.",
        "The content has been processed where content has been formatted for parsing in json style, security check has been disabled.",
      ].join("\n"),
      purpose: [
        "This file contains a packed representation of the entire repository's contents.",
        "It is designed to be easily consumable by AI systems for analysis, code review,",
        "or other automated processes.",
      ].join("\n"),
      fileFormat: [
        "The content is organized as follows:",
        "1. This summary section",
        "2. Repository information",
        "3. Directory structure",
        "4. Repository files, each consisting of:",
        "   - File path as a key",
        "   - Full contents of the file as the value",
      ].join("\n"),
      usageGuidelines: [
        "- This file should be treated as read-only. Any changes should be made to the",
        "  original repository files, not this packed version.",
        "- When processing this file, use the file path to distinguish",
        "  between different files in the repository.",
        "- Be aware that this file may contain sensitive information. Handle it with",
        "  the same level of security as you would the original repository.",
        "- Pay special attention to the Repository Description. These contain important context and guidelines specific to this project.",
      ].join("\n"),
      notes: currentJsonNotes(),
    },
    userProvidedHeader: headerText,
    directoryStructure: buildDirectoryStructureText(ordering),
  };
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
