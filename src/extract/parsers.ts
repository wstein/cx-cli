import { CxError } from "../shared/errors.js";

export interface ExtractedTextFile {
  path: string;
  content: string;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new CxError(`Invalid ${label} in section output.`, 8);
  }
  return value;
}

function findXmlFileCloseIndex(source: string, fromIndex: number): number {
  const closeTag = "</file>";
  let searchIndex = fromIndex;

  while (searchIndex < source.length) {
    const candidate = source.indexOf(closeTag, searchIndex);
    if (candidate === -1) {
      return -1;
    }

    const lineEnd = source.indexOf("\n", candidate);
    const lineEndIndex = lineEnd === -1 ? source.length : lineEnd;
    const tail = source
      .slice(candidate + closeTag.length, lineEndIndex)
      .replace(/\r/g, "");

    if (tail.trim().length === 0) {
      return candidate;
    }

    searchIndex = candidate + closeTag.length;
  }

  return -1;
}

export function parseXmlSection(source: string): ExtractedTextFile[] {
  const files: ExtractedTextFile[] = [];
  const openTagPrefix = '<file path="';
  const openTagSuffix = '">';
  let searchIndex = 0;

  while (searchIndex < source.length) {
    const openIndex = source.indexOf(openTagPrefix, searchIndex);
    if (openIndex === -1) {
      break;
    }

    const pathStart = openIndex + openTagPrefix.length;
    const pathEnd = source.indexOf(openTagSuffix, pathStart);
    if (pathEnd === -1) {
      throw new CxError("Invalid XML section output.", 8);
    }

    const rawPath = source.slice(pathStart, pathEnd);
    const contentStart = pathEnd + openTagSuffix.length;
    const searchFrom = source[contentStart] === "\n" ? contentStart + 1 : contentStart;
    const closeIndex = findXmlFileCloseIndex(source, searchFrom);
    if (closeIndex === -1) {
      throw new CxError(
        `Invalid XML section output for ${expectString(rawPath, "file path")}.`,
        8,
      );
    }

    let content = source.slice(searchFrom, closeIndex);
    if (content.endsWith("\n")) {
      content = content.slice(0, -1);
    }

    files.push({
      path: expectString(rawPath, "file path"),
      content,
    });

    searchIndex = closeIndex + "</file>".length;
  }

  return files;
}

export function parseJsonSection(source: string): ExtractedTextFile[] {
  const parsed = JSON.parse(source) as { files?: Record<string, unknown> };
  if (!parsed.files || typeof parsed.files !== "object") {
    throw new CxError("Invalid JSON section output.", 8);
  }

  return Object.entries(parsed.files).map(([filePath, content]) => {
    const raw = expectString(content, `content for ${filePath}`);
    return {
      path: filePath,
      content: raw,
    };
  });
}

export function parseMarkdownSection(source: string): ExtractedTextFile[] {
  const lines = source.split("\n");
  const files: ExtractedTextFile[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line?.startsWith("## File: ")) {
      index += 1;
      continue;
    }

    const filePath = line.slice("## File: ".length);
    const fenceLine = lines[index + 1];
    const fenceMatch = fenceLine?.match(/^(`{3,})(.*)$/);
    if (!fenceMatch) {
      throw new CxError(`Invalid markdown section fence for ${filePath}.`, 8);
    }

    const delimiter = fenceMatch[1];
    const contentLines: string[] = [];
    index += 2;

    while (index < lines.length && lines[index] !== delimiter) {
      contentLines.push(lines[index] ?? "");
      index += 1;
    }

    if (lines[index] !== delimiter) {
      throw new CxError(`Unterminated markdown block for ${filePath}.`, 8);
    }

    const raw = contentLines.join("\n");
    files.push({
      path: filePath,
      content: raw,
    });

    index += 1;
    if (lines[index] === "") {
      index += 1;
    }
  }

  return files;
}

export function parsePlainSection(source: string): ExtractedTextFile[] {
  const lines = source.split("\n");
  const shortSeparator = "=".repeat(16);
  const longSeparator = "=".repeat(64);
  const files: ExtractedTextFile[] = [];
  let index = lines.indexOf("Files");

  if (
    index === -1 ||
    lines[index - 1] !== longSeparator ||
    lines[index + 1] !== longSeparator
  ) {
    throw new CxError("Invalid plain section output.", 8);
  }

  index += 3;
  while (index < lines.length) {
    while (index < lines.length && lines[index] === "") {
      index += 1;
    }

    if (index >= lines.length || lines[index] === longSeparator) {
      break;
    }

    if (lines[index] !== shortSeparator) {
      throw new CxError(
        `Invalid plain section separator at line ${index + 1}.`,
        8,
      );
    }

    const fileLine = lines[index + 1];
    const closingSeparator = lines[index + 2];
    if (
      !fileLine?.startsWith("File: ") ||
      closingSeparator !== shortSeparator
    ) {
      throw new CxError(
        `Invalid plain section header at line ${index + 1}.`,
        8,
      );
    }

    const filePath = fileLine.slice("File: ".length);
    index += 3;
    const contentLines: string[] = [];
    let endedAtEof = false;

    while (index < lines.length) {
      const currentLine = lines[index];
      const nextLine = lines[index + 1];
      const nextNextLine = lines[index + 2];
      if (
        currentLine === shortSeparator &&
        nextLine?.startsWith("File: ") &&
        nextNextLine === shortSeparator
      ) {
        break;
      }

      if (currentLine === longSeparator && nextLine === "End of Codebase") {
        endedAtEof = true;
        break;
      }

      contentLines.push(currentLine ?? "");
      index += 1;
    }

    while (contentLines.at(-1) === "") {
      contentLines.pop();
    }

    files.push({
      path: filePath,
      content: contentLines.join("\n"),
    });
  }

  return files;
}
