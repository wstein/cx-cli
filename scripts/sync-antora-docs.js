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
export const REPOSITORY_BLOB_BASE = "https://github.com/wstein/cx-cli/blob/main/";

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

async function buildSourceCatalog(repoRoot) {
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

  return extraFiles.sort();
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

export async function syncAntoraDocs({
  repoRoot = DEFAULT_REPO_ROOT,
  pagesRoot = DEFAULT_ANTORA_PAGES_ROOT,
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

    await fs.mkdir(path.join(repoRoot, pagesRoot), { recursive: true });

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
      await fs.rm(outputPath, { force: true });
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

    return {
      pageCount: sourcePaths.length,
      pagesRoot: path.join(repoRoot, pagesRoot),
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
