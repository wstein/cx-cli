import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import {
  type AssemblyDocument,
  type AssemblyHeading,
  type AssemblyInline,
  collectMarkdownInspectionReport,
  convertAssemblyStructureToMarkdownIR,
  extractAssemblyStructure,
  normalizeMarkdownIR,
  renderMarkdown,
} from "@wsmy/antora-markdown-exporter";
import { sha256File } from "../shared/hashing.js";

export type DocsExportSurfaceName = "architecture" | "manual" | "onboarding";
export type DocsExportFormat =
  | "multimarkdown"
  | "commonmark"
  | "gfm"
  | "gitlab"
  | "strict";

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
  diagnostics: DocsExportDiagnostics;
}

export interface DocsExportDiagnostic {
  destination: string;
  code: "raw_xref" | "antora_family" | "module_qualified_html" | "adoc_link";
  severity: "error";
  message: string;
}

export interface DocsExportDiagnostics {
  status: "clean" | "flagged";
  diagnostics: DocsExportDiagnostic[];
}

export interface ExportDocsParams {
  workspaceRoot: string;
  outputDir: string;
  format?: DocsExportFormat | undefined;
  extension?: string | undefined;
  filenamePrefix?: string | undefined;
  playbookPath?: string | undefined;
}

interface DocsExportSurfaceSpec {
  surfaceName: DocsExportSurfaceName;
  title: string;
  moduleName: string;
  navFile: string;
}

interface DocsExportPageRecord {
  surfaceName: DocsExportSurfaceName;
  pagePath: string;
  outputFile: string;
  primaryAnchor: string | null;
  renderedMarkdown: string;
  xrefs: ReturnType<typeof collectMarkdownInspectionReport>["xrefs"];
}

const require = createRequire(import.meta.url);

function readPackageVersion(packageName: string): string {
  const entryPath = require.resolve(packageName);
  const packageJsonPath = path.join(
    path.dirname(entryPath),
    "..",
    "package.json",
  );
  const packageJson = require(packageJsonPath) as { version?: string };
  if (!packageJson.version) {
    throw new Error(`Missing version metadata for ${packageName}.`);
  }
  return packageJson.version;
}

export const DOCS_EXPORT_GENERATOR = {
  name: "@wsmy/antora-markdown-exporter",
  version: readPackageVersion("@wsmy/antora-markdown-exporter"),
  format: "multimarkdown",
} as const;

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
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\(([^)\s]+)\)/g;

const DOCS_EXPORT_DIAGNOSTIC_MESSAGES: Record<
  DocsExportDiagnostic["code"],
  string
> = {
  raw_xref:
    "Rendered markdown still contains a raw xref destination instead of a lowered link.",
  antora_family:
    "Rendered markdown still contains an Antora family destination such as ROOT:page$ or ROOT:partial$.",
  module_qualified_html:
    "Rendered markdown still contains a module-qualified Antora HTML path instead of a review-artifact link.",
  adoc_link:
    "Rendered markdown still links to a source .adoc file instead of a review-facing destination.",
};

export function resolveDocsExportExtension(format: DocsExportFormat): string {
  return format === "multimarkdown" ? ".mmd" : ".md";
}

export async function resolveDocsPlaybookPath(params: {
  workspaceRoot: string;
  playbookPath?: string | undefined;
}): Promise<string> {
  const playbookPath = path.resolve(
    params.workspaceRoot,
    params.playbookPath ?? "antora-playbook.yml",
  );
  const stat = await fs.stat(playbookPath).catch(() => undefined);
  if (!stat?.isFile()) {
    throw new Error(
      `Antora playbook not found for docs export: ${playbookPath}.`,
    );
  }
  return playbookPath;
}

const SUPPRESSED_EXPORTER_WARNING_PATTERN =
  /^asciidoctor: WARNING: <stdin>: line \d+: section title out of sequence:/u;

