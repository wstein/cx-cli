import type { CxStyle } from "../config/types.js";
import { CxError } from "../shared/errors.js";

export function countNewlines(content: string): number {
  let count = 0;
  for (const character of content) {
    if (character === "\n") {
      count += 1;
    }
  }
  return count;
}

export function countLogicalLines(content: string): number {
  if (content === "") {
    return 0;
  }

  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
}

export function findContentStartOffset(params: {
  style: CxStyle;
  block: string;
  filePath: string;
}): number {
  const { style, block, filePath } = params;

  if (style === "xml") {
    const tag = `<file path="${filePath}">`;
    const tagStart = block.indexOf(tag);
    if (tagStart === -1) {
      throw new CxError(
        `Unable to locate XML file wrapper while computing output spans for ${filePath}`,
        5,
      );
    }

    let contentStart = tagStart + tag.length;
    if (block[contentStart] === "\n") {
      contentStart += 1;
    }

    return contentStart;
  }

  if (style === "markdown") {
    const heading = `## File: ${filePath}\n`;
    const headingStart = block.indexOf(heading);
    if (headingStart === -1) {
      throw new CxError(
        `Unable to locate Markdown file wrapper while computing output spans for ${filePath}`,
        5,
      );
    }

    const fenceLineEnd = block.indexOf("\n", headingStart + heading.length);
    if (fenceLineEnd === -1) {
      throw new CxError(
        `Unable to locate Markdown fence while computing output spans for ${filePath}`,
        5,
      );
    }

    return fenceLineEnd + 1;
  }

  if (style === "plain") {
    const marker = `================\nFile: ${filePath}\n================\n`;
    const markerStart = block.indexOf(marker);
    if (markerStart === -1) {
      throw new CxError(
        `Unable to locate plain-text file wrapper while computing output spans for ${filePath}`,
        5,
      );
    }

    return markerStart + marker.length;
  }

  return 0;
}
