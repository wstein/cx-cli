import fs from "node:fs/promises";

import type { AdapterStructuredPack } from "../adapter/types.js";
import { relativePosix } from "../shared/fs.js";
import { normalizeText, sha256Text } from "../shared/hashing.js";
import { detectMediaType } from "../shared/mime.js";
import {
  defaultTokenizerProvider,
  type TokenizerProvider,
} from "../shared/tokenizer.js";
import type { StructuredRenderEntry, StructuredRenderPlan } from "./types.js";

function detectLanguage(relativePath: string): string | undefined {
  const mediaType = detectMediaType(relativePath, "text");

  switch (mediaType) {
    case "text/typescript":
      return "typescript";
    case "text/javascript":
      return "javascript";
    case "application/json":
      return "json";
    case "text/markdown":
      return "markdown";
    case "text/x-python":
      return "python";
    case "text/x-rust":
      return "rust";
    case "text/x-go":
      return "go";
    case "text/x-java-source":
      return "java";
    case "text/yaml":
      return "yaml";
    case "text/toml":
      return "toml";
    case "application/xml":
      return "xml";
    case "text/html":
      return "html";
    case "text/css":
      return "css";
    default:
      return undefined;
  }
}

function normalizePackedContent(content: string): string {
  const normalized = normalizeText(content);
  return normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
}

export async function buildStructuredPlanFromFiles(params: {
  sourceRoot: string;
  explicitFiles: string[];
  encoding: string;
  tokenizer?: TokenizerProvider;
}): Promise<StructuredRenderPlan> {
  const tokenizer = params.tokenizer ?? defaultTokenizerProvider;
  const entries: StructuredRenderEntry[] = [];

  for (const absolutePath of params.explicitFiles) {
    const content = normalizePackedContent(
      await fs.readFile(absolutePath, "utf8"),
    );
    const relativePath = relativePosix(params.sourceRoot, absolutePath);
    const language = detectLanguage(relativePath);

    entries.push({
      path: relativePath,
      content,
      sha256: sha256Text(content),
      tokenCount: tokenizer.countTokens(content, params.encoding),
      ...(language === undefined ? {} : { language }),
    });
  }

  entries.sort((left, right) => left.path.localeCompare(right.path, "en"));

  return {
    entries,
    ordering: entries.map((entry) => entry.path),
  };
}

/**
 * Extract a kernel-owned structured render plan from adapter output.
 *
 * The adapter may remain the temporary oracle, but the deterministic plan we
 * verify against belongs to the render kernel.
 */
export function extractStructuredPlan(
  structuredPack: AdapterStructuredPack,
): StructuredRenderPlan {
  const entries: StructuredRenderEntry[] = [];

  for (const entry of structuredPack.entries) {
    entries.push({
      path: entry.path,
      content: entry.content,
      sha256: sha256Text(entry.content),
      tokenCount: entry.metadata.tokenCount ?? 0,
      ...(entry.metadata.language === undefined
        ? {}
        : { language: entry.metadata.language }),
    });
  }

  entries.sort((left, right) => left.path.localeCompare(right.path));

  return {
    entries,
    ordering: entries.map((entry) => entry.path),
  };
}