async function withSuppressedExporterWarnings<T>(
  action: () => Promise<T>,
): Promise<T> {
  const originalWrite = process.stderr.write.bind(process.stderr);

  process.stderr.write = ((
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ) => {
    const text = String(chunk);
    const resolvedCallback =
      typeof encodingOrCallback === "function" ? encodingOrCallback : callback;

    if (SUPPRESSED_EXPORTER_WARNING_PATTERN.test(text.trim())) {
      resolvedCallback?.();
      return true;
    }

    return originalWrite(chunk, encodingOrCallback as never, callback);
  }) as typeof process.stderr.write;

  try {
    return await action();
  } finally {
    process.stderr.write = originalWrite;
  }
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

function inlineText(children: AssemblyInline[]): string {
  return children
    .map((child) => {
      switch (child.type) {
        case "text":
        case "code":
        case "htmlInline":
          return child.value;
        case "emphasis":
        case "strong":
        case "link":
          return inlineText(child.children);
        case "image":
          return inlineText(child.alt);
        case "xref":
          return inlineText(child.children);
        default:
          return "";
      }
    })
    .join("")
    .trim();
}

function slugifyHeading(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['".,()[\]`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveHeadingAnchor(heading: AssemblyHeading): string | null {
  if (heading.identifier) {
    return heading.identifier.replace(/^_+/u, "").replaceAll("_", "-");
  }

  const text = inlineText(heading.children);
  if (text.length === 0) {
    return null;
  }

  const anchor = slugifyHeading(text);
  return anchor.length > 0 ? anchor : null;
}

function resolvePrimaryAnchor(document: AssemblyDocument): string | null {
  const firstHeading = document.children.find(
    (block): block is AssemblyHeading => block.type === "heading",
  );
  if (!firstHeading) {
    return null;
  }
  return resolveHeadingAnchor(firstHeading);
}

function resolveRepositoryPageLink(params: {
  targetPath: string;
  fragment?: string | undefined;
}): string | null {
  if (!params.targetPath.startsWith("ROOT:page$")) {
    return null;
  }

  const htmlPath = params.targetPath
    .slice("ROOT:page$".length)
    .replace(/\.adoc$/u, ".html");
  return params.fragment ? `${htmlPath}#${params.fragment}` : htmlPath;
}

function normalizeTargetPathToPagePath(targetPath: string): string | null {
  if (targetPath.startsWith("ROOT:page$")) {
    return path
      .join(
        "docs",
        "modules",
        "ROOT",
        "pages",
        targetPath.slice("ROOT:page$".length),
      )
      .replaceAll("\\", "/");
  }

  const moduleMatch = /^([^:]+):(.+)$/u.exec(targetPath);
  if (!moduleMatch) {
    return null;
  }

  const [, moduleName, relativePath] = moduleMatch;
  if (!moduleName || !relativePath?.endsWith(".adoc")) {
    return null;
  }

  return path
    .join("docs", "modules", moduleName, "pages", relativePath)
    .replaceAll("\\", "/");
}

function rewriteRenderedLinks(params: {
  markdown: string;
  xrefs: ReturnType<typeof collectMarkdownInspectionReport>["xrefs"];
  currentSurface: DocsExportSurfaceName;
  exportedPages: Map<
    string,
    {
      surfaceName: DocsExportSurfaceName;
      outputFile: string;
      primaryAnchor: string | null;
    }
  >;
}): string {
  const replacements = new Map<string, string>();

  for (const xref of params.xrefs) {
    const exportedPage = params.exportedPages.get(
      normalizeTargetPathToPagePath(xref.target.path) ?? xref.target.path,
    );
    if (exportedPage) {
      const anchor = xref.target.fragment ?? exportedPage.primaryAnchor;
      const resolvedLink =
        exportedPage.surfaceName === params.currentSurface
          ? anchor
            ? `#${anchor}`
            : "#"
          : `${exportedPage.outputFile}${anchor ? `#${anchor}` : ""}`;

      replacements.set(xref.target.raw, resolvedLink);
      replacements.set(xref.url, resolvedLink);
      continue;
    }

    const repositoryPageLink = resolveRepositoryPageLink({
      targetPath: xref.target.path,
      fragment: xref.target.fragment,
    });
    if (repositoryPageLink) {
      replacements.set(xref.target.raw, repositoryPageLink);
      replacements.set(xref.url, repositoryPageLink);
    }
  }

  let rewritten = params.markdown;
  for (const [sourceDestination, resolvedDestination] of replacements) {
    rewritten = rewritten.replaceAll(
      `](${sourceDestination})`,
      `](${resolvedDestination})`,
    );
  }

  return rewritten;
}

export function analyzeDocsExportMarkdown(
  markdown: string,
): DocsExportDiagnostics {
  const diagnostics = new Map<string, DocsExportDiagnostic>();

  for (const match of markdown.matchAll(MARKDOWN_LINK_PATTERN)) {
    const destination = match[1]?.trim();
    if (!destination) {
      continue;
    }

    let code: DocsExportDiagnostic["code"] | null = null;
    if (destination.startsWith("xref:")) {
      code = "raw_xref";
    } else if (
      destination.includes("ROOT:page$") ||
      destination.includes("ROOT:partial$")
    ) {
      code = "antora_family";
    } else if (
      /^(architecture|manual|onboarding):.+\.html(?:#.*)?$/u.test(destination)
    ) {
      code = "module_qualified_html";
    } else if (/\.adoc(?:#.*)?$/u.test(destination)) {
      code = "adoc_link";
    }

    if (code) {
      diagnostics.set(destination, {
        destination,
        code,
        severity: "error",
        message: DOCS_EXPORT_DIAGNOSTIC_MESSAGES[code],
      });
    }
  }

  return {
    status: diagnostics.size === 0 ? "clean" : "flagged",
    diagnostics: [...diagnostics.values()],
  };
}

export class DocsExportValidationError extends Error {
  readonly surfaceName: DocsExportSurfaceName;
  readonly diagnostics: DocsExportDiagnostics;

  constructor(
    surfaceName: DocsExportSurfaceName,
    diagnostics: DocsExportDiagnostics,
  ) {
    const details = diagnostics.diagnostics
      .map((diagnostic) => `${diagnostic.code}: ${diagnostic.destination}`)
      .join("; ");
    super(
      `Docs export for ${surfaceName} produced source-flavored links: ${details}`,
    );
    this.name = "DocsExportValidationError";
    this.surfaceName = surfaceName;
    this.diagnostics = diagnostics;
  }
}

async function renderDocsPage(params: {
  workspaceRoot: string;
  pagePath: string;
  surfaceName: DocsExportSurfaceName;
  outputFile: string;
  format: DocsExportFormat;
}): Promise<DocsExportPageRecord> {
  const absolutePagePath = path.join(params.workspaceRoot, params.pagePath);
  const source = await expandIncludes({
    workspaceRoot: params.workspaceRoot,
    relativePath: params.pagePath,
  });

  return withSuppressedExporterWarnings(async () => {
    const structured = extractAssemblyStructure(source, {
      sourcePath: absolutePagePath,
      xrefFallbackLabelStyle: "fragment-or-basename",
    });
    const document = normalizeMarkdownIR(
      convertAssemblyStructureToMarkdownIR(structured),
    );
    const inspection = collectMarkdownInspectionReport(document);

    return {
      surfaceName: params.surfaceName,
      pagePath: params.pagePath,
      outputFile: params.outputFile,
      primaryAnchor: resolvePrimaryAnchor(structured),
      renderedMarkdown: normalizeRenderedPage(
        renderMarkdown(document, params.format),
      ),
      xrefs: inspection.xrefs,
    };
  });
}

export async function exportAntoraDocsToMarkdown(
  params: ExportDocsParams,
): Promise<DocsExportArtifact[]> {
  const format = params.format ?? "multimarkdown";
  const extension = params.extension ?? resolveDocsExportExtension(format);
  await resolveDocsPlaybookPath({
    workspaceRoot: params.workspaceRoot,
    playbookPath: params.playbookPath,
  });
  await fs.mkdir(params.outputDir, { recursive: true });

  const surfaceDefinitions = BUILTIN_DOC_SURFACES.map((surface) => ({
    ...surface,
    outputFile: resolveOutputFileName({
      surfaceName: surface.surfaceName,
      extension,
      filenamePrefix: params.filenamePrefix,
    }),
  }));

  const surfacePagePaths = new Map<DocsExportSurfaceName, string[]>();
  for (const surface of surfaceDefinitions) {
    const pagePaths = await collectSurfacePagePaths(
      params.workspaceRoot,
      surface,
    );
    if (pagePaths.length === 0) {
      throw new Error(
        `No pages were resolved from ${surface.navFile} for docs export.`,
      );
    }
    surfacePagePaths.set(surface.surfaceName, pagePaths);
  }

  const renderedPages = await Promise.all(
    surfaceDefinitions.flatMap((surface) =>
      (surfacePagePaths.get(surface.surfaceName) ?? []).map((pagePath) =>
        renderDocsPage({
          workspaceRoot: params.workspaceRoot,
          pagePath,
          surfaceName: surface.surfaceName,
          outputFile: surface.outputFile,
          format,
        }),
      ),
    ),
  );

  const exportedPages = new Map(
    renderedPages.map((page) => [
      page.pagePath,
      {
        surfaceName: page.surfaceName,
        outputFile: page.outputFile,
        primaryAnchor: page.primaryAnchor,
      },
    ]),
  );

  const artifacts: DocsExportArtifact[] = [];

  for (const surface of surfaceDefinitions) {
    const sourcePaths = surfacePagePaths.get(surface.surfaceName) ?? [];
    const pages = renderedPages.filter(
      (page) => page.surfaceName === surface.surfaceName,
    );
    const content = `${pages
      .map((page) =>
        rewriteRenderedLinks({
          markdown: page.renderedMarkdown,
          xrefs: page.xrefs,
          currentSurface: surface.surfaceName,
          exportedPages,
        }),
      )
      .join("\n\n")}\n`;

    const diagnostics = analyzeDocsExportMarkdown(content);
    if (diagnostics.status === "flagged") {
      throw new DocsExportValidationError(surface.surfaceName, diagnostics);
    }

    const outputPath = path.join(params.outputDir, surface.outputFile);
    await fs.writeFile(outputPath, content, "utf8");
    const stat = await fs.stat(outputPath);

    artifacts.push({
      surfaceName: surface.surfaceName,
      title: surface.title,
      moduleName: surface.moduleName,
      outputFile: surface.outputFile,
      outputPath,
      relativeOutputPath: path
        .relative(params.outputDir, outputPath)
        .replaceAll("\\", "/"),
      pageCount: sourcePaths.length,
      sourcePaths,
      sha256: await sha256File(outputPath),
      sizeBytes: stat.size,
      diagnostics,
    });
  }

  return artifacts;
}
