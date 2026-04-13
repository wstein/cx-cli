import path from "node:path";

export interface ParsedMarkdownFrontmatter {
  frontmatter: Record<string, unknown>;
  body: string;
}

const NOTE_ID_REGEX = /^\d{14}$/;

function normalizeMarkdownText(value: string): string {
  return value
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidDateTimeParts(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): boolean {
  const date = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return (
    date.getFullYear() === parts.year &&
    date.getMonth() === parts.month - 1 &&
    date.getDate() === parts.day &&
    date.getHours() === parts.hour &&
    date.getMinutes() === parts.minute &&
    date.getSeconds() === parts.second
  );
}

export function validateNoteIdFormat(id: string): boolean {
  if (!NOTE_ID_REGEX.test(id)) {
    return false;
  }

  const year = Number.parseInt(id.slice(0, 4), 10);
  const month = Number.parseInt(id.slice(4, 6), 10);
  const day = Number.parseInt(id.slice(6, 8), 10);
  const hour = Number.parseInt(id.slice(8, 10), 10);
  const minute = Number.parseInt(id.slice(10, 12), 10);
  const second = Number.parseInt(id.slice(12, 14), 10);

  return isValidDateTimeParts({
    year,
    month,
    day,
    hour,
    minute,
    second,
  });
}

export function parseMarkdownFrontmatter(
  content: string,
): ParsedMarkdownFrontmatter {
  const lines = content.split(/\r?\n/);

  if (!lines[0]?.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  let endIdx = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith("---")) {
      endIdx = index;
      break;
    }
  }

  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join("\n");
  const frontmatter: Record<string, unknown> = {};

  for (const line of frontmatterLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const valueStr = line.slice(colonIdx + 1).trim();

    if (valueStr === "true") {
      frontmatter[key] = true;
      continue;
    }

    if (valueStr === "false") {
      frontmatter[key] = false;
      continue;
    }

    if (valueStr === "null" || valueStr === "~") {
      frontmatter[key] = null;
      continue;
    }

    if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
      const arrayContent = valueStr.slice(1, -1).trim();
      frontmatter[key] =
        arrayContent === ""
          ? []
          : arrayContent
              .split(",")
              .map((item) => item.trim().replace(/^["']|["']$/g, "").trim());
      continue;
    }

    if (
      (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))
    ) {
      frontmatter[key] = valueStr.slice(1, -1);
      continue;
    }

    frontmatter[key] = valueStr;
  }

  return { frontmatter, body };
}

export function titleFromFileName(filePath: string): string {
  const fileName = path.basename(filePath, path.extname(filePath));
  const slugMatch = fileName.match(/^\d{14}-(.+)$/);
  if (slugMatch?.[1] !== undefined && slugMatch[1].length > 0) {
    return slugMatch[1];
  }

  return fileName;
}

export function extractNoteSummary(body: string): string {
  const lines = body.split(/\r?\n/);
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  const pushParagraph = (): void => {
    if (currentParagraph.length === 0) {
      return;
    }

    const text = normalizeMarkdownText(currentParagraph.join(" "));
    if (text.length > 0) {
      paragraphs.push(text);
    }
    currentParagraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      pushParagraph();
      continue;
    }

    if (/^##\s+links$/i.test(line)) {
      break;
    }

    if (/^#+\s+/.test(line)) {
      if (paragraphs.length > 0) {
        break;
      }
      continue;
    }

    currentParagraph.push(line.replace(/^\s*[-*+]\s+/, ""));
  }

  pushParagraph();

  const summary = paragraphs[0] ?? "";
  return summary.length > 240 ? `${summary.slice(0, 237)}...` : summary;
}
