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
import type { ManifestFileRow } from "../../manifest/types.js";

export interface ListArgs {
  bundleDir: string;
  json: boolean;
  sections?: string[] | undefined;
  files?: string[] | undefined;
}

async function readOutputFiles(
  bundleDir: string,
  rows: ManifestFileRow[],
  assetStoredPaths: Map<string, string>,
) {
  const outputs = new Map<string, string>();
  const mtimes = new Map<string, string>();

  for (const row of rows) {
    if (row.storedIn === "packed" && row.outputFile !== "-") {
      const outputPath = path.join(bundleDir, row.outputFile);
      if (!outputs.has(row.outputFile)) {
        outputs.set(row.outputFile, await fs.readFile(outputPath, "utf8"));
      }
      if (!mtimes.has(row.outputFile)) {
        const stat = await fs.stat(outputPath);
        mtimes.set(row.outputFile, stat.mtime.toISOString());
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
  outputs: Map<string, string>,
): number {
  if (
    row.storedIn === "packed" &&
    row.outputFile !== "-" &&
    row.outputStartLine !== "-" &&
    row.outputEndLine !== "-"
  ) {
    const outputText = outputs.get(row.outputFile);
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
  mtimes: Map<string, string>,
): string {
  if (row.storedIn === "packed" && row.outputFile !== "-") {
    return mtimes.get(row.outputFile) ?? "-";
  }

  if (row.storedIn === "copied") {
    return mtimes.get(row.path) ?? "-";
  }

  return "-";
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
  const assetStoredPaths = new Map(
    manifest.assets.map((a) => [a.sourcePath, a.storedPath]),
  );
  const { outputs, mtimes } = await readOutputFiles(
    path.resolve(args.bundleDir),
    rows,
    assetStoredPaths,
  );

  const rowsWithMeta = rows.map((file) => ({
    ...file,
    bytes: file.sizeBytes,
    tokens: estimateTokensForRow(file, outputs),
    mtime: formatMtime(file, mtimes),
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
