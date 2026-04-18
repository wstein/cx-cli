import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
}

function runJson(command, args) {
  const result = spawnSync(command, args, {
    stdio: ["ignore", "pipe", "inherit"],
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
  return result.stdout;
}

async function main() {
  const tarballDir = path.join(process.cwd(), "tarball-artifacts");
  const releaseIntegrityPath = path.join(
    process.cwd(),
    "dist",
    "release-integrity.json",
  );

  await fs.rm(tarballDir, { recursive: true, force: true });
  await fs.mkdir(tarballDir, { recursive: true });

  const packOutput = runJson("npm", [
    "pack",
    "--json",
    "--pack-destination",
    "tarball-artifacts",
  ]);
  const packResult = JSON.parse(packOutput);
  const tarballName = packResult[0]?.filename;
  if (typeof tarballName !== "string" || tarballName.length === 0) {
    throw new Error("npm pack did not return a tarball filename");
  }
  console.log(`✓ Packed release tarball: ${tarballName}`);

  run(process.execPath, ["scripts/release-integrity.js"]);
  run(process.execPath, ["scripts/verify-release.js"]);

  // Keep local certify runs clean by removing transient release-smoke artifacts.
  await fs.rm(tarballDir, { recursive: true, force: true });
  await fs.rm(releaseIntegrityPath, { force: true });

  console.log("✓ Release integrity smoke completed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`✗ Release integrity smoke failed: ${message}`);
  process.exit(1);
});
