import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { sha256File } from "../shared/hashing.js";

export type DocsExportFormat =
  | "multimarkdown"
  | "commonmark"
  | "gfm"
  | "gitlab"
  | "strict";

export interface DocsExportArtifact {
  assemblyName: string;
  title: string;
  moduleName: string | null;
  outputFile: string;
  outputPath: string;
  relativeOutputPath: string;
  pageCount: number;
  sourcePaths: string[];
  sha256: string;
  sizeBytes: number;
  rootLevel: 0 | 1;
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
  rootLevel?: 0 | 1 | undefined;
  logOutput?: string | undefined;
}

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

type ExportedAntoraAssembly = {
  assemblyName: string;
  content: string;
  moduleName: string | null;
  name: string;
  path: string;
  sourcePages: string[];
};

type AntoraRuntimeLogOptions = {
  destination?: {
    file?: string;
    append?: boolean;
    bufferSize?: number;
    sync?: boolean;
  };
  level?: "all" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  levelFormat?: "number" | "label";
  format?: "json" | "pretty";
  failureLevel?: "warn" | "error" | "fatal" | "none";
};

let exportAntoraModulesToMarkdownPromise:
  | Promise<
      (options: {
        playbookPath: string;
        flavor: DocsExportFormat;
        rootLevel: 0 | 1;
        runtimeLog?: AntoraRuntimeLogOptions | undefined;
      }) => Promise<ExportedAntoraAssembly[]>
    >
  | undefined;

async function loadExportAntoraModulesToMarkdown(): Promise<
  (options: {
    playbookPath: string;
    flavor: DocsExportFormat;
    rootLevel: 0 | 1;
    runtimeLog?: AntoraRuntimeLogOptions | undefined;
  }) => Promise<ExportedAntoraAssembly[]>
> {
  exportAntoraModulesToMarkdownPromise ??= (async () => {
    const exporterEntryPath = require.resolve("@wsmy/antora-markdown-exporter");
    const exporterModule = (await import(
      pathToFileURL(exporterEntryPath).href
    )) as {
      exportAntoraModulesToMarkdown?: (options: {
        playbookPath: string;
        flavor: DocsExportFormat;
        rootLevel: 0 | 1;
        runtimeLog?: AntoraRuntimeLogOptions | undefined;
      }) => Promise<ExportedAntoraAssembly[]>;
    };
    if (typeof exporterModule.exportAntoraModulesToMarkdown !== "function") {
      throw new Error(
        "The installed @wsmy/antora-markdown-exporter package does not expose exportAntoraModulesToMarkdown().",
      );
    }
    return exporterModule.exportAntoraModulesToMarkdown;
  })();

  return exportAntoraModulesToMarkdownPromise;
}

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

const SUPPRESSED_EXPORTER_WARNING_PATTERNS = [
  /^asciidoctor: WARNING: <stdin>: line \d+: section title out of sequence:/u,
  /Cannot create external page reference in assembly because site URL is unknown:/u,
  /skipping reference to missing attribute:/u,
  /possible invalid reference:/u,
] as const;

const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\(([^)\s]+)\)/g;
const MARKDOWN_REFERENCE_DEFINITION_PATTERN =
  /^\[([^\]]+)\]:\s+(\S+)(?:\s+class=unresolved)?\s*$/gm;

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

export async function pruneEmptyLogOutput(
  logOutputPath: string | undefined,
): Promise<void> {
  if (!logOutputPath) {
    return;
  }

  const stat = await fs.stat(logOutputPath).catch(() => undefined);
  if (stat?.isFile() && stat.size === 0) {
    await fs.unlink(logOutputPath).catch(() => undefined);
  }
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

    if (
      SUPPRESSED_EXPORTER_WARNING_PATTERNS.some((pattern) =>
        pattern.test(text.trim()),
      )
    ) {
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

async function resolveGitDir(workspaceRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--git-dir"], {
      cwd: workspaceRoot,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_PAGER: "cat",
      },
    });
    const gitDir = stdout.trim();
    return gitDir.length > 0 ? path.resolve(workspaceRoot, gitDir) : null;
  } catch {
    return null;
  }
}

