import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

export async function runCommand(
  command,
  args,
  envOverrides = {},
  options = {},
) {
  const execaImpl = options.execaImpl ?? execa;
  const baseEnv = options.baseEnv ?? process.env;
  await execaImpl(command, args, {
    stdio: "inherit",
    env: { ...baseEnv, ...envOverrides },
  });
}

export async function runJsonCommand(
  command,
  args,
  envOverrides = {},
  options = {},
) {
  const execaImpl = options.execaImpl ?? execa;
  const baseEnv = options.baseEnv ?? process.env;
  const { stdout } = await execaImpl(command, args, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
    env: { ...baseEnv, ...envOverrides },
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

export async function runReleaseAssuranceSmoke(cwd = process.cwd(), options = {}) {
  const fsImpl = options.fsImpl ?? fs;
  const baseEnv = options.baseEnv ?? process.env;
  const runImpl = options.runImpl ?? runCommand;
  const runJsonImpl = options.runJsonImpl ?? runJsonCommand;
  const parseJson = options.parseJson ?? JSON.parse;
  const log = options.log ?? console.log;
  const execPath = options.execPath ?? process.execPath;

  const { tarballDir, releaseIntegrityPath, npmCacheDir } =
    createReleaseAssurancePaths(cwd);

  await fsImpl.rm(tarballDir, { recursive: true, force: true });
  await fsImpl.mkdir(tarballDir, { recursive: true });
  await fsImpl.mkdir(npmCacheDir, { recursive: true });

  try {
    const packOutput = await runJsonImpl(
      "npm",
      ["pack", "--json", "--pack-destination", "tarball-artifacts"],
      createNpmPackEnv(tarballDir, baseEnv),
      { baseEnv },
    );
    const packResult = parseJson(packOutput);
    const tarballName = packResult[0]?.filename;
    if (typeof tarballName !== "string" || tarballName.length === 0) {
      throw new Error("npm pack did not return a tarball filename");
    }
    log(`✓ Packed release tarball: ${tarballName}`);

    await runImpl(execPath, ["scripts/release-integrity.js"], {}, { baseEnv });
    await runImpl(execPath, ["scripts/verify-release.js"], {}, { baseEnv });
  } finally {
    // Keep local certify runs clean by removing transient release-smoke artifacts.
    await fsImpl.rm(tarballDir, { recursive: true, force: true });
    await fsImpl.rm(releaseIntegrityPath, { force: true });
  }
  log("✓ Release integrity smoke completed");
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
