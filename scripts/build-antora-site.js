import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { syncAntoraDocs } from "./sync-antora-docs.js";

export const DEFAULT_ANTORA_PLAYBOOK = "antora-playbook.yml";
export const DEFAULT_ANTORA_SITE_ROOT = "dist/antora";
export const DEFAULT_ANTORA_CACHE_DIR = ".antora/cache";
export const DEFAULT_ANTORA_EXPORTS_DIR = "cx/0.4/_exports";
export const DEFAULT_ANTORA_SINGLE_HTML_EXPORTS = [
  {
    fileName: "manual.html",
    navFile: "modules/ROOT/nav-manual.adoc",
    startPage: "cx::manual/index.adoc",
  },
  {
    fileName: "architecture.html",
    navFile: "modules/ROOT/nav-architecture.adoc",
    startPage: "cx::architecture/index.adoc",
  },
];
export const DEFAULT_ANTORA_EXPORT_WORK_ROOT = "tmp/antora-single-html";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureSingleHtmlExports({
  playbook,
  toDir,
  cacheDir,
  workRoot = DEFAULT_ANTORA_EXPORT_WORK_ROOT,
} = {}) {
  const repoRoot = process.cwd();
  const exportsDir = path.join(toDir, DEFAULT_ANTORA_EXPORTS_DIR);
  await fs.mkdir(exportsDir, { recursive: true });
  const baseWorkRoot = await fs.mkdtemp(
    path.join(repoRoot, `${workRoot.replaceAll("/", "-")}-`),
  );

  try {
    const exportPaths = [];

    for (const spec of DEFAULT_ANTORA_SINGLE_HTML_EXPORTS) {
      const exportWorkRoot = path.join(
        baseWorkRoot,
        path.basename(spec.fileName, ".html"),
      );
      const sourceRoot = path.join(exportWorkRoot, "docs");
      const playbookPath = path.join(exportWorkRoot, "antora-playbook.yml");
      const outputDir = path.join(exportWorkRoot, "site");
      const buildDir = path.join(
        exportWorkRoot,
        "build",
        "assembler",
        path.basename(spec.fileName, ".html"),
      );
      const finalExportPath = path.join(exportsDir, spec.fileName);

      await fs.mkdir(sourceRoot, { recursive: true });
      await fs.cp(
        path.join(repoRoot, "docs", "modules"),
        path.join(sourceRoot, "modules"),
        {
          recursive: true,
        },
      );

      await fs.writeFile(
        path.join(sourceRoot, "antora.yml"),
        [
          "name: cx",
          "title: CX Documentation",
          "version: '0.4'",
          "nav:",
          `  - ${spec.navFile}`,
          "",
        ].join("\n"),
        "utf8",
      );

      await fs.writeFile(
        path.join(exportWorkRoot, "antora-assembler-html.yml"),
        [
          "assembly:",
          `  profile: ${path.basename(spec.fileName, ".html")}`,
          "  root_level: 0",
          "build:",
          `  cwd: ${JSON.stringify(repoRoot)}`,
          `  dir: ${JSON.stringify(buildDir)}`,
          "  command: false",
          "  mkdirs: true",
          "  publish: false",
          "",
        ].join("\n"),
        "utf8",
      );

      await fs.writeFile(
        playbookPath,
        [
          "antora:",
          "  extensions:",
          "    - '@antora/html-single-extension'",
          "site:",
          "  title: CX Documentation",
          `  start_page: ${spec.startPage}`,
          "content:",
          "  sources:",
          `    - url: ${JSON.stringify(repoRoot)}`,
          "      branches: HEAD",
          `      start_path: ${path.relative(repoRoot, sourceRoot)}`,
          "ui:",
          "  bundle:",
          `    url: ${JSON.stringify(path.join(repoRoot, "docs", "ui"))}`,
          "asciidoc:",
          "  attributes:",
          "    page-pagination: ''",
          "    sectanchors: ''",
          "    toc: left",
          "    experimental: ''",
          "    source-highlighter: highlight.js",
          "  extensions:",
          "    - '@asciidoctor/tabs'",
          "urls:",
          "  html_extension_style: indexify",
          "output:",
          "  clean: true",
          "",
        ].join("\n"),
        "utf8",
      );

      await execa(
        "./node_modules/.bin/antora",
        [playbookPath, "--to-dir", outputDir, "--cache-dir", cacheDir],
        {
          stdio: "pipe",
          env: {
            ANTORA_CACHE_DIR: cacheDir,
          },
        },
      );

      const exportedDir = path.join(buildDir, DEFAULT_ANTORA_EXPORTS_DIR);
      const candidateNames = [spec.fileName, "index.html"];
      let exportedSourcePath = null;

      for (const candidateName of candidateNames) {
        const candidatePath = path.join(exportedDir, candidateName);
        if (await pathExists(candidatePath)) {
          exportedSourcePath = candidatePath;
          break;
        }
      }

      if (!exportedSourcePath) {
        const exportEntries = await fs.readdir(exportedDir);
        const htmlEntries = exportEntries.filter((entry) =>
          entry.endsWith(".html"),
        );
        if (htmlEntries.length === 1) {
          exportedSourcePath = path.join(exportedDir, htmlEntries[0]);
        }
      }

      if (!exportedSourcePath) {
        throw new Error(
          `Antora single-file export did not produce ${spec.fileName} in ${exportedDir}.`,
        );
      }

      await fs.copyFile(exportedSourcePath, finalExportPath);
      exportPaths.push(finalExportPath);
    }

    return exportPaths;
  } finally {
    await fs.rm(baseWorkRoot, { recursive: true, force: true });
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

  const singleHtmlExports = await ensureSingleHtmlExports({
    playbook,
    toDir,
    cacheDir,
  });

  return {
    playbook,
    siteRoot: toDir,
    indexPath: hasVersionedIndex ? rootDocsIndexPath : indexPath,
    singleHtmlExports,
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
