import path from "node:path";
import { getCLIOverrides, readEnvOverrides } from "../../config/env.js";
import { loadCxConfig } from "../../config/load.js";
import {
  checkDocsDrift,
  compileDocsFromNotes,
  normalizeDocsCompileProfile,
} from "../../docs/compile.js";
import {
  type DocsExportArtifact,
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
  writeJson,
  writeValidatedJson,
} from "../../shared/output.js";
import { DocsExportCommandJsonSchema } from "../jsonContracts.js";

export interface DocsArgs {
  subcommand: "export" | "compile" | "drift";
  config: string;
  outputDir?: string | undefined;
  playbook?: string | undefined;
  rootLevel?: 0 | 1 | undefined;
  logOutput?: string | undefined;
  profile?: string | undefined;
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
  if (args.subcommand === "compile") {
    const profile = normalizeDocsCompileProfile(args.profile ?? "architecture");
    const result = await compileDocsFromNotes({
      workspaceRoot: io.cwd,
      profile,
      configPath: args.config,
    });
    if (args.json === true) {
      writeJson(result, io);
    } else {
      printHeader("Docs Compile Complete", io);
      printTable(
        [
          ["Profile", result.profile],
          ["Output", result.outputPath],
          ["Source notes", formatNumber(result.sourceNoteIds.length)],
          ["Source specs", formatNumber(result.sourceSpecRefs.length)],
          ["SHA-256", result.sha256],
          ["Changed", result.changed ? "yes" : "no"],
        ],
        io,
      );
    }
    return 0;
  }

  if (args.subcommand === "drift") {
    const profiles =
      args.profile === undefined
        ? undefined
        : [normalizeDocsCompileProfile(args.profile)];
    const result = await checkDocsDrift({
      workspaceRoot: io.cwd,
      profiles,
      configPath: args.config,
    });
    if (args.json === true) {
      writeJson(result, io);
    } else {
      printHeader("Docs Drift", io);
      printTable(
        [
          ["Profiles", result.profiles.join(", ")],
          [
            "Stale generated docs",
            formatNumber(result.staleGeneratedDocs.length),
          ],
        ],
        io,
      );
      for (const stale of result.staleGeneratedDocs) {
        printDivider(io);
        printTable(
          [
            ["Profile", stale.profile],
            ["Output", stale.outputPath],
            ["Reason", stale.reason],
            ["Expected SHA-256", stale.expectedSha256],
            ["Actual SHA-256", stale.actualSha256 ?? "(missing)"],
          ],
          io,
        );
      }
      if (result.valid) {
        printSuccess("Generated docs are fresh.", io);
      }
    }
    return result.valid ? 0 : 1;
  }

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
  const rootLevel = args.rootLevel ?? config.docs.rootLevel;

  let exports: DocsExportArtifact[];
  try {
    exports = await exportAntoraDocsToMarkdown({
      workspaceRoot: config.sourceRoot,
      outputDir,
      format: "multimarkdown",
      playbookPath: args.playbook,
      rootLevel,
      logOutput: args.logOutput ?? config.docs.logOutput,
    });
  } catch (error) {
    if (args.json !== true) {
      throw error;
    }

    const payload = {
      command: "docs export" as const,
      valid: false as const,
      projectName: config.projectName,
      outputDir,
      playbookPath,
      rootLevel,
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
        rootLevel,
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
      ["Root level", String(rootLevel)],
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
    `Exported ${exports.length} Antora markdown assembl${exports.length === 1 ? "y" : "ies"}.`,
    io,
  );
  return 0;
}
