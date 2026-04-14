import fs from "node:fs/promises";
import path from "node:path";

async function copyDirectory(source: string, target: string): Promise<void> {
  const entries = await fs.readdir(source, { withFileTypes: true });
  await fs.mkdir(target, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function main(): Promise<void> {
  const root = path.resolve(".");
  const source = path.join(root, "src", "templates", "init-templates");
  const target = path.join(root, "dist", "src", "templates", "init-templates");

  await copyDirectory(source, target);
  console.log(`Copied init templates from ${source} to ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
