import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";

export const DEFAULT_REPO_ROOT = process.cwd();
export const DEFAULT_ANTORA_ROOT = "docs";
export const DEFAULT_ANTORA_PAGES_ROOT = path.join(
  DEFAULT_ANTORA_ROOT,
  "modules/ROOT/pages/repository",
);
export const DEFAULT_ANTORA_NAV_PARTIAL = path.join(
  DEFAULT_ANTORA_ROOT,
  "modules/ROOT/partials/repository-nav.adoc",
);
export const REPOSITORY_BLOB_BASE = "https://github.com/wstein/cx-cli/blob/main/";
export const CURATED_SOURCE_PATHS = new Set([
  "docs/README.md",
  "docs/MANUAL.md",
  "docs/OPERATING_MODES.md",
  "docs/MENTAL_MODEL.md",
  "docs/ARCHITECTURE.md",
  "docs/SYSTEM_MAP.md",
  "docs/SYSTEM_CONTRACTS.md",
  "docs/INTERNAL_API_CONTRACT.md",
  "docs/RENDER_KERNEL_CONTRACT.md",
  "docs/config-reference.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/RELEASE_INTEGRITY.md",
  "docs/MIGRATIONS/0.4.0.md",
  "docs/WORKFLOWS/friday-to-monday.md",
  "docs/WORKFLOWS/safe-note-mutation.md",
]);

const EXTRA_SOURCE_FILES = ["README.md", "CHANGELOG.md"];
const DEFAULT_LOCK_DIR = ".antora/locks/sync.lock";

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function slugSegment(segment) {
  return segment
    .replace(/\.md$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function stripFrontComment(markdown) {
  return markdown.replace(/^<!--[^]*?-->\s*/u, "");
}

function extractTitle(markdown, fallbackTitle) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (!match) {
    return { title: fallbackTitle, body: markdown };
  }

  const title = match[1].trim();
  const body = markdown.replace(/^#\s+.+\n?/m, "").trimStart();
  return { title, body };
}

async function discoverMarkdownFiles(rootDir, currentDir = rootDir, results = []) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);
    const posixRelativePath = toPosix(relativePath);

    if (entry.isDirectory()) {
      if (
        posixRelativePath.startsWith("antora") ||
        posixRelativePath.startsWith("antora-ui")
      ) {
        continue;
      }
      await discoverMarkdownFiles(rootDir, absolutePath, results);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(absolutePath);
    }
  }

  return results;
}

async function buildSourceCatalog(repoRoot) {
  const docsRoot = path.join(repoRoot, "docs");
  const docsFiles = await discoverMarkdownFiles(docsRoot);
  const extraFiles = [];

  for (const relativePath of EXTRA_SOURCE_FILES) {
    const absolutePath = path.join(repoRoot, relativePath);
    try {
      await fs.access(absolutePath);
      extraFiles.push(absolutePath);
    } catch {
      // Ignore absent optional extras.
    }
  }

  return [...docsFiles, ...extraFiles]
    .filter((absolutePath) => {
      const relativePath = toPosix(path.relative(repoRoot, absolutePath));
      return !CURATED_SOURCE_PATHS.has(relativePath);
    })
    .sort();
}

function sourceToOutputPath(repoRoot, sourcePath) {
  const relativePath = toPosix(path.relative(repoRoot, sourcePath));
  const segments = relativePath.split("/");
  const scopedSegments =
    segments[0] === "docs" ? ["docs", ...segments.slice(1)] : ["root", ...segments];
  const outputSegments = scopedSegments.map(slugSegment);
  const outputFile = `${outputSegments.join("/")}.adoc`;
  return path.join(DEFAULT_ANTORA_PAGES_ROOT, outputFile);
}

function buildOutputUrl(relativeOutputPath) {
  const withoutExtension = relativeOutputPath.replace(/\.adoc$/i, "");
  return `${toPosix(withoutExtension)}/`;
}

function rewriteLinks(html, { sourcePath, sourceToOutput, repoRoot }) {
  return html.replace(/href="([^"]+)"/g, (match, href) => {
    if (
      href.startsWith("http:") ||
      href.startsWith("https:") ||
      href.startsWith("mailto:") ||
      href.startsWith("#")
    ) {
      return match;
    }

    const [rawTarget, rawFragment = ""] = href.split("#");
    const fragment = rawFragment ? `#${rawFragment}` : "";
    const sourceDir = path.dirname(sourcePath);
    const resolvedPath = path.resolve(sourceDir, rawTarget);
    const repoRelativeTarget = toPosix(path.relative(repoRoot, resolvedPath));
    const currentOutput = sourceToOutput.get(sourcePath);
    const currentOutputDir = path.dirname(currentOutput);

    if (sourceToOutput.has(resolvedPath)) {
      const targetOutput = sourceToOutput.get(resolvedPath);
      const targetUrl = buildOutputUrl(
        path.relative(DEFAULT_ANTORA_PAGES_ROOT, targetOutput),
      );
      const relativeUrl = toPosix(
        path.relative(
          currentOutputDir,
          path.join(DEFAULT_ANTORA_PAGES_ROOT, targetUrl),
        ),
      );
      const normalizedUrl =
        relativeUrl === ""
          ? "./"
          : relativeUrl.endsWith("/")
            ? relativeUrl
            : `${relativeUrl}/`;
      return `href="${normalizedUrl}${fragment}"`;
    }

    if (!repoRelativeTarget.startsWith("..")) {
      return `href="${REPOSITORY_BLOB_BASE}${repoRelativeTarget}${fragment}"`;
    }

    return match;
  });
}

