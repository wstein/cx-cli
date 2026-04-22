import path from "node:path";
import { getCLIOverrides, readEnvOverrides } from "../../config/env.js";
import { loadCxConfig } from "../../config/load.js";
import {
  type DocsExportArtifact,
  DocsExportValidationError,
  exportAntoraDocsToMarkdown,
} from "../../docs/export.js";
import {
  formatBytes,
  formatNumber,
  printDivider,
  printHeader,
  printSuccess,
  printTable,
} from "../../shared/format.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeValidatedJson,
} from "../../shared/output.js";
import { DocsExportCommandJsonSchema } from "../jsonContracts.js";

export interface DocsArgs {
  subcommand: "export";
  config: string;
  outputDir?: string | undefined;
  playbook?: string | undefined;
  json?: boolean | undefined;
}

function resolveDocsExportOutputDir(params: {
  cwd: string;
  configuredOutputDir?: string | undefined;
  targetDir: string;
}): string {
  if (params.configuredOutputDir) {
    return path.resolve(params.cwd, params.configuredOutputDir);
  }

  return path.resolve(params.cwd, "dist", params.targetDir);
}

export async function runDocsCommand(
  args: DocsArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const configPath = path.resolve(io.cwd, args.config);
  const config = await loadCxConfig(
    configPath,
    readEnvOverrides(io.env),
    getCLIOverrides(),
    { emitBehaviorLogs: io.emitBehaviorLogs },
  );
  const outputDir = resolveDocsExportOutputDir({
    cwd: io.cwd,
    configuredOutputDir: args.outputDir,
    targetDir: config.docs.targetDir,
  });
  const playbookPath = path.resolve(
    config.sourceRoot,
    args.playbook ?? "antora-playbook.yml",
  );

  let exports: DocsExportArtifact[];
  try {
    exports = await exportAntoraDocsToMarkdown({
      workspaceRoot: config.sourceRoot,
      outputDir,
      format: "multimarkdown",
      playbookPath: args.playbook,
    });
  } catch (error) {
    if (args.json !== true) {
      throw error;
    }

    const payload =
      error instanceof DocsExportValidationError
        ? {
            command: "docs export" as const,
            valid: false as const,
            projectName: config.projectName,
            outputDir,
            playbookPath,
            error: {
              type: "validation" as const,
              message: error.message,
              surfaceName: error.surfaceName,
              diagnostics: error.diagnostics,
            },
          }
        : {
            command: "docs export" as const,
            valid: false as const,
            projectName: config.projectName,
            outputDir,
            playbookPath,
            error: {
              type: "runtime" as const,
              message: error instanceof Error ? error.message : String(error),
            },
          };
    writeValidatedJson(DocsExportCommandJsonSchema, payload, io);
    return 12;
  }
  const totalBytes = exports.reduce(
    (sum, artifact) => sum + artifact.sizeBytes,
    0,
  );
  const totalPages = exports.reduce(
    (sum, artifact) => sum + artifact.pageCount,
    0,
  );
  const totalDiagnostics = exports.reduce(
    (sum, artifact) => sum + artifact.diagnostics.diagnostics.length,
    0,
  );

  if (args.json === true) {
    writeValidatedJson(
      DocsExportCommandJsonSchema,
      {
        command: "docs export",
        valid: true,
        projectName: config.projectName,
        outputDir,
        playbookPath,
        exportCount: exports.length,
        totalBytes,
        totalPages,
        totalDiagnostics,
        exports,
      },
      io,
    );
    return 0;
  }

  printHeader("Docs Export Complete", io);
  printTable(
    [
      ["Project", config.projectName],
      ["Output", outputDir],
      ["Playbook", playbookPath],
      ["Exports", exports.length],
      ["Pages", formatNumber(totalPages)],
      ["Total size", formatBytes(totalBytes)],
      ["Diagnostics", formatNumber(totalDiagnostics)],
    ],
    io,
  );

  for (const artifact of exports) {
    printDivider(io);
    printTable(
      [
        [artifact.title, artifact.outputFile],
        ["  Pages", formatNumber(artifact.pageCount)],
        ["  Size", formatBytes(artifact.sizeBytes)],
        ["  SHA-256", artifact.sha256],
      ],
      io,
    );
  }

  printDivider(io);
  printSuccess(
    `Exported ${exports.length} docs surface${exports.length === 1 ? "" : "s"}.`,
    io,
  );
  return 0;
}