async function prepareAntoraWorkspaceRoot(params: {
  workspaceRoot: string;
}): Promise<{ workspaceRoot: string; cleanup: (() => Promise<void>) | null }> {
  const gitMarker = await fs
    .lstat(path.join(params.workspaceRoot, ".git"))
    .catch(() => null);
  if (gitMarker?.isDirectory()) {
    return { workspaceRoot: params.workspaceRoot, cleanup: null };
  }

  const gitDir = await resolveGitDir(params.workspaceRoot);
  if (gitDir === null) {
    return { workspaceRoot: params.workspaceRoot, cleanup: null };
  }

  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-antora-worktree-"),
  );
  await fs.cp(
    path.join(params.workspaceRoot, "docs"),
    path.join(tempRoot, "docs"),
    {
      recursive: true,
    },
  );
  await fs.copyFile(
    path.join(params.workspaceRoot, "antora-playbook.yml"),
    path.join(tempRoot, "antora-playbook.yml"),
  );
  await fs.symlink(gitDir, path.join(tempRoot, ".git"));

  return {
    workspaceRoot: tempRoot,
    cleanup: async () => {
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
  };
}

function normalizeRenderedAssembly(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const metadataMatch =
    /^Title:\s*(.+)\nDate:\s*[^\n]+\n(?:[^:\n]+:\s*[^\n]+\n)*\n/u.exec(
      normalized,
    );
  if (!metadataMatch) {
    return `${normalized}\n`;
  }

  const title = metadataMatch[1]?.trim() ?? "Untitled";
  return `# ${title}\n\n${normalized.slice(metadataMatch[0].length).trim()}\n`;
}

function resolveExportOutputFile(params: {
  assemblyPath: string;
  extension: string;
  filenamePrefix?: string | undefined;
}): string {
  const baseName = path.basename(
    params.assemblyPath,
    path.extname(params.assemblyPath),
  );
  const fileName = `${baseName}${params.extension}`;
  return params.filenamePrefix
    ? `${params.filenamePrefix}-${fileName}`
    : fileName;
}

function resolveMarkdownTitle(params: {
  content: string;
  fallback: string;
}): string {
  const headingMatch = /^#\s+(.+)$/mu.exec(params.content);
  return headingMatch?.[1]?.trim() || params.fallback;
}

function resolveTargetSourcePath(destination: string): {
  sourcePath: string;
  fragment: string;
} | null {
  const [targetPart, fragment = ""] = destination.split("#", 2);
  if (!targetPart) {
    return null;
  }

  if (targetPart.startsWith("ROOT:page$")) {
    return {
      sourcePath: `modules/ROOT/pages/${targetPart
        .slice("ROOT:page$".length)
        .replace(/\.(?:html|md)$/u, ".adoc")}`,
      fragment,
    };
  }

  const moduleMatch = /^(?<module>[^:]+):(?:(?:page\$)?(?<page>.+))$/u.exec(
    targetPart,
  );
  const moduleName = moduleMatch?.groups?.module;
  const page = moduleMatch?.groups?.page;
  if (!moduleName || !page) {
    return null;
  }

  const adocPage = page.replace(/\.(?:html|md)$/u, ".adoc");
  return {
    sourcePath: `modules/${moduleName}/pages/${adocPage}`,
    fragment,
  };
}

function resolveTargetSourcePathFromSiteUrl(destination: string): {
  sourcePath: string;
  fragment: string;
} | null {
  let url: URL;
  try {
    url = new URL(destination, "https://example.invalid");
  } catch {
    return null;
  }

  const fragment = url.hash.length > 0 ? url.hash.slice(1) : "";
  const pathname = url.pathname.replace(/\/+$/u, "");
  if (!pathname) {
    return null;
  }

  const parts = pathname
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const moduleIndex = parts.findIndex((part) =>
    ["architecture", "manual", "onboarding", "repository"].includes(part),
  );
  if (moduleIndex < 0) {
    return null;
  }

  const relevantParts = parts.slice(moduleIndex);
  const [firstPart, ...restParts] = relevantParts;
  if (!firstPart) {
    return null;
  }

  if (firstPart === "repository") {
    const rootRelativePath =
      restParts.length === 0 ? "index" : restParts.join("/");
    return {
      sourcePath: `modules/ROOT/pages/${rootRelativePath}.adoc`,
      fragment,
    };
  }

  const pageRelativePath =
    restParts.length === 0 ? "index" : restParts.join("/");
  return {
    sourcePath: `modules/${firstPart}/pages/${pageRelativePath}.adoc`,
    fragment,
  };
}

