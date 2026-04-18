/**
 * Reproducibility check: build twice, compare sha256 of dist/*.js.
 * Mirrors the CI reproducibility job for local certification.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function run(command, args) {
  await execa(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
}

async function hashDir(dir) {
  const entries = await fs.readdir(dir, { recursive: true });
  const hashes = [];
  for (const entry of entries.sort()) {
    const full = path.join(dir, entry);
    const stat = await fs.stat(full);
    if (stat.isFile() && entry.endsWith(".js")) {
      const content = await fs.readFile(full);
      const hash = createHash("sha256").update(content).digest("hex");
      hashes.push(`${hash}  ${entry}`);
    }
  }
  return hashes.join("\n");
}

const distDir = path.join(ROOT, "dist");

console.log("reproducibility: first build...");
await run("bun", ["run", "build"]);
const first = await hashDir(distDir);

console.log("reproducibility: cleaning dist/...");
await fs.rm(distDir, { recursive: true, force: true });

console.log("reproducibility: second build...");
await run("bun", ["run", "build"]);
const second = await hashDir(distDir);

if (first !== second) {
  console.error("✗ Build output differs between runs:");
  const a = first.split("\n");
  const b = second.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.error(`  - ${a[i] ?? "(missing)"}`);
      console.error(`  + ${b[i] ?? "(missing)"}`);
    }
  }
  process.exit(1);
}

console.log(`✓ Builds are reproducible (${first.split("\n").length} files)`);
