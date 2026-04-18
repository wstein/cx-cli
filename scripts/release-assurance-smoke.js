import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

async function run(command, args, envOverrides = {}) {
  await execa(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...envOverrides },
  });
}

async function runJson(command, args, envOverrides = {}) {
  const { stdout } = await execa(command, args, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
    env: { ...process.env, ...envOverrides },
  });
  return stdout;
}

async function main() {
  const tarballDir = path.join(process.cwd(), "tarball-artifacts");
  const releaseIntegrityPath = path.join(
    process.cwd(),
    "dist",
    "release-integrity.json",
  );
  const npmCacheDir = path.join(tarballDir, ".npm-cache");

  await fs.rm(tarballDir, { recursive: true, force: true });
  await fs.mkdir(tarballDir, { recursive: true });
  await fs.mkdir(npmCacheDir, { recursive: true });

  const packOutput = await runJson("npm", [
    "pack",
    "--json",
    "--pack-destination",
    "tarball-artifacts",
  ], {
    npm_config_cache: npmCacheDir,
  });
  const packResult = JSON.parse(packOutput);
  const tarballName = packResult[0]?.filename;
  if (typeof tarballName !== "string" || tarballName.length === 0) {
    throw new Error("npm pack did not return a tarball filename");
  }
  console.log(`✓ Packed release tarball: ${tarballName}`);

  await run(process.execPath, ["scripts/release-integrity.js"]);
  await run(process.execPath, ["scripts/verify-release.js"]);

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
