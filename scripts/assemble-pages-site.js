import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_SITE_ROOT = "site";
export const DEFAULT_SCHEMAS_DIR = "schemas";
export const DEFAULT_COVERAGE_DIR = "coverage/vitest";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function renderRootIndex({ hasCoverage }) {
  const coverageCard = hasCoverage
    ? [
        '      <section class="card">',
        "        <h2>Coverage</h2>",
        "        <p>Browse the published Vitest HTML coverage report from the last successful main-branch CI proof run.</p>",
        '        <p><a href="coverage/">Open coverage status</a></p>',
        "      </section>",
      ]
    : [
        '      <section class="card">',
        "        <h2>Coverage</h2>",
        "        <p>This Pages publish does not include a coverage report.</p>",
        "      </section>",
      ];

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "    <title>CX Pages</title>",
    "    <style>",
    "      :root {",
    "        color-scheme: light;",
    "        --bg: #f5f1e8;",
    "        --panel: rgba(255, 252, 245, 0.92);",
    "        --ink: #1f1c18;",
    "        --muted: #5d554a;",
    "        --line: rgba(72, 57, 42, 0.16);",
    "        --accent: #0b6e4f;",
    "      }",
    "      * { box-sizing: border-box; }",
    "      body {",
    '        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;',
    "        margin: 0;",
    "        min-height: 100vh;",
    "        color: var(--ink);",
    "        background: linear-gradient(180deg, #efe7d7 0%, var(--bg) 48%, #f9f6ef 100%);",
    "      }",
    "      main {",
    "        max-width: 64rem;",
    "        margin: 0 auto;",
    "        padding: 4rem 1.5rem 5rem;",
    "      }",
    "      h1, h2 { margin: 0 0 0.75rem; }",
    "      p { line-height: 1.6; }",
    "      .lede {",
    "        max-width: 46rem;",
    "        color: var(--muted);",
    "        font-size: 1.08rem;",
    "      }",
    "      .grid {",
    "        display: grid;",
    "        gap: 1rem;",
    "        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));",
    "        margin-top: 2rem;",
    "      }",
    "      .card {",
    "        border: 1px solid var(--line);",
    "        border-radius: 1.25rem;",
    "        padding: 1.25rem;",
    "        background: var(--panel);",
    "        box-shadow: 0 18px 40px rgba(52, 40, 28, 0.08);",
    "      }",
    "      a { color: var(--accent); }",
    "      code {",
    '        font-family: "SFMono-Regular", "Cascadia Code", "JetBrains Mono", monospace;',
    "        font-size: 0.92em;",
    "      }",
    "    </style>",
    "  </head>",
    "  <body>",
    "    <main>",
    "      <h1>CX Publish Surface</h1>",
    '      <p class="lede">One Pages site hosts the semver-tracked schema endpoints and the latest public coverage status page, so operators do not have to choose between release metadata and CI visibility.</p>',
    '      <div class="grid">',
    '        <section class="card">',
    "          <h2>Schemas</h2>",
    "          <p>Canonical JSON Schemas mirrored from the checked-in <code>schemas/</code> directory.</p>",
    '          <p><a href="schemas/">Open schema index</a></p>',
    "        </section>",
    ...coverageCard,
    "      </div>",
    "    </main>",
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function renderSchemasIndex(schemaNames) {
  const items = schemaNames
    .map((schemaName) => `      <li><a href="${schemaName}">${schemaName}</a></li>`)
    .join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "    <title>CX Schemas</title>",
    "    <style>",
    "      body {",
    '        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;',
    "        line-height: 1.6;",
    "        max-width: 52rem;",
    "        margin: 3rem auto;",
    "        padding: 0 1.5rem 3rem;",
    "        color: #1f1c18;",
    "        background: #faf7f0;",
    "      }",
    "      a { color: #0b6e4f; }",
    "      code {",
    '        font-family: "SFMono-Regular", "Cascadia Code", "JetBrains Mono", monospace;',
    "      }",
    "    </style>",
    "  </head>",
    "  <body>",
    "    <p><a href=\"../\">Back to CX publish surface</a></p>",
    "    <h1>CX Schemas</h1>",
    "    <p>The canonical JSON Schemas for <code>cx</code> are published here.</p>",
    "    <ul>",
    items,
    "    </ul>",
    "    <p>GitHub Releases mirror the same files as immutable snapshots.</p>",
    "    <p>The npm package also ships <code>schemas/</code> for offline use.</p>",
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

export async function assemblePagesSite({
  siteRoot = DEFAULT_SITE_ROOT,
  schemasDir = DEFAULT_SCHEMAS_DIR,
  coverageDir = DEFAULT_COVERAGE_DIR,
} = {}) {
  const schemaEntries = await fs.readdir(schemasDir, { withFileTypes: true });
  const schemaNames = schemaEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const siteSchemasDir = path.join(siteRoot, "schemas");
  const siteCoverageDir = path.join(siteRoot, "coverage");
  const hasCoverage = await pathExists(coverageDir);

  await fs.rm(siteRoot, { recursive: true, force: true });
  await fs.mkdir(siteSchemasDir, { recursive: true });

  await Promise.all(
    schemaNames.map((schemaName) =>
      fs.copyFile(
        path.join(schemasDir, schemaName),
        path.join(siteSchemasDir, schemaName),
      ),
    ),
  );

  if (hasCoverage) {
    await fs.cp(coverageDir, siteCoverageDir, { recursive: true });
  }

  await fs.writeFile(
    path.join(siteRoot, "index.html"),
    renderRootIndex({ hasCoverage }),
    "utf8",
  );
  await fs.writeFile(
    path.join(siteSchemasDir, "index.html"),
    renderSchemasIndex(schemaNames),
    "utf8",
  );
  await fs.writeFile(path.join(siteRoot, ".nojekyll"), "", "utf8");

  return {
    siteRoot,
    schemasDir: siteSchemasDir,
    schemaNames,
    hasCoverage,
    coverageDir: hasCoverage ? siteCoverageDir : null,
  };
}

async function main() {
  const result = await assemblePagesSite();
  console.log(
    `Assembled Pages site at ${result.siteRoot} (${result.schemaNames.length} schemas${result.hasCoverage ? ", coverage included" : ""}).`,
  );
}

if (process.argv[1]) {
  const entryHref = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryHref) {
    main().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to assemble Pages site: ${message}`);
      process.exitCode = 1;
    });
  }
}
