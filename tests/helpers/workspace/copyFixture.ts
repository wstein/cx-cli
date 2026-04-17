import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/workspaces",
);

export async function copyFixture(params: {
  fixturePath: string;
  destinationPath: string;
}): Promise<void> {
  const sourcePath = path.isAbsolute(params.fixturePath)
    ? params.fixturePath
    : path.join(FIXTURES_ROOT, params.fixturePath);

  await fs.cp(sourcePath, params.destinationPath, { recursive: true });
}