function renderAdocPage({ title, sourceLabel, html }) {
  return [
    `= ${title}`,
    ":page-layout: default",
    "",
    `[.doc-origin]`,
    `Source companion: \`${sourceLabel}\``,
    "",
    "++++",
    html.trim(),
    "++++",
    "",
  ].join("\n");
}

async function acquireLock(lockDir, timeoutMs = 10000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fs.mkdir(lockDir, { recursive: false });
      return;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error(`Timed out waiting for Antora sync lock at ${lockDir}.`);
}

async function withLock(lockDir, work) {
  await fs.mkdir(path.dirname(lockDir), { recursive: true });
  await acquireLock(lockDir);
  try {
    return await work();
  } finally {
    await fs.rm(lockDir, { recursive: true, force: true });
  }
}

function buildNavTree(sourceToOutput, repoRoot) {
  const docsEntries = [];
  const rootEntries = [];
  const pagesRoot = path.join(repoRoot, DEFAULT_ANTORA_ROOT, "modules/ROOT/pages");

  for (const [sourcePath, outputPath] of [...sourceToOutput.entries()].sort()) {
    const repoRelativeSource = toPosix(path.relative(repoRoot, sourcePath));
    const outputRelative = toPosix(path.relative(pagesRoot, outputPath));
    const line = `*** xref:page$${outputRelative}[${repoRelativeSource}]`;

    if (repoRelativeSource.startsWith("docs/")) {
      docsEntries.push(line);
    } else {
      rootEntries.push(line);
    }
  }

  return [
    "** Repository Markdown Companions",
    ...docsEntries,
    "** Root Repository Companions",
    ...rootEntries,
    "",
  ].join("\n");
}

export async function syncAntoraDocs({
  repoRoot = DEFAULT_REPO_ROOT,
  pagesRoot = DEFAULT_ANTORA_PAGES_ROOT,
  navPartialPath = DEFAULT_ANTORA_NAV_PARTIAL,
  lockDir = DEFAULT_LOCK_DIR,
} = {}) {
  return withLock(path.join(repoRoot, lockDir), async () => {
    const sourcePaths = await buildSourceCatalog(repoRoot);
    const sourceToOutput = new Map(
      sourcePaths.map((sourcePath) => [
        sourcePath,
        path.join(repoRoot, sourceToOutputPath(repoRoot, sourcePath)),
      ]),
    );

    await fs.rm(path.join(repoRoot, pagesRoot), { recursive: true, force: true });
    await fs.mkdir(path.join(repoRoot, pagesRoot), { recursive: true });
    await fs.mkdir(path.dirname(path.join(repoRoot, navPartialPath)), {
      recursive: true,
    });

    marked.setOptions({ gfm: true, breaks: false });

    for (const sourcePath of sourcePaths) {
      const markdown = await fs.readFile(sourcePath, "utf8");
      const stripped = stripFrontComment(markdown);
      const fallbackTitle = path.basename(sourcePath, path.extname(sourcePath));
      const { title, body } = extractTitle(stripped, fallbackTitle);
      const html = rewriteLinks(await marked.parse(body), {
        sourcePath,
        sourceToOutput,
        repoRoot,
      });
      const outputPath = sourceToOutput.get(sourcePath);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(
        outputPath,
        renderAdocPage({
          title,
          sourceLabel: toPosix(path.relative(repoRoot, sourcePath)),
          html,
        }),
        "utf8",
      );
    }

    const navPartial = buildNavTree(sourceToOutput, repoRoot);
    await fs.writeFile(path.join(repoRoot, navPartialPath), navPartial, "utf8");

    return {
      pageCount: sourcePaths.length,
      pagesRoot: path.join(repoRoot, pagesRoot),
      navPartialPath: path.join(repoRoot, navPartialPath),
    };
  });
}

async function main() {
  const result = await syncAntoraDocs();
  console.log(
    `Synced ${result.pageCount} Antora companion pages into ${result.pagesRoot}.`,
  );
}

if (process.argv[1]) {
  const entryHref = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryHref) {
    main().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to sync Antora docs: ${message}`);
      process.exitCode = 1;
    });
  }
}
