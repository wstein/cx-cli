import fs from "node:fs/promises";
import path from "node:path";

import type { CxConfig } from "../config/types.js";
import { buildMasterList } from "../planning/overlaps.js";
import { CxError } from "../shared/errors.js";
import { detectMediaType } from "../shared/mime.js";
import { getVCSState } from "../vcs/provider.js";

export interface CxMcpWorkspace {
  config: CxConfig;
  sourceRoot: string;
  resolveMasterList(): Promise<string[]>;
}

export interface CxMcpFileRecord {
  path: string;
  sizeBytes: number;
  mtime: string;
  mediaType: string;
}

export interface CxMcpMatchRecord {
  path: string;
  lineNumber: number;
  line: string;
}

export interface CxMcpSearchResult {
  pattern: string;
  regex: boolean;
  caseSensitive: boolean;
  fileCount: number;
  matchCount: number;
  truncated: boolean;
  matches: CxMcpMatchRecord[];
}

export interface CxMcpReadResult {
  path: string;
  lineStart: number;
  lineEnd: number;
  lineCount: number;
  content: string;
}

function normalizePrefix(prefix?: string): string {
  if (!prefix) {
    return "";
  }

  return prefix.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function matchesPrefix(filePath: string, prefix: string): boolean {
  if (!prefix) {
    return true;
  }

  return filePath === prefix || filePath.startsWith(`${prefix}/`);
}

function buildSearchRegex(
  pattern: string,
  regex: boolean,
  caseSensitive: boolean,
): RegExp {
  const source = regex
    ? pattern
    : pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = caseSensitive ? "u" : "iu";

  return new RegExp(source, flags);
}

function isTextLike(content: string): boolean {
  return !content.includes("\u0000");
}

function isSearchableMediaType(mediaType: string): boolean {
  return (
    !mediaType.startsWith("image/") &&
    mediaType !== "application/pdf" &&
    mediaType !== "application/octet-stream"
  );
}

export function createCxMcpWorkspace(
  config: CxConfig,
): CxMcpWorkspace {
  const sourceRoot = path.resolve(config.sourceRoot);
  let masterListPromise: Promise<string[]> | undefined;

  return {
    config,
    sourceRoot,
    resolveMasterList: async () => {
      if (!masterListPromise) {
        masterListPromise = (async () => {
          const vcsState = await getVCSState(sourceRoot);
          return buildMasterList(config, vcsState);
        })();
      }

      return masterListPromise;
    },
  };
}

export async function listWorkspaceFiles(
  workspace: CxMcpWorkspace,
  prefix?: string,
): Promise<CxMcpFileRecord[]> {
  const normalizedPrefix = normalizePrefix(prefix);
  const masterList = await workspace.resolveMasterList();
  const records: CxMcpFileRecord[] = [];

  for (const relativePath of masterList) {
    if (!matchesPrefix(relativePath, normalizedPrefix)) {
      continue;
    }

    const absolutePath = path.join(workspace.sourceRoot, relativePath);
    try {
      const stat = await fs.stat(absolutePath);
      records.push({
        path: relativePath,
        sizeBytes: stat.size,
        mtime: stat.mtime.toISOString(),
        mediaType: detectMediaType(relativePath, "text"),
      });
    } catch {
      // Skip files that disappeared after planning.
    }
  }

  return records;
}

export async function grepWorkspaceFiles(
  workspace: CxMcpWorkspace,
  params: {
    pattern: string;
    regex?: boolean;
    caseSensitive?: boolean;
    prefix?: string;
    limit?: number;
  },
): Promise<CxMcpSearchResult> {
  const normalizedPrefix = normalizePrefix(params.prefix);
  const regex = params.regex === true;
  const caseSensitive = params.caseSensitive === true;
  const limit = Math.max(1, Math.floor(params.limit ?? 100));
  const searchRegex = buildSearchRegex(
    params.pattern,
    regex,
    caseSensitive,
  );
  const masterList = await workspace.resolveMasterList();
  const matches: CxMcpMatchRecord[] = [];
  let fileCount = 0;

  for (const relativePath of masterList) {
    if (!matchesPrefix(relativePath, normalizedPrefix)) {
      continue;
    }

    const mediaType = detectMediaType(relativePath, "text");
    if (!isSearchableMediaType(mediaType)) {
      continue;
    }

    const absolutePath = path.join(workspace.sourceRoot, relativePath);
    let source: string;
    try {
      source = await fs.readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    if (!isTextLike(source)) {
      continue;
    }

    fileCount += 1;
    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === undefined || !searchRegex.test(line)) {
        continue;
      }

      matches.push({
        path: relativePath,
        lineNumber: index + 1,
        line: line.trimEnd(),
      });

      if (matches.length >= limit) {
        return {
          pattern: params.pattern,
          regex,
          caseSensitive,
          fileCount,
          matchCount: matches.length,
          truncated: true,
          matches,
        };
      }
    }
  }

  return {
    pattern: params.pattern,
    regex,
    caseSensitive,
    fileCount,
    matchCount: matches.length,
    truncated: false,
    matches,
  };
}

export async function readWorkspaceFile(
  workspace: CxMcpWorkspace,
  params: {
    path: string;
    startLine?: number;
    endLine?: number;
  },
): Promise<CxMcpReadResult> {
  const normalizedPath = normalizePrefix(params.path);
  if (!normalizedPath) {
    throw new CxError("path is required.", 2);
  }

  const masterList = await workspace.resolveMasterList();
  if (!masterList.includes(normalizedPath)) {
    throw new CxError(
      `File ${normalizedPath} is not available in the workspace scope.`,
      2,
    );
  }

  const absolutePath = path.join(workspace.sourceRoot, normalizedPath);
  const source = await fs.readFile(absolutePath, "utf8");
  if (!isTextLike(source)) {
    throw new CxError(`File ${normalizedPath} is not readable as text.`, 2);
  }

  const lines = source.split(/\r?\n/);
  const lineCount = lines.length;
  const startLine = Math.max(1, Math.floor(params.startLine ?? 1));
  const endLine = Math.min(
    lineCount,
    Math.max(startLine, Math.floor(params.endLine ?? lineCount)),
  );
  const content = lines.slice(startLine - 1, endLine).join("\n");

  return {
    path: normalizedPath,
    lineStart: startLine,
    lineEnd: endLine,
    lineCount,
    content,
  };
}
