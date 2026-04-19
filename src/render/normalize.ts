import { sha256NormalizedText } from "../shared/hashing.js";

export function hashNormalizedRenderText(content: string): string {
  return sha256NormalizedText(content);
}