function deriveSiteUrlPathSuffixes(sourcePath: string): string[] {
  const moduleMatch =
    /^modules\/(?<module>[^/]+)\/pages\/(?<page>.+)\.adoc$/u.exec(sourcePath);
  const moduleName = moduleMatch?.groups?.module;
  const pagePath = moduleMatch?.groups?.page;
  if (!moduleName || !pagePath) {
    return [];
  }

  if (moduleName === "ROOT") {
    if (pagePath === "index") {
      return ["/", ""];
    }
    return [`/${pagePath}/`, `/${pagePath}`];
  }

  if (pagePath === "index") {
    return [`/${moduleName}/`, `/${moduleName}`];
  }

  return [`/${moduleName}/${pagePath}/`, `/${moduleName}/${pagePath}`];
}

function resolveTargetSourcePathFromSiteUrlSuffix(
  destination: string,
  outputFileBySourcePath: Map<string, string>,
): {
  sourcePath: string;
  fragment: string;
} | null {
  let url: URL;
  try {
    url = new URL(destination, "https://example.invalid");
  } catch {
    return null;
  }

  const fragment = url.hash.length > 0 ? url.hash.slice(1) : "";
  const normalizedPathname = url.pathname.replace(/\/+$/u, "");
  let bestMatch: string | undefined;

  for (const sourcePath of outputFileBySourcePath.keys()) {
    const suffixes = deriveSiteUrlPathSuffixes(sourcePath);
    if (
      suffixes.some((suffix) => {
        const normalizedSuffix = suffix.replace(/\/+$/u, "");
        return (
          normalizedPathname === normalizedSuffix ||
          normalizedPathname.endsWith(normalizedSuffix)
        );
      })
    ) {
      if (!bestMatch || sourcePath.length > bestMatch.length) {
        bestMatch = sourcePath;
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    sourcePath: bestMatch,
    fragment,
  };
}

function rewriteReviewLinkDestinations(params: {
  markdown: string;
  currentOutputFile: string;
  outputFileBySourcePath: Map<string, string>;
}): string {
  const rewriteDestination = (destination: string): string => {
    const candidateTargets = [
      resolveTargetSourcePathFromSiteUrl(destination),
      resolveTargetSourcePathFromSiteUrlSuffix(
        destination,
        params.outputFileBySourcePath,
      ),
      resolveTargetSourcePath(destination),
    ];

    for (const resolvedTarget of candidateTargets) {
      if (!resolvedTarget) {
        continue;
      }

      const targetOutputFile = params.outputFileBySourcePath.get(
        resolvedTarget.sourcePath,
      );
      if (!targetOutputFile) {
        continue;
      }

      const fragment =
        resolvedTarget.fragment.length > 0 ? `#${resolvedTarget.fragment}` : "";
      return targetOutputFile === params.currentOutputFile
        ? fragment || "#"
        : `${targetOutputFile}${fragment}`;
    }

    return destination;
  };

  let rewritten = params.markdown.replaceAll(
    MARKDOWN_LINK_PATTERN,
    (match: string, destination: string) =>
      match.replace(`(${destination})`, `(${rewriteDestination(destination)})`),
  );

  rewritten = rewritten.replaceAll(
    MARKDOWN_REFERENCE_DEFINITION_PATTERN,
    (_match: string, label: string, destination: string) =>
      `[${label}]: ${rewriteDestination(destination)}`,
  );

  return rewritten;
}

export function analyzeDocsExportMarkdown(
  markdown: string,
): DocsExportDiagnostics {
  const diagnostics = new Map<string, DocsExportDiagnostic>();
  const destinations = new Set<string>();

  for (const match of markdown.matchAll(MARKDOWN_LINK_PATTERN)) {
    const destination = match[1]?.trim();
    if (destination) {
      destinations.add(destination);
    }
  }

  for (const match of markdown.matchAll(
    MARKDOWN_REFERENCE_DEFINITION_PATTERN,
  )) {
    const destination = match[2]?.trim();
    if (destination) {
      destinations.add(destination);
    }
  }

  for (const destination of destinations) {
    let code: DocsExportDiagnostic["code"] | null = null;
    if (destination.startsWith("xref:")) {
      code = "raw_xref";
    } else if (
      destination.includes("ROOT:page$") ||
      destination.includes("ROOT:partial$")
    ) {
      code = "antora_family";
    } else if (/^[^/():]+:.+\.html(?:#.*)?$/u.test(destination)) {
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

export async function exportAntoraDocsToMarkdown(
  params: ExportDocsParams,
): Promise<DocsExportArtifact[]> {
  const format = params.format ?? "multimarkdown";
  const extension = params.extension ?? resolveDocsExportExtension(format);
  const rootLevel = params.rootLevel ?? 1;
  const exportWorkspace = await prepareAntoraWorkspaceRoot({
    workspaceRoot: params.workspaceRoot,
  });
  const resolvedLogOutput = params.logOutput
    ? path.resolve(params.logOutput)
    : undefined;

  try {
    const playbookPath = await resolveDocsPlaybookPath({
      workspaceRoot: exportWorkspace.workspaceRoot,
      playbookPath: params.playbookPath,
    });
    await fs.mkdir(params.outputDir, { recursive: true });

    const exportAntoraModulesToMarkdown =
      await loadExportAntoraModulesToMarkdown();
    if (resolvedLogOutput) {
      await fs.mkdir(path.dirname(resolvedLogOutput), { recursive: true });
    }

    const runtimeLog = resolvedLogOutput
      ? {
          level: "all" as const,
          format: "pretty" as const,
          destination: {
            file: resolvedLogOutput,
            sync: true,
          },
        }
      : undefined;

    let exports: ExportedAntoraAssembly[];
    if (resolvedLogOutput) {
      const logWriter = await fs.open(resolvedLogOutput, "w");
      const originalStderr = process.stderr.write.bind(process.stderr);

      process.stderr.write = ((
        chunk: string | Uint8Array,
        encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
        callback?: (error?: Error | null) => void,
      ) => {
        const text = String(chunk);
        if (text.trim()) {
          logWriter.write(`${text}\n`).catch(() => undefined);
        }
        return originalStderr(chunk, encodingOrCallback as never, callback);
      }) as typeof process.stderr.write;

      try {
        exports = await withSuppressedExporterWarnings(() =>
          exportAntoraModulesToMarkdown({
            playbookPath,
            flavor: format,
            rootLevel,
            runtimeLog,
          }),
        );
      } finally {
        process.stderr.write = originalStderr;
        await logWriter.close();
      }
    } else {
      exports = await withSuppressedExporterWarnings(() =>
        exportAntoraModulesToMarkdown({
          playbookPath,
          flavor: format,
          rootLevel,
          runtimeLog,
        }),
      );
    }

    const outputFileBySourcePath = new Map<string, string>();
    for (const exported of exports) {
      const outputFile = resolveExportOutputFile({
        assemblyPath: exported.path,
        extension,
        filenamePrefix: params.filenamePrefix,
      });
      for (const sourcePath of exported.sourcePages) {
        outputFileBySourcePath.set(sourcePath, outputFile);
      }
    }

    const artifacts: DocsExportArtifact[] = [];
    for (const exported of exports) {
      const outputFile = resolveExportOutputFile({
        assemblyPath: exported.path,
        extension,
        filenamePrefix: params.filenamePrefix,
      });
      const content = rewriteReviewLinkDestinations({
        markdown: normalizeRenderedAssembly(exported.content),
        currentOutputFile: outputFile,
        outputFileBySourcePath,
      });
      const diagnostics = analyzeDocsExportMarkdown(content);

      const outputPath = path.join(params.outputDir, outputFile);
      await fs.writeFile(outputPath, content, "utf8");
      const stat = await fs.stat(outputPath);

      artifacts.push({
        assemblyName: exported.assemblyName,
        title: resolveMarkdownTitle({
          content,
          fallback: exported.name,
        }),
        moduleName: exported.moduleName,
        outputFile,
        outputPath,
        relativeOutputPath: path
          .relative(params.outputDir, outputPath)
          .replaceAll("\\", "/"),
        pageCount: exported.sourcePages.length,
        sourcePaths: [...exported.sourcePages],
        sha256: await sha256File(outputPath),
        sizeBytes: stat.size,
        rootLevel,
        diagnostics,
      });
    }

    return artifacts.sort((left, right) =>
      left.outputFile.localeCompare(right.outputFile),
    );
  } finally {
    await pruneEmptyLogOutput(resolvedLogOutput);
    if (exportWorkspace.cleanup !== null) {
      await exportWorkspace.cleanup();
    }
  }
}
