import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { main } from "../dist/src/index.js";
import { loadManifestFromBundle } from "../dist/src/bundle/validate.js";

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function runRuntimeCompatSmoke() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-bun-compat-"));
  const configPath = path.join(root, "cx.toml");
  const restoreDir = path.join(root, "restored");
  const sourceFile = path.join(root, "src", "index.ts");

  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(sourceFile, 'export const runtime = "compat";\n', "utf8");
  await fs.writeFile(path.join(root, "docs", "guide.md"), "# Compat\n", "utf8");
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "compat"
source_root = "."
output_dir = "dist/compat-bundle"

[repomix]
style = "json"
compress = false
remove_comments = false
remove_empty_lines = false
show_line_numbers = false
include_empty_directories = false
security_check = false

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[manifest]
include_output_spans = false

[sections.docs]
include = ["docs/**"]
exclude = []

[sections.src]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );

  const bundleExitCode = await main(["bundle", "--config", configPath]);
  if (bundleExitCode !== 0) {
    throw new Error(`bundle smoke failed with exit code ${bundleExitCode}`);
  }

  const bundleDir = path.join(root, "dist", "compat-bundle");
  const { manifest } = await loadManifestFromBundle(bundleDir);
  const textRows = manifest.files.filter((entry) => entry.kind === "text");
  if (textRows.length === 0) {
    throw new Error("bundle smoke produced no text rows");
  }
  for (const row of textRows) {
    if (row.outputStartLine !== null || row.outputEndLine !== null) {
      throw new Error("json bundle unexpectedly emitted output spans");
    }
  }

  const extractExitCode = await main([
    "extract",
    bundleDir,
    "--file",
    "src/index.ts",
    "--to",
    restoreDir,
  ]);
  if (extractExitCode !== 0) {
    throw new Error(`extract smoke failed with exit code ${extractExitCode}`);
  }

  const restoredPath = path.join(restoreDir, "src", "index.ts");
  const restoredSource = await readText(restoredPath);
  const originalSource = await readText(sourceFile);
  if (restoredSource.trimEnd() !== originalSource.trimEnd()) {
    throw new Error("extracted file did not preserve the expected source content");
  }
}

await runRuntimeCompatSmoke();
