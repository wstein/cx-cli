import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

export function createReleaseAssurancePaths(cwd = process.cwd()) {
  const tarballDir = path.join(cwd, "tarball-artifacts");
  return {
    tarballDir,
    releaseIntegrityPath: path.join(cwd, "dist", "release-integrity.json"),
    npmCacheDir: path.join(tarballDir, ".npm-cache"),
  };
}

export function createNpmPackEnv(
  tarballDir,
  baseEnv = process.env,
) {
  return {
    ...baseEnv,
    npm_config_cache: path.join(tarballDir, ".npm-cache"),
  };
}

export async function runReleaseAssuranceSmoke(cwd = process.cwd()) {
  const { tarballDir, releaseIntegrityPath, npmCacheDir } =
    createReleaseAssurancePaths(cwd);

  await fs.rm(tarballDir, { recursive: true, force: true });
  await fs.mkdir(tarballDir, { recursive: true });
  await fs.mkdir(npmCacheDir, { recursive: true });

  const packOutput = await runJson("npm", [
    "pack",
    "--json",
    "--pack-destination",
    "tarball-artifacts",
  ], createNpmPackEnv(tarballDir));
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

const executedAsScript =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executedAsScript) {
  runReleaseAssuranceSmoke().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Release integrity smoke failed: ${message}`);
    process.exit(1);
  });
}
