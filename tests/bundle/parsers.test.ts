/**
 * Unit tests for the section parsers, focused on packed-content preservation.
 *
 * Each Repomix output style has specific edge cases around wrapper newlines
 * that must be compensated for during extraction so the normalized packed
 * content matches the manifest hash.
 */

import { describe, expect, test } from "bun:test";

import {
  parseJsonSection,
  parseMarkdownSection,
  parsePlainSection,
  parseXmlSection,
} from "../../src/extract/parsers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the XML output that repomix emits for a single-file section. */
function xmlSection(path: string, content: string): string {
  return `<repomix><files><file path="${path}">\n${content}</file>\n</files></repomix>`;
}

/** Build the JSON output that repomix emits (trailing newline stripped). */
function jsonSection(path: string, content: string): string {
  const value = content.endsWith("\n") ? content.slice(0, -1) : content;
  return JSON.stringify({ files: { [path]: value } });
}

/** Build the markdown output that repomix emits (trailing newline stripped). */
function markdownSection(path: string, content: string, lang = ""): string {
  const body = content.endsWith("\n") ? content.slice(0, -1) : content;
  return [`## File: ${path}`, `\`\`\`\`${lang}`, body, "````", ""].join("\n");
}

const SEP_SHORT = "=".repeat(16);
const SEP_LONG = "=".repeat(64);

function normalizePackedContent(content: string): string {
  return content.endsWith("\n") ? content.slice(0, -1) : content;
}

/** Build the plain output that repomix emits for a two-file section. */
function plainSection(files: Array<{ path: string; content: string }>): string {
  const lines: string[] = [SEP_LONG, "Files", SEP_LONG, ""];
  for (const { path, content } of files) {
    lines.push(SEP_SHORT, `File: ${path}`, SEP_SHORT);
    // Repomix writes the content as-is; trailing \n produces a blank line
    // before the next separator or the end marker.
    lines.push(...content.split("\n"));
  }
  // Last file gets 4 extra blank lines from repomix before the end marker.
  for (let i = 0; i < 4; i++) lines.push("");
  lines.push(SEP_LONG, "End of Codebase", SEP_LONG);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

const CASES: Array<{ label: string; content: string }> = [
  { label: "single trailing newline", content: "hello world\n" },
  { label: "two trailing newlines", content: "hello world\n\n" },
  { label: "no trailing newline", content: "hello world" },
  { label: "empty file", content: "" },
  { label: "only newlines", content: "\n\n" },
  {
    label: "multi-line with trailing newline",
    content: "line1\nline2\nline3\n",
  },
  {
    label: "content with backtick fence",
    content: "# Title\n\n```ts\nconst x = 1;\n```\n",
  },
  {
    label: "content with closing file tag text",
    content: "before </file> after\n",
  },
];

describe("parsers – whitespace preservation", () => {
  describe("XML", () => {
    for (const { label, content } of CASES) {
      test(label, () => {
        const source = xmlSection("file.txt", content);
        const [result] = parseXmlSection(source);
        expect(result?.content).toBe(normalizePackedContent(content));
      });
    }

    test("parses repomix file blocks from wrapped exports", () => {
      const source = [
        "Repomix header text",
        "",
        "<directory_structure>",
        "src/",
        "</directory_structure>",
        "",
        "<files>",
        '<file path="src/example.ts">',
        "export function identity<T>(value: T): T {",
        "  return value;",
        "}",
        "</file>",
        "</files>",
      ].join("\n");

      const [result] = parseXmlSection(source);
      expect(result).toEqual({
        path: "src/example.ts",
        content:
          "export function identity<T>(value: T): T {\n  return value;\n}",
      });
    });

    test("preserves literal closing file tags inside raw content", () => {
      const source = xmlSection("file.txt", "before </file> after\n");
      const [result] = parseXmlSection(source);
      expect(result).toEqual({
        path: "file.txt",
        content: "before </file> after",
      });
    });

    test("preserves literal XML close sequences inside raw content", () => {
      const source = xmlSection(
        "file.txt",
        "return `<repomix><files><file path=\"${path}\">\\n${content}</file></files></repomix>`;\n",
      );
      const [result] = parseXmlSection(source);
      expect(result).toEqual({
        path: "file.txt",
        content:
          "return `<repomix><files><file path=\"${path}\">\\n${content}</file></files></repomix>`;",
      });
    });
  });

  describe("JSON (repomix strips trailing \\n)", () => {
    // Repomix strips the trailing newline when serialising JSON. The parser
    // restores it for non-empty content. Files without trailing \n and empty
    // files are returned exactly as stored.
    const jsonCases: Array<{
      label: string;
      content: string;
      expected: string;
    }> = [
      {
        label: "single trailing newline",
        content: "hello world\n",
        expected: "hello world",
      },
      {
        label: "no trailing newline",
        content: "hello world",
        expected: "hello world",
      },
      { label: "empty file", content: "", expected: "" },
      {
        label: "multi-line with trailing newline",
        content: "line1\nline2\n",
        expected: "line1\nline2",
      },
    ];
    for (const { label, content, expected } of jsonCases) {
      test(label, () => {
        const source = jsonSection("file.txt", content);
        const [result] = parseJsonSection(source);
        expect(result?.content).toBe(expected);
      });
    }
  });

  describe("Markdown (repomix strips trailing \\n)", () => {
    const mdCases: Array<{ label: string; content: string; expected: string }> =
      [
        {
          label: "single trailing newline",
          content: "hello world\n",
          expected: "hello world",
        },
        {
          label: "no trailing newline",
          content: "hello world",
          expected: "hello world",
        },
        { label: "empty file", content: "", expected: "" },
        {
          label: "multi-line with trailing newline",
          content: "line1\nline2\n",
          expected: "line1\nline2",
        },
      ];
    for (const { label, content, expected } of mdCases) {
      test(label, () => {
        const source = markdownSection("file.txt", content);
        const [result] = parseMarkdownSection(source);
        expect(result?.content).toBe(expected);
      });
    }
  });

  describe("Plain – non-last file preserves trailing \\n", () => {
    const trailingNewlineCases = ["hello\n", "multi\nline\n", "no-trailing"];
    for (const first of trailingNewlineCases) {
      test(`first file: ${JSON.stringify(first)}`, () => {
        const source = plainSection([
          { path: "first.txt", content: first },
          { path: "second.txt", content: "second\n" },
        ]);
        const results = parsePlainSection(source);
        expect(results[0]?.content).toBe(normalizePackedContent(first));
        expect(results[1]?.content).toBe("second");
      });
    }
  });

  describe("Plain – last file strips repomix padding (4 blank lines)", () => {
    test("single trailing newline", () => {
      const source = plainSection([{ path: "f.txt", content: "data\n" }]);
      const [result] = parsePlainSection(source);
      expect(result?.content).toBe("data");
    });

    test("two trailing newlines", () => {
      const source = plainSection([{ path: "f.txt", content: "data\n\n" }]);
      const [result] = parsePlainSection(source);
      expect(result?.content).toBe("data");
    });

    test("no trailing newline", () => {
      const source = plainSection([{ path: "f.txt", content: "data" }]);
      const [result] = parsePlainSection(source);
      expect(result?.content).toBe("data");
    });
  });
});
