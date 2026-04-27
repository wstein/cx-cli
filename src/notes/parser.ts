import path from "node:path";

export interface ParsedMarkdownFrontmatter {
  frontmatter: Record<string, unknown>;
  body: string;
}

const NOTE_ID_REGEX = /^\d{14}(?:-\d{3})?$/;

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

export function parseNoteIdTimestamp(id: string): Date | null {
  if (!validateNoteIdFormat(id)) {
    return null;
  }

  const year = Number.parseInt(id.slice(0, 4), 10);
  const month = Number.parseInt(id.slice(4, 6), 10);
  const day = Number.parseInt(id.slice(6, 8), 10);
  const hour = Number.parseInt(id.slice(8, 10), 10);
  const minute = Number.parseInt(id.slice(10, 12), 10);
  const second = Number.parseInt(id.slice(12, 14), 10);

  return new Date(year, month - 1, day, hour, minute, second);
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

  for (let index = 0; index < frontmatterLines.length; index += 1) {
    const line = frontmatterLines[index] ?? "";
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) {
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const valueStr = line.slice(colonIdx + 1).trim();

    if (valueStr.length === 0) {
      const block = parseFrontmatterBlock(frontmatterLines, index + 1);
      if (block.consumed > 0) {
        frontmatter[key] = block.value;
        index += block.consumed;
        continue;
      }
    }

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
          : arrayContent.split(",").map((item) =>
              item
                .trim()
                .replace(/^["']|["']$/g, "")
                .trim(),
            );
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

function serializeScalar(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value === null) {
    return "null";
  }
  return JSON.stringify(String(value));
}

function serializeNestedValue(
  key: string,
  value: unknown,
  indent = "",
): string[] {
  if (Array.isArray(value)) {
    return [
      `${indent}${key}: [${value.map((entry) => serializeScalar(entry)).join(", ")}]`,
    ];
  }
  if (typeof value === "object" && value !== null) {
    const lines = [`${indent}${key}:`];
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      lines.push(...serializeNestedValue(childKey, childValue, `${indent}  `));
    }
    return lines;
  }
  return [`${indent}${key}: ${serializeScalar(value)}`];
}

export function stringifyMarkdownFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (
      Array.isArray(value) &&
      value.every((entry) => typeof entry !== "object" || entry === null)
    ) {
      lines.push(
        `${key}: [${value.map((entry) => serializeScalar(entry)).join(", ")}]`,
      );
    } else if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const entry of value) {
        if (typeof entry === "object" && entry !== null) {
          const objectEntries = Object.entries(
            entry as Record<string, unknown>,
          );
          const [firstKey, firstValue] = objectEntries[0] ?? [];
          if (firstKey !== undefined) {
            lines.push(`  - ${firstKey}: ${serializeScalar(firstValue)}`);
            for (const [childKey, childValue] of objectEntries.slice(1)) {
              lines.push(...serializeNestedValue(childKey, childValue, "    "));
            }
          }
        } else {
          lines.push(`  - ${serializeScalar(entry)}`);
        }
      }
    } else {
      lines.push(`${key}: ${serializeScalar(value)}`);
    }
  }
  lines.push("---");
  return `${lines.join("\n")}\n${body}`;
}

function countIndent(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function parseScalarValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const arrayContent = trimmed.slice(1, -1).trim();
    return arrayContent === ""
      ? []
      : arrayContent.split(",").map((item) =>
          item
            .trim()
            .replace(/^["']|["']$/g, "")
            .trim(),
        );
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatterBlock(
  lines: string[],
  startIndex: number,
): { value: unknown; consumed: number } {
  const firstLine = lines[startIndex];
  if (firstLine === undefined) {
    return { value: undefined, consumed: 0 };
  }

  const baseIndent = countIndent(firstLine);
  const firstTrimmed = firstLine.trim();
  if (!firstTrimmed.startsWith("- ")) {
    return { value: undefined, consumed: 0 };
  }

  const values: unknown[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }
    const indent = countIndent(line);
    const trimmed = line.trim();
    if (indent < baseIndent || !trimmed.startsWith("- ")) {
      break;
    }

    const itemText = trimmed.slice(2).trim();
    if (!itemText.includes(":")) {
      values.push(parseScalarValue(itemText));
      index += 1;
      continue;
    }

    const item: Record<string, unknown> = {};
    const itemColon = itemText.indexOf(":");
    item[itemText.slice(0, itemColon).trim()] = parseScalarValue(
      itemText.slice(itemColon + 1).trim(),
    );
    index += 1;

    while (index < lines.length) {
      const childLine = lines[index] ?? "";
      if (childLine.trim().length === 0) {
        index += 1;
        continue;
      }
      const childIndent = countIndent(childLine);
      const childTrimmed = childLine.trim();
      if (childIndent <= baseIndent && childTrimmed.startsWith("- ")) {
        break;
      }
      if (childIndent <= baseIndent) {
        break;
      }

      const childColon = childTrimmed.indexOf(":");
      if (childColon === -1) {
        index += 1;
        continue;
      }
      const childKey = childTrimmed.slice(0, childColon).trim();
      const childValue = childTrimmed.slice(childColon + 1).trim();
      if (childValue.length > 0) {
        item[childKey] = parseScalarValue(childValue);
        index += 1;
        continue;
      }

      const nestedValues: string[] = [];
      index += 1;
      while (index < lines.length) {
        const nestedLine = lines[index] ?? "";
        if (nestedLine.trim().length === 0) {
          index += 1;
          continue;
        }
        const nestedIndent = countIndent(nestedLine);
        const nestedTrimmed = nestedLine.trim();
        if (nestedIndent <= childIndent) {
          break;
        }
        if (nestedTrimmed.startsWith("- ")) {
          const value = parseScalarValue(nestedTrimmed.slice(2).trim());
          if (typeof value === "string" && value.length > 0) {
            nestedValues.push(value);
          }
        }
        index += 1;
      }
      item[childKey] = nestedValues;
    }

    values.push(item);
  }

  return { value: values, consumed: Math.max(0, index - startIndex) };
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
