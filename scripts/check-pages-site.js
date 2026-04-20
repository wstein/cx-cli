import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_SITE_ROOT = "dist/site";

async function readRequiredFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Missing required Pages artifact: ${filePath} (${message})`);
  }
}

function assertContains(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

export async function checkPagesSite({ siteRoot = DEFAULT_SITE_ROOT } = {}) {
  const rootIndexPath = path.join(siteRoot, "index.html");
  const docsIndexPath = path.join(siteRoot, "docs", "index.html");
  const schemasIndexPath = path.join(siteRoot, "schemas", "index.html");
  const noJekyllPath = path.join(siteRoot, ".nojekyll");
  const coverageIndexPath = path.join(siteRoot, "coverage", "index.html");

  const rootIndex = await readRequiredFile(rootIndexPath);
  await readRequiredFile(docsIndexPath);
  const schemasIndex = await readRequiredFile(schemasIndexPath);
  await readRequiredFile(noJekyllPath);

  assertContains(rootIndex, 'href="docs/"', 'Pages root index must link to /docs/.');
  assertContains(rootIndex, 'href="schemas/"', 'Pages root index must link to /schemas/.');
  assertContains(rootIndex, 'href="coverage/"', 'Pages root index must link to /coverage/.');
  assertContains(
    schemasIndex,
    "Back to CX publish surface",
    "Schemas index must link back to the root publish surface.",
  );

  await readRequiredFile(coverageIndexPath);

  return {
    siteRoot,
    hasCoverage: true,
  };
}

async function main() {
  const result = await checkPagesSite();
  console.log(`Validated Pages site at ${result.siteRoot} with coverage.`);
}

if (process.argv[1]) {
  const entryHref = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryHref) {
    main().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Pages smoke check failed: ${message}`);
      process.exitCode = 1;
    });
  }
}
