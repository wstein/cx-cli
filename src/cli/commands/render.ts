import fs from "node:fs/promises";
import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import type { CxStyle } from "../../config/types.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import { renderSection } from "../../repomix/section.js";
import { CxError } from "../../shared/errors.js";
import {
  estimateTokenCount,
  formatBytes,
  formatNumber,
  printDivider,
  printHeader,
  printSuccess,
  printTable,
} from "../../shared/format.js";
import { writeJson } from "../../shared/output.js";

export interface RenderArgs {
  config: string;
  sections?: string[] | undefined;
  files?: string[] | undefined;
  allSections?: boolean | undefined;
  style?: CxStyle | undefined;
  stdout?: boolean | undefined;
  outputDir?: string | undefined;
  json?: boolean | undefined;
}

export async function runRenderCommand(args: RenderArgs): Promise<number> {
  const configPath = path.resolve(args.config);
  const config = await loadCxConfig(configPath);
  const plan = await buildBundlePlan(config);

  // Validate selection
  const requestedSections = args.sections ?? [];
  const requestedFiles = args.files ?? [];
  const hasSelection =
    args.allSections ||
    requestedSections.length > 0 ||
    requestedFiles.length > 0;

  if (!hasSelection) {
    throw new CxError(
      "Selection required: use --section, --all-sections, or --file",
      2,
    );
  }

  // Resolve sections
  let selectedSectionNames: string[];
  if (args.allSections) {
    selectedSectionNames = plan.sections.map((s) => s.name);
  } else if (requestedSections.length > 0) {
    selectedSectionNames = requestedSections;
    for (const name of selectedSectionNames) {
      if (!plan.sections.some((s) => s.name === name)) {
        throw new CxError(`Section '${name}' not found in plan.`, 2);
      }
    }
  } else {
    // File-based selection
    selectedSectionNames = Array.from(
      new Set(
        requestedFiles.map((f) => {
          const section = plan.sections.find((s) =>
            s.files.some((sf) => sf.relativePath === f),
          );
          if (!section) {
            throw new CxError(`File '${f}' not found in any section.`, 2);
          }
          return section.name;
        }),
      ),
    );
  }

  // Render selected sections
  const outputs: Array<{
    section: string;
    style: CxStyle;
    outputFile: string;
    fileCount: number;
    sizeBytes: number;
    estimatedTokens: number;
  }> = [];

  for (const sectionName of selectedSectionNames) {
    const section = plan.sections.find((s) => s.name === sectionName);
    if (!section) {
      throw new CxError(`Section '${sectionName}' not found in plan.`, 2);
    }
    const selectedFiles =
      requestedFiles.length > 0
        ? section.files
            .filter((f) => requestedFiles.includes(f.relativePath))
            .map((f) => f.relativePath)
        : section.files.map((f) => f.relativePath);

    if (selectedFiles.length === 0) {
      continue;
    }

    const style = args.style ?? config.repomix.style;
    const result = await renderSection({
      config,
      section: sectionName,
      style,
      sourceRoot: config.sourceRoot,
      files: selectedFiles,
    });

    const selectedSectionFiles = section.files.filter((f) =>
      selectedFiles.includes(f.relativePath),
    );
    const totalSizeBytes = selectedSectionFiles.reduce(
      (sum, f) => sum + f.sizeBytes,
      0,
    );
    const estimatedTokens = estimateTokenCount(
      result.content,
      config.tokens.algorithm,
    );

    outputs.push({
      section: sectionName,
      style,
      outputFile: `${config.projectName}-repomix-${sectionName}.${styleExtension(style)}`,
      fileCount: selectedFiles.length,
      sizeBytes: totalSizeBytes,
      estimatedTokens,
    });

    if (args.stdout && outputs.length === 1) {
      process.stdout.write(result.content);
    } else if (args.outputDir) {
      const outputPath = path.resolve(
        args.outputDir,
        `${config.projectName}-repomix-${sectionName}.${styleExtension(style)}`,
      );
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, result.content, "utf8");
    }
  }

  // Print colored summary if not in stdout mode and not JSON
  if (!(args.stdout && outputs.length === 1) && !(args.json ?? false)) {
    printHeader("Render Complete");
    for (const output of outputs) {
      printTable([
        [`📄 ${output.section}`, ""],
        ["  Files", output.fileCount],
        ["  Size", formatBytes(output.sizeBytes)],
        ["  Tokens (est.)", formatNumber(output.estimatedTokens)],
      ]);
    }
    if (outputs.length > 0) {
      printDivider();
      const totalSize = outputs.reduce((sum, o) => sum + o.sizeBytes, 0);
      const totalTokens = outputs.reduce(
        (sum, o) => sum + o.estimatedTokens,
        0,
      );
      printTable([
        ["Total size", formatBytes(totalSize)],
        ["Total tokens", formatNumber(totalTokens)],
      ]);
      printSuccess(
        `Rendered ${outputs.length} section${outputs.length === 1 ? "" : "s"}`,
      );
    }
  }

  if (args.json ?? false) {
    writeJson({
      projectName: config.projectName,
      sourceRoot: config.sourceRoot,
      selection: {
        sections: selectedSectionNames,
        files: requestedFiles,
      },
      outputs,
    });
  }

  return 0;
}

function styleExtension(style: CxStyle): string {
  switch (style) {
    case "markdown":
      return "md";
    case "json":
      return "json";
    case "plain":
      return "txt";
    case "xml":
      return "xml.txt";
  }
}
