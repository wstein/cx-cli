import crypto from "node:crypto";
import fs from "node:fs/promises";

export async function sha256File(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function sha256Text(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256NormalizedText(value: string): string {
  return sha256Text(normalizeText(value));
}
