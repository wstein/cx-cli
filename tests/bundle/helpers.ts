import fs from "node:fs/promises";
import path from "node:path";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { sha256File } from "../../src/shared/hashing.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

function countLogicalLines(content: string): number {
  if (content === "") {
    return 0;
  }

  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
}

function countNewlines(content: string): number {
  let count = 0;
  for (const character of content) {
    if (character === "\n") {
      count += 1;
    }
  }
  return count;
}

export function findExpectedContentStartLine(params: {
  output: string;
  style: "xml" | "markdown" | "json" | "plain";
  filePath: string;
}): number {
  const { output, style, filePath } = params;

  if (style === "xml") {
    const marker = `<file path="${filePath}">`;
    const markerOffset = output.indexOf(marker);
    if (markerOffset === -1) {
      throw new Error(`Missing XML marker for ${filePath}`);
    }
    const contentStart = markerOffset + marker.length + 1;
    return countNewlines(output.slice(0, contentStart)) + 1;
  }

  if (style === "markdown") {
    const heading = `## File: ${filePath}\n`;
    const headingOffset = output.indexOf(heading);
    if (headingOffset === -1) {
      throw new Error(`Missing Markdown heading for ${filePath}`);
    }
    const fenceLineEnd = output.indexOf("\n", headingOffset + heading.length);
    if (fenceLineEnd === -1) {
      throw new Error(`Missing Markdown code fence for ${filePath}`);
    }
    const contentStart = fenceLineEnd + 1;
    return countNewlines(output.slice(0, contentStart)) + 1;
  }

  if (style === "plain") {
    const marker = `================\nFile: ${filePath}\n================\n`;
    const markerOffset = output.indexOf(marker);
    if (markerOffset === -1) {
      throw new Error(`Missing plain marker for ${filePath}`);
    }
    const contentStart = markerOffset + marker.length;
    return countNewlines(output.slice(0, contentStart)) + 1;
  }

  const keyMarker = `\n    ${JSON.stringify(filePath)}: `;
  const keyOffset = output.indexOf(keyMarker);
  if (keyOffset === -1) {
    throw new Error(`Missing JSON key for ${filePath}`);
  }
  const contentStart = keyOffset + 1;
  return countNewlines(output.slice(0, contentStart)) + 1;
}

export async function expectExtractedFilesToMatchManifest(params: {
  bundleDir: string;
  restoreDir: string;
}): Promise<void> {
  const { manifest } = await loadManifestFromBundle(params.bundleDir);
  for (const row of manifest.files) {
    const extractedPath = path.join(params.restoreDir, row.path);
    expect(await sha256File(extractedPath)).toBe(row.sha256);
  }
}

export async function createProject(options?: {
  includeSpecialChecksumFile?: boolean;
  includeLinkedNotes?: boolean;
}): Promise<{
  root: string;
  configPath: string;
  bundleDir: string;
}> {
  const workspace = await createWorkspace({
    fixture: "bundle-basic",
    config: buildConfig({
      assets: {
        targetDir: "assets",
      },
      manifest: {
        includeLinkedNotes: options?.includeLinkedNotes ?? false,
      },
    }),
    files: {
      ...(options?.includeLinkedNotes
        ? {
            "src/index.ts":
              '// [[Linked Note]]\nexport const demo = "================";\n',
            "notes/linked-note.md": `---
id: 20260414120000
title: Linked Note
aliases: []
tags: []
---

This note is linked from source code.

## Links

- [[README.md]]
`,
          }
        : {}),
      ...(options?.includeSpecialChecksumFile
        ? {
            "src/special cases/checksum + edge.ts":
              "export const special = true;\n",
          }
        : {}),
    },
  });

  return {
    root: workspace.rootDir,
    configPath: workspace.configPath,
    bundleDir: workspace.bundleDir,
  };
}

export async function tamperSectionOutput(
  bundleDir: string,
  sectionName: string,
  from: string,
  to: string,
): Promise<void> {
  const { manifest } = await loadManifestFromBundle(bundleDir);
  const section = manifest.sections.find((entry) => entry.name === sectionName);
  if (!section) {
    throw new Error(`Missing section ${sectionName} in bundle.`);
  }

  const sectionPath = path.join(bundleDir, section.outputFile);
  const source = await fs.readFile(sectionPath, "utf8");
  if (!source.includes(from)) {
    throw new Error(`Missing tamper target in ${section.outputFile}.`);
  }
  await fs.writeFile(sectionPath, source.replace(from, to), "utf8");
}

export async function readLogicalLineCount(filePath: string): Promise<number> {
  return countLogicalLines(await fs.readFile(filePath, "utf8"));
}
