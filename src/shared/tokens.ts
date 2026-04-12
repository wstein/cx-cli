import fs from "node:fs/promises";

import * as cl100k_base from "gpt-tokenizer/encoding/cl100k_base";
import * as o200k_base from "gpt-tokenizer/encoding/o200k_base";
import * as o200k_harmony from "gpt-tokenizer/encoding/o200k_harmony";
import * as p50k_base from "gpt-tokenizer/encoding/p50k_base";
import * as p50k_edit from "gpt-tokenizer/encoding/p50k_edit";
import * as r50k_base from "gpt-tokenizer/encoding/r50k_base";

import { CxError } from "./errors.js";

type Encoding = {
  countTokens: (text: string) => number;
};

const ENCODING_MAP: Record<string, Encoding> = {
  r50k_base,
  p50k_base,
  p50k_edit,
  cl100k_base,
  o200k_base,
  o200k_harmony,
};

function getEncoding(name: string): Encoding {
  const encoding = ENCODING_MAP[name.toLowerCase()];
  if (!encoding) {
    const supported = Object.keys(ENCODING_MAP).join(", ");
    throw new CxError(
      `Unknown tokenizer encoding "${name}". Supported encodings: ${supported}`,
      2,
    );
  }
  return encoding;
}

export function countTokens(text: string, encoding: string): number {
  try {
    return getEncoding(encoding).countTokens(text);
  } catch (error) {
    if (error instanceof CxError) {
      throw error;
    }
    throw new CxError(
      `Error counting tokens with encoding "${encoding}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      2,
    );
  }
}

export async function countTokensForFiles(
  paths: string[],
  encoding: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (const filePath of paths) {
    const content = await fs.readFile(filePath, "utf8");
    counts.set(filePath, countTokens(content, encoding));
  }

  return counts;
}
