import fs from "node:fs/promises";
import path from "node:path";

export async function writeFiles(params: {
  rootDir: string;
  files: Record<string, string | Uint8Array>;
}): Promise<void> {
  for (const [relativePath, content] of Object.entries(params.files)) {
    const targetPath = path.join(params.rootDir, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content);
  }
}