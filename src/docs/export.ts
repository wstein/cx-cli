import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

function rewriteReviewLinkDestinations(params: {
  markdown: string;
  currentOutputFile: string;
  outputFileBySourcePath: Map<string, string>;
}): string {
  const rewriteDestination = (destination: string): string => {
    const resolvedTarget = resolveTargetSourcePath(destination);
    if (!resolvedTarget) {
      return destination;
    }

    const targetOutputFile = params.outputFileBySourcePath.get(
      resolvedTarget.sourcePath,
    );
    if (!targetOutputFile) {
      return destination;
    }

    const fragment =
      resolvedTarget.fragment.length > 0 ? `#${resolvedTarget.fragment}` : "";
    return targetOutputFile === params.currentOutputFile
      ? fragment || "#"
      : `${targetOutputFile}${fragment}`;
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
  const playbookPath = await resolveDocsPlaybookPath({
    workspaceRoot: params.workspaceRoot,
    playbookPath: params.playbookPath,
  });
  await fs.mkdir(params.outputDir, { recursive: true });

  const exportAntoraModulesToMarkdown =
    await loadExportAntoraModulesToMarkdown();
  const resolvedLogOutput = params.logOutput
    ? path.resolve(params.logOutput)
    : undefined;
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

  // Wrap export with stream interception to capture any warnings
  // This is a fallback in case Antora's native logger doesn't write to the file
  let exports: ExportedAntoraAssembly[];
  try {
    if (resolvedLogOutput) {
      const logWriter = await fs.open(resolvedLogOutput, "w");
      const originalStderr = process.stderr.write.bind(process.stderr);

      process.stderr.write = ((chunk, encodingOrCallback, callback) => {
        const text = String(chunk);
        if (text.trim()) {
          logWriter.write(`${text}\n`).catch(() => {});
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
  } finally {
    await pruneEmptyLogOutput(resolvedLogOutput);
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
}
