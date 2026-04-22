import fs from "node:fs/promises";
import path from "node:path";
import { sha256File } from "../shared/hashing.js";

export type DocsExportSurfaceName = "architecture" | "manual" | "onboarding";

export interface DocsExportArtifact {
  surfaceName: DocsExportSurfaceName;
  title: string;
  moduleName: string;
  outputFile: string;
  outputPath: string;
  relativeOutputPath: string;
  pageCount: number;
  sourcePaths: string[];
  sha256: string;
  sizeBytes: number;
}

export interface ExportDocsParams {
  workspaceRoot: string;
  outputDir: string;
  extension?: string | undefined;
  filenamePrefix?: string | undefined;
}

interface DocsExportSurfaceSpec {
  surfaceName: DocsExportSurfaceName;
  title: string;
  moduleName: string;
  navFile: string;
}

const BUILTIN_DOC_SURFACES: DocsExportSurfaceSpec[] = [
  {
    surfaceName: "onboarding",
    title: "Onboarding",
    moduleName: "onboarding",
    navFile: "docs/modules/onboarding/nav.adoc",
  },
  {
    surfaceName: "manual",
    title: "Manual",
    moduleName: "manual",
    navFile: "docs/modules/manual/nav.adoc",
  },
  {
    surfaceName: "architecture",
    title: "Architecture",
    moduleName: "architecture",
    navFile: "docs/modules/architecture/nav.adoc",
  },
] as const;

const INCLUDE_LINE_PATTERN = /^include::([^[]+)\[[^\]]*\]\s*$/gm;
const NAV_XREF_PATTERN = /xref:([^[]+)\[[^\]]*\]/g;
const MULTIMARKDOWN_METADATA_PATTERN = /^Title:\s*(.+)\nDate:\s*[^\n]+\n\n/u;

async function renderPageMarkdown(
  source: string,
  pagePath: string,
): Promise<string> {
  const { renderAssemblyMarkdown } = await import(
    "@wsmy/antora-markdown-exporter"
  );
  return renderAssemblyMarkdown(source, "multimarkdown", pagePath, {
    xrefFallbackLabelStyle: "fragment-or-path",
  });
}

function resolveOutputFileName(params: {
  surfaceName: DocsExportSurfaceName;
  extension: string;
  filenamePrefix?: string | undefined;
}): string {
  return params.filenamePrefix
    ? `${params.filenamePrefix}-${params.surfaceName}${params.extension}`
    : `${params.surfaceName}${params.extension}`;
}

function resolveNavTarget(params: {
  moduleName: string;
  rawTarget: string;
}): string | null {
  const withoutFragment = params.rawTarget.split("#", 1)[0]?.trim() ?? "";
  if (withoutFragment.length === 0) {
    return null;
  }

  let moduleName = params.moduleName;
  let target = withoutFragment;

  const moduleMatch = /^([^:]+):(.*)$/u.exec(target);
  if (moduleMatch) {
    moduleName = moduleMatch[1] ?? moduleName;
    target = moduleMatch[2] ?? target;
  }

  const familyMatch = /^(?:page\$)?(.+)$/u.exec(target);
  const familyPath = familyMatch?.[1]?.trim() ?? "";
  if (familyPath.length === 0 || familyPath.includes("$")) {
    return null;
  }

  return path.join("docs", "modules", moduleName, "pages", familyPath);
}

async function collectSurfacePagePaths(
  workspaceRoot: string,
  surface: DocsExportSurfaceSpec,
): Promise<string[]> {
  const navSource = await fs.readFile(
    path.join(workspaceRoot, surface.navFile),
    "utf8",
  );

  const pagePaths: string[] = [];
  const seen = new Set<string>();

  for (const match of navSource.matchAll(NAV_XREF_PATTERN)) {
    const rawTarget = match[1]?.trim();
    if (!rawTarget) {
      continue;
    }

    const resolved = resolveNavTarget({
      moduleName: surface.moduleName,
      rawTarget,
    });
    if (!resolved || seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);
    pagePaths.push(resolved);
  }

  return pagePaths;
}

