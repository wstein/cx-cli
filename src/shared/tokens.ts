import fs from "node:fs/promises";

import type { TiktokenEncoding } from "tiktoken";
import { get_encoding } from "tiktoken";

import { CxError } from "./errors.js";

type Encoder = ReturnType<typeof get_encoding>;

const encoders = new Map<string, Encoder>();

function getEncoder(encoding: string): Encoder {
  let encoder = encoders.get(encoding);
  if (!encoder) {
    try {
      encoder = get_encoding(encoding as TiktokenEncoding);
    } catch (error) {
      throw new CxError(
        `Unable to initialize tokenizer encoding "${encoding}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        2,
      );
    }
    encoders.set(encoding, encoder);
  }
  return encoder;
}

function releaseEncoders(): void {
  for (const encoder of encoders.values()) {
    encoder.free();
  }
  encoders.clear();
}

process.once("exit", releaseEncoders);

export function countTokens(text: string, encoding: string): number {
  return getEncoder(encoding).encode(text, [], []).length;
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
