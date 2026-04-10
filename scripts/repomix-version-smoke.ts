import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runBundleCommand } from "../src/cli/commands/bundle.js";

const expectSuccess = Bun.argv.includes("--expect-success");

async function main(): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-repomix-smoke-"));
  const configPath = path.join(root, "cx.toml");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    "export const smoke = 1;\n",
    "utf8",
  );
  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "smoke"
source_root = "."
output_dir = "dist/smoke-bundle"

[repomix]
style = "xml"
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

[sections.src]
include = ["src/**"]
exclude = []
`,
    "utf8",
  );

  try {
    await runBundleCommand({ config: configPath });
    if (!expectSuccess) {
      throw new Error(
        "Expected bundle command to fail for unsupported repomix version.",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (expectSuccess) {
      throw error;
    }
    if (!message.includes("Unsupported repomix version")) {
      throw error;
    }
  }
}

await main();