function resolveIncludeTarget(params: {
  workspaceRoot: string;
  currentRelativePath: string;
  includeTarget: string;
}): string {
  const { workspaceRoot, currentRelativePath, includeTarget } = params;
  const currentAbsolutePath = path.join(workspaceRoot, currentRelativePath);
  const currentDirectory = path.dirname(currentAbsolutePath);

  const moduleFamilyMatch = /^([^:]+):(partial|page)\$(.+)$/u.exec(
    includeTarget,
  );
  if (moduleFamilyMatch) {
    const [, moduleName, family, relativePath] = moduleFamilyMatch;
    return path.join(
      workspaceRoot,
      "docs",
      "modules",
      moduleName ?? "",
      family === "partial" ? "partials" : "pages",
      relativePath ?? "",
    );
  }

  const bareFamilyMatch = /^(partial|page)\$(.+)$/u.exec(includeTarget);
  if (bareFamilyMatch) {
    const [, family, relativePath] = bareFamilyMatch;
    const moduleName = currentRelativePath.split("/")[2] ?? "ROOT";
    return path.join(
      workspaceRoot,
      "docs",
      "modules",
      moduleName,
      family === "partial" ? "partials" : "pages",
      relativePath ?? "",
    );
  }

  return path.resolve(currentDirectory, includeTarget);
}

async function expandIncludes(params: {
  workspaceRoot: string;
  relativePath: string;
  stack?: string[] | undefined;
}): Promise<string> {
  const stack = params.stack ?? [];
  if (stack.includes(params.relativePath)) {
    throw new Error(
      `Detected recursive docs include while expanding ${params.relativePath}.`,
    );
  }

  const absolutePath = path.join(params.workspaceRoot, params.relativePath);
  const source = await fs.readFile(absolutePath, "utf8");
  const nextStack = [...stack, params.relativePath];

  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(INCLUDE_LINE_PATTERN)) {
    const includeTarget = match[1];
    const matchIndex = match.index ?? 0;
    parts.push(source.slice(lastIndex, matchIndex));

    if (!includeTarget) {
      parts.push(match[0]);
      lastIndex = matchIndex + match[0].length;
      continue;
    }

    const includePath = resolveIncludeTarget({
      workspaceRoot: params.workspaceRoot,
      currentRelativePath: params.relativePath,
      includeTarget: includeTarget.trim(),
    });
    const includeRelativePath = path
      .relative(params.workspaceRoot, includePath)
      .replaceAll("\\", "/");
    parts.push(
      await expandIncludes({
        workspaceRoot: params.workspaceRoot,
        relativePath: includeRelativePath,
        stack: nextStack,
      }),
    );
    lastIndex = matchIndex + match[0].length;
  }

  parts.push(source.slice(lastIndex));
  return parts.join("");
}

function normalizeRenderedPage(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const metadataMatch = MULTIMARKDOWN_METADATA_PATTERN.exec(normalized);
  if (!metadataMatch) {
    return normalized;
  }

  const title = metadataMatch[1]?.trim() ?? "Untitled";
  return `# ${title}\n\n${normalized.slice(metadataMatch[0].length).trim()}`;
}

async function renderSurfaceDocument(params: {
  workspaceRoot: string;
  surface: DocsExportSurfaceSpec;
}): Promise<{ content: string; sourcePaths: string[] }> {
  const pagePaths = await collectSurfacePagePaths(
    params.workspaceRoot,
    params.surface,
  );
  if (pagePaths.length === 0) {
    throw new Error(
      `No pages were resolved from ${params.surface.navFile} for docs export.`,
    );
  }

  const renderedPages = await Promise.all(
    pagePaths.map(async (pagePath) => {
      const expanded = await expandIncludes({
        workspaceRoot: params.workspaceRoot,
        relativePath: pagePath,
      });
      return normalizeRenderedPage(
        await renderPageMarkdown(expanded, pagePath),
      );
    }),
  );

  return {
    content: `${renderedPages.join("\n\n")}\n`,
    sourcePaths: pagePaths,
  };
}

export async function exportAntoraDocsToMarkdown(
  params: ExportDocsParams,
): Promise<DocsExportArtifact[]> {
  const extension = params.extension ?? ".mmd.md";
  await fs.mkdir(params.outputDir, { recursive: true });

  const artifacts: DocsExportArtifact[] = [];

  for (const surface of BUILTIN_DOC_SURFACES) {
    const { content, sourcePaths } = await renderSurfaceDocument({
      workspaceRoot: params.workspaceRoot,
      surface,
    });
    const outputFile = resolveOutputFileName({
      surfaceName: surface.surfaceName,
      extension,
      filenamePrefix: params.filenamePrefix,
    });
    const outputPath = path.join(params.outputDir, outputFile);
    await fs.writeFile(outputPath, content, "utf8");
    const stat = await fs.stat(outputPath);

    artifacts.push({
      surfaceName: surface.surfaceName,
      title: surface.title,
      moduleName: surface.moduleName,
      outputFile,
      outputPath,
      relativeOutputPath: path
        .relative(params.outputDir, outputPath)
        .replaceAll("\\", "/"),
      pageCount: sourcePaths.length,
      sourcePaths,
      sha256: await sha256File(outputPath),
      sizeBytes: stat.size,
    });
  }

  return artifacts;
}
