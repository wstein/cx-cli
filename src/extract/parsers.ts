import { XMLParser } from "fast-xml-parser";

import { CxError } from "../shared/errors.js";

export interface ExtractedTextFile {
  path: string;
  content: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  trimValues: false,
});

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new CxError(`Invalid ${label} in section output.`, 8);
  }
  return value;
}

export function parseXmlSection(source: string): ExtractedTextFile[] {
  const parsed = xmlParser.parse(source) as {
    repomix?: {
      files?: {
        file?:
          | Array<{ path?: string; "#text"?: string }>
          | { path?: string; "#text"?: string };
      };
    };
    files?: {
      file?:
        | Array<{ path?: string; "#text"?: string }>
        | { path?: string; "#text"?: string };
    };
  };

  const fileNode = parsed.repomix?.files?.file ?? parsed.files?.file;
  if (!fileNode) {
    return [];
  }

  const files = Array.isArray(fileNode) ? fileNode : [fileNode];
  return files.map((file) => {
    // fast-xml-parser returns the raw text node. Repomix emits a structural
    // newline directly after each opening <file> tag, so strip exactly that
    // one leading newline to recover the original file content.
    let content = typeof file["#text"] === "string" ? file["#text"] : "";
    if (content.startsWith("\n")) {
      content = content.slice(1);
    }
    return { path: expectString(file.path, "file path"), content };
  });
}

export function parseJsonSection(source: string): ExtractedTextFile[] {
  const parsed = JSON.parse(source) as { files?: Record<string, unknown> };
  if (!parsed.files || typeof parsed.files !== "object") {
    throw new CxError("Invalid JSON section output.", 8);
  }

  return Object.entries(parsed.files).map(([filePath, content]) => {
    // Repomix strips the trailing newline from each file value when serializing
    // to JSON. Restore it so extracted files are byte-identical to the source.
    const raw = expectString(content, `content for ${filePath}`);
    return {
      path: filePath,
      content: raw.length > 0 && !raw.endsWith("\n") ? `${raw}\n` : raw,
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

    // Repomix strips the trailing newline from the code-block body when
    // serializing to markdown. Restore it so extracted files are byte-identical
    // to the source.
    const raw = contentLines.join("\n");
    files.push({
      path: filePath,
      content: raw.length > 0 && !raw.endsWith("\n") ? `${raw}\n` : raw,
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

    if (endedAtEof) {
      // Repomix appends exactly 4 extra blank lines before the end-of-codebase
      // separator for the last file in a section. Strip them to recover the
      // original file content.
      for (let i = 0; i < 4 && contentLines.at(-1) === ""; i++) {
        contentLines.pop();
      }
    }

    files.push({
      path: filePath,
      content: contentLines.join("\n"),
    });
  }

  return files;
}
