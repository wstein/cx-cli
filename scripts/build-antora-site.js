import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { syncAntoraDocs } from "./sync-antora-docs.js";

export const DEFAULT_ANTORA_PLAYBOOK = "antora-playbook.yml";
export const DEFAULT_ANTORA_SITE_ROOT = "dist/antora";
export const DEFAULT_ANTORA_CACHE_DIR = ".antora/cache";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function buildAntoraSite({
  playbook = DEFAULT_ANTORA_PLAYBOOK,
  toDir = DEFAULT_ANTORA_SITE_ROOT,
  cacheDir = DEFAULT_ANTORA_CACHE_DIR,
} = {}) {
  await syncAntoraDocs();
  await fs.rm(toDir, { recursive: true, force: true });
  await fs.mkdir(cacheDir, { recursive: true });

  await execa(
    "./node_modules/.bin/antora",
    [playbook, "--to-dir", toDir, "--cache-dir", cacheDir],
    {
      stdio: "pipe",
      env: {
        ANTORA_CACHE_DIR: cacheDir,
      },
    },
  );

  const indexPath = path.join(toDir, "index.html");
  const rootDocsIndexPath = path.join(toDir, "cx", "0.4", "index.html");

  const hasRootIndex = await pathExists(indexPath);
  const hasVersionedIndex = await pathExists(rootDocsIndexPath);

  if (!hasRootIndex && !hasVersionedIndex) {
    throw new Error(`Antora build did not produce an index page in ${toDir}.`);
  }

  return {
    playbook,
    siteRoot: toDir,
    indexPath: hasVersionedIndex ? rootDocsIndexPath : indexPath,
  };
}

async function main() {
  const result = await buildAntoraSite();
  console.log(`Built Antora site at ${result.siteRoot}.`);
}

if (process.argv[1]) {
  const entryHref = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryHref) {
    main().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to build Antora site: ${message}`);
      process.exitCode = 1;
    });
  }
}
