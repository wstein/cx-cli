import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect } from "vitest";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import {
  type BundleArgs,
  runBundleCommand,
} from "../../src/cli/commands/bundle.js";
import {
  runValidateCommand,
  type ValidateArgs,
} from "../../src/cli/commands/validate.js";
import {
  runVerifyCommand,
  type VerifyArgs,
} from "../../src/cli/commands/verify.js";
import { sha256File } from "../../src/shared/hashing.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import {
  type BuildConfigOptions,
  buildConfig,
} from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

const execFileAsync = promisify(execFile);

export async function commandAvailable(binary: string): Promise<boolean> {
  try {
    await execFileAsync("which", [binary]);
    return true;
  } catch {
    return false;
  }
}

async function initializeHgRepository(rootDir: string): Promise<void> {
  await execFileAsync("hg", ["init"], { cwd: rootDir });
  await execFileAsync("hg", ["add"], { cwd: rootDir });
  await execFileAsync("hg", ["commit", "-u", "cx", "-m", "init"], {
    cwd: rootDir,
  });
}

async function initializeFossilRepository(rootDir: string): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cx-fossil-home-"));
  const home = path.join(tempRoot, "home");
  const config = path.join(tempRoot, "config");
  const repoPath = path.join(rootDir, ".fossil-repo.fossil");
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(config, { recursive: true });
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: config,
    FOSSIL_HOME: home,
  };

  await execFileAsync("fossil", ["init", repoPath], { cwd: rootDir, env });
  await execFileAsync("fossil", ["open", repoPath, "--force"], {
    cwd: rootDir,
    env,
  });
  await execFileAsync("fossil", ["addremove"], { cwd: rootDir, env });
  await execFileAsync(
    "fossil",
    ["commit", "-m", "init", "--user-override", "cx"],
    { cwd: rootDir, env },
  );
}

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
  initializeGit?: boolean;
  initializeHg?: boolean;
  initializeFossil?: boolean;
  fixture?: string;
  config?: BuildConfigOptions;
  files?: Record<string, string | Uint8Array>;
}): Promise<{
  root: string;
  configPath: string;
  bundleDir: string;
}> {
  const includeLinkedNotes =
    options?.includeLinkedNotes ??
    options?.config?.manifest?.includeLinkedNotes ??
    false;

  const workspace = await createWorkspace({
    fixture: options?.fixture ?? "bundle-basic",
    config: buildConfig({
      ...options?.config,
      assets: {
        targetDir: "assets",
        ...(options?.config?.assets ?? {}),
      },
      manifest: {
        ...(options?.config?.manifest ?? {}),
        includeLinkedNotes,
      },
    }),
    files: {
      ...(includeLinkedNotes
        ? {
            "src/index.ts":
              '// [[Linked Note]]\nexport const demo = "================";\n',
            "notes/linked-note.md": `---
id: 20260414120000
title: Linked Note
aliases: []
tags: []
target: current
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
      ...(options?.files ?? {}),
    },
  });

  if (options?.initializeGit === true) {
    await execFileAsync("git", ["init", "-q"], { cwd: workspace.rootDir });
    await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
      cwd: workspace.rootDir,
    });
    await execFileAsync("git", ["config", "user.name", "cx"], {
      cwd: workspace.rootDir,
    });
    await execFileAsync("git", ["add", "."], { cwd: workspace.rootDir });
    await execFileAsync("git", ["commit", "-q", "-m", "init"], {
      cwd: workspace.rootDir,
    });
  }

  if (options?.initializeHg === true) {
    await initializeHgRepository(workspace.rootDir);
  }

  if (options?.initializeFossil === true) {
    await initializeFossilRepository(workspace.rootDir);
  }

  return {
    root: workspace.rootDir,
    configPath: workspace.configPath,
    bundleDir: workspace.bundleDir,
  };
}

export async function seedAntoraDocs(rootDir: string): Promise<void> {
  await fs.mkdir(path.join(rootDir, "docs"), { recursive: true });
  await fs.cp(
    path.join(process.cwd(), "docs", "modules"),
    path.join(rootDir, "docs", "modules"),
    {
      recursive: true,
    },
  );
  await fs.copyFile(
    path.join(process.cwd(), "docs", "antora.yml"),
    path.join(rootDir, "docs", "antora.yml"),
  );
  await fs.copyFile(
    path.join(process.cwd(), "antora-playbook.yml"),
    path.join(rootDir, "antora-playbook.yml"),
  );

  const gitDir = path.join(rootDir, ".git");
  const gitStat = await fs.stat(gitDir).catch(() => undefined);
  if (!gitStat?.isDirectory()) {
    await execFileAsync("git", ["init", "-q"], { cwd: rootDir });
    await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
      cwd: rootDir,
    });
    await execFileAsync("git", ["config", "user.name", "cx"], {
      cwd: rootDir,
    });
    await execFileAsync("git", ["add", "."], { cwd: rootDir });
    await execFileAsync("git", ["commit", "-q", "-m", "seed-docs"], {
      cwd: rootDir,
    });
  }
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

export async function runQuietBundleCommand(args: BundleArgs): Promise<number> {
  const capture = createBufferedCommandIo();
  return runBundleCommand(args, capture.io);
}

export async function runQuietValidateCommand(
  args: ValidateArgs,
): Promise<number> {
  const capture = createBufferedCommandIo();
  return runValidateCommand(args, capture.io);
}

export async function runQuietVerifyCommand(args: VerifyArgs): Promise<number> {
  const capture = createBufferedCommandIo();
  return runVerifyCommand(args, capture.io);
}
