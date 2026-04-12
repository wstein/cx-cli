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

export function parseXmlSection(source: string): ExtractedTextFile[] {
  const files: ExtractedTextFile[] = [];
  const filePattern = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;

  for (const match of source.matchAll(filePattern)) {
    const [, rawPath = "", rawContent = ""] = match;
    let content = rawContent;

    // Repomix emits a structural newline directly after each opening <file>
    // tag and one structural newline before </file>, so strip both wrapper
    // newlines to recover the packed content exactly.
    if (content.startsWith("\n")) {
      content = content.slice(1);
    }
    if (content.endsWith("\n")) {
      content = content.slice(0, -1);
    }

    files.push({
      path: expectString(rawPath, "file path"),
      content,
    });
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
