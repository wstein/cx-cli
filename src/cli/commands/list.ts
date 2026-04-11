import fs from "node:fs/promises";
import path from "node:path";

import { loadManifestFromBundle } from "../../bundle/validate.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../shared/manifestSummary.js";
import { writeJson } from "../../shared/output.js";
import { selectManifestRows } from "../../shared/verifyFilters.js";
import { estimateTokenCount } from "../../shared/format.js";
import type { CxManifest, ManifestFileRow } from "../../manifest/types.js";

export interface ListArgs {
  bundleDir: string;
  json: boolean;
  sections?: string[] | undefined;
  files?: string[] | undefined;
}

async function readOutputFiles(
  bundleDir: string,
  rows: ManifestFileRow[],
  sectionOutputFileMap: Map<string, string>,
  assetStoredPaths: Map<string, string>,
) {
  const outputs = new Map<string, string>();
  const mtimes = new Map<string, string>();

  for (const row of rows) {
    const outputFile = sectionOutputFileMap.get(row.section);
    if (row.storedIn === "packed" && outputFile !== undefined) {
      const outputPath = path.join(bundleDir, outputFile);
      if (!outputs.has(outputFile)) {
        outputs.set(outputFile, await fs.readFile(outputPath, "utf8"));
      }
      if (!mtimes.has(outputFile)) {
        const stat = await fs.stat(outputPath);
        mtimes.set(outputFile, stat.mtime.toISOString());
      }
    }

    if (row.storedIn === "copied") {
      const storedPath = assetStoredPaths.get(row.path) ?? row.path;
      const filePath = path.join(bundleDir, storedPath);
      if (!mtimes.has(row.path)) {
        const stat = await fs.stat(filePath);
        mtimes.set(row.path, stat.mtime.toISOString());
      }
    }
  }

  return { outputs, mtimes };
}

function extractLines(content: string, startLine: number, endLine: number): string {
  const lines = content.split(/\r?\n/);
  return lines.slice(startLine - 1, endLine).join("\n");
}

function estimateTokensForRow(
  row: ManifestFileRow,
  sectionOutputFileMap: Map<string, string>,
  outputs: Map<string, string>,
): number {
  const outputFile = sectionOutputFileMap.get(row.section);
  if (
    row.storedIn === "packed" &&
    outputFile !== undefined &&
    row.outputStartLine !== null &&
    row.outputEndLine !== null
  ) {
    const outputText = outputs.get(outputFile);
    if (outputText !== undefined) {
      return estimateTokenCount(
        extractLines(outputText, row.outputStartLine, row.outputEndLine),
      );
    }
  }

  return Math.max(1, Math.round(row.sizeBytes / 4));
}

function formatMtime(
  row: ManifestFileRow,
  sectionOutputFileMap: Map<string, string>,
  mtimes: Map<string, string>,
): string {
  const outputFile = sectionOutputFileMap.get(row.section);
  if (row.storedIn === "packed" && outputFile !== undefined) {
    return mtimes.get(outputFile) ?? "-";
  }

  if (row.storedIn === "copied") {
    return mtimes.get(row.path) ?? "-";
  }

  return "-";
}

function buildSectionOutputFileMap(manifest: CxManifest): Map<string, string> {
  return new Map(manifest.sections.map((s) => [s.name, s.outputFile]));
}

export async function runListCommand(args: ListArgs): Promise<number> {
  const { manifest, manifestName } = await loadManifestFromBundle(
    path.resolve(args.bundleDir),
  );
  const rows = selectManifestRows(manifest.files, {
    sections: args.sections,
    files: args.files,
  });
  const sections = selectManifestSections(manifest, rows);
  const assets = selectManifestAssets(manifest, rows);
  const sectionOutputFileMap = buildSectionOutputFileMap(manifest);
  const assetStoredPaths = new Map(
    manifest.assets.map((a) => [a.sourcePath, a.storedPath]),
  );
  const { outputs, mtimes } = await readOutputFiles(
    path.resolve(args.bundleDir),
    rows,
    sectionOutputFileMap,
    assetStoredPaths,
  );

  const rowsWithMeta = rows.map((file) => ({
    ...file,
    bytes: file.sizeBytes,
    tokens: estimateTokensForRow(file, sectionOutputFileMap, outputs),
    mtime: formatMtime(file, sectionOutputFileMap, mtimes),
  }));

  if (args.json) {
    writeJson({
      summary: summarizeManifest(manifestName, manifest, rows),
      repomix: await getRepomixCapabilities(),
      settings: manifest.settings,
      selection: {
        sections: args.sections ?? [],
        files: args.files ?? [],
      },
      sections,
      assets,
      files: rowsWithMeta,
    });
    return 0;
  }

  const lines = [
    `manifest: ${manifestName}`,
    "kind\tsection\tstored_in\tpath\tbytes\ttokens\tmtime",
    ...rowsWithMeta.map(
      (file) =>
        `${file.kind}\t${file.section}\t${file.storedIn}\t${file.path}\t${file.bytes}\t${file.tokens}\t${file.mtime}`,
    ),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}
