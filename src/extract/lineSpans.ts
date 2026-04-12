export function splitOutputLines(source: string): string[] {
  return source.split("\n");
}

export function readSpanContent(
  lines: string[],
  startLine: number | null,
  endLine: number | null,
): string | undefined {
  if (startLine === null || endLine === null) {
    return undefined;
  }
  if (startLine < 1 || endLine < startLine) {
    return undefined;
  }

  const startIndex = startLine - 1;
  const endIndex = endLine;
  if (startIndex >= lines.length || endIndex > lines.length) {
    return undefined;
  }

  return lines.slice(startIndex, endIndex).join("\n");
}
