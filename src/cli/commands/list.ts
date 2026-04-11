import fs from "node:fs/promises";
import path from "node:path";

import kleur from "kleur";

import { loadManifestFromBundle } from "../../bundle/validate.js";
import { resolveExtractability } from "../../extract/resolution.js";
import type { CxManifest, ManifestFileRow } from "../../manifest/types.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../shared/manifestSummary.js";
import {
  estimateTokenCount,
  estimateTokenCountFromLength,
  formatBytes,
  formatNumber,
} from "../../shared/format.js";
import { writeJson } from "../../shared/output.js";
import { selectManifestRows } from "../../shared/verifyFilters.js";

export interface ListArgs {
  bundleDir: string;
  json: boolean;
  sections?: string[] | undefined;
  files?: string[] | undefined;
}

interface RowMeta {
  path: string;
  section: string;
  bytes: number;
  tokens: number;
  mtime: string;
  mtimeRelative: string;
  ready: "ok" | "copy" | "no";
  extractability: {
    status: "exact" | "blocked" | "copied";
    reason: string;
    message: string;
  };
}

async function readOutputFiles(
  bundleDir: string,
  rows: ManifestFileRow[],
  sectionOutputFileMap: Map<string, string>,
) {
  const outputs = new Map<string, string>();

  for (const row of rows) {
    const outputFile = sectionOutputFileMap.get(row.section);
    if (row.storedIn === "packed" && outputFile !== undefined) {
      const outputPath = path.join(bundleDir, outputFile);
      if (!outputs.has(outputFile)) {
        outputs.set(outputFile, await fs.readFile(outputPath, "utf8"));
      }
    }
  }

  return { outputs };
}

function extractLines(content: string, startLine: number, endLine: number): string {
  const lines = content.split(/\r?\n/);
  return lines.slice(startLine - 1, endLine).join("\n");
}

function estimateTokensForRow(
  row: ManifestFileRow,
  sectionOutputFileMap: Map<string, string>,
  outputs: Map<string, string>,
  manifest: CxManifest,
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
        manifest.settings.tokenAlgorithm,
      );
    }
  }

  return estimateTokenCountFromLength(
    row.sizeBytes,
    manifest.settings.tokenAlgorithm,
  );
}

function buildSectionOutputFileMap(manifest: CxManifest): Map<string, string> {
  return new Map(manifest.sections.map((section) => [section.name, section.outputFile]));
}

function formatRelativeTime(iso: string): string {
  if (iso === "-") {
    return "-";
  }

  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "just now";
  }
  if (diffMs < hour) {
    return `${Math.round(diffMs / minute)}m ago`;
  }
  if (diffMs < day) {
    return `${Math.round(diffMs / hour)}h ago`;
  }
  if (diffMs < 7 * day) {
    return `${Math.round(diffMs / day)}d ago`;
  }

  return iso.slice(0, 10);
}

function colorByTemperature(
  value: string,
  band: "cool" | "warm" | "hot",
): string {
  if (band === "cool") {
    return kleur.green(value);
  }
  if (band === "warm") {
    return kleur.yellow(value);
  }
  return kleur.red(value);
}

function colorBytes(
  bytes: number,
  value: string,
  manifest: CxManifest,
): string {
  if (bytes <= manifest.settings.listDisplay.bytesWarm) {
    return colorByTemperature(value, "cool");
  }
  if (bytes <= manifest.settings.listDisplay.bytesHot) {
    return colorByTemperature(value, "warm");
  }
  return colorByTemperature(value, "hot");
}

function colorTokens(
  tokens: number,
  value: string,
  manifest: CxManifest,
): string {
  if (tokens <= manifest.settings.listDisplay.tokensWarm) {
    return colorByTemperature(value, "cool");
  }
  if (tokens <= manifest.settings.listDisplay.tokensHot) {
    return colorByTemperature(value, "warm");
  }
  return colorByTemperature(value, "hot");
}

function colorMtime(
  iso: string,
  value: string,
  manifest: CxManifest,
): string {
  if (iso === "-") {
    return kleur.gray(value);
  }

  const ageMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const warmMs = manifest.settings.listDisplay.mtimeWarmMinutes * 60 * 1000;
  const hotMs =
    manifest.settings.listDisplay.mtimeHotHours * 60 * 60 * 1000;

  if (ageMs <= warmMs) {
    return colorByTemperature(value, "cool");
  }
  if (ageMs <= hotMs) {
    return colorByTemperature(value, "warm");
  }
  return colorByTemperature(value, "hot");
}

function colorExtractability(status: RowMeta["extractability"]["status"], value: string): string {
  if (status === "exact") {
    return kleur.green(value);
  }
  if (status === "copied") {
    return kleur.cyan(value);
  }
  return kleur.red(value);
}

function renderGroupedList(
  manifestName: string,
  rows: RowMeta[],
  manifest: CxManifest,
): string {
  const groups = new Map<string, RowMeta[]>();
  for (const row of rows) {
    const sectionRows = groups.get(row.section) ?? [];
    sectionRows.push(row);
    groups.set(row.section, sectionRows);
  }

  const pathWidth = Math.max(
    "path".length,
    ...rows.map((row) => row.path.length),
  );
  const bytesWidth = Math.max(
    "bytes".length,
    ...rows.map((row) => formatBytes(row.bytes).length),
  );
  const tokensWidth = Math.max(
    "tokens".length,
    ...rows.map((row) => `${formatNumber(row.tokens)} tok`.length),
  );
  const mtimeWidth = Math.max(
    "mtime".length,
    ...rows.map((row) => row.mtimeRelative.length),
  );
  const readyWidth = "ready".length;

  const orderedSections = [...groups.keys()].sort((left, right) => {
    if (left === "assets") {
      return 1;
    }
    if (right === "assets") {
      return -1;
    }
    return left.localeCompare(right, "en");
  });

  const lines = [`manifest: ${kleur.bold().white(manifestName)}`];
  for (const sectionName of orderedSections) {
    const sectionRows = groups.get(sectionName) ?? [];
    lines.push("");
    lines.push(kleur.bold().cyan(sectionName));
    lines.push(
      [
        "  ",
        kleur.gray("path".padEnd(pathWidth)),
        "  ",
        kleur.gray("bytes".padStart(bytesWidth)),
        "  ",
        kleur.gray("tokens".padStart(tokensWidth)),
        "  ",
        kleur.gray("mtime".padEnd(mtimeWidth)),
        "  ",
        kleur.gray("ready".padEnd(readyWidth)),
      ].join(""),
    );

    for (const row of sectionRows) {
      const pathCell = kleur.white(row.path.padEnd(pathWidth));
      const bytesRaw = formatBytes(row.bytes).padStart(bytesWidth);
      const tokensRaw = `${formatNumber(row.tokens)} tok`.padStart(tokensWidth);
      const mtimeRaw = row.mtimeRelative.padEnd(mtimeWidth);
      const readyRaw = row.ready.padEnd(readyWidth);
      lines.push(
        [
          "  ",
          pathCell,
          "  ",
          colorBytes(row.bytes, bytesRaw, manifest),
          "  ",
          colorTokens(row.tokens, tokensRaw, manifest),
          "  ",
          colorMtime(row.mtime, mtimeRaw, manifest),
          "  ",
          colorExtractability(row.extractability.status, readyRaw),
        ].join(""),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function runListCommand(args: ListArgs): Promise<number> {
  const bundleDir = path.resolve(args.bundleDir);
  const { manifest, manifestName } = await loadManifestFromBundle(bundleDir);
  const rows = selectManifestRows(manifest.files, {
    sections: args.sections,
    files: args.files,
  });
  const sections = selectManifestSections(manifest, rows);
  const assets = selectManifestAssets(manifest, rows);
  const sectionOutputFileMap = buildSectionOutputFileMap(manifest);
  const { outputs } = await readOutputFiles(
    bundleDir,
    rows,
    sectionOutputFileMap,
  );
  const extractability = await resolveExtractability({
    bundleDir,
    manifest,
    rows,
  });

  const rowsWithMeta: RowMeta[] = rows.map((file) => {
    const mtime = file.mtime;
    const record = extractability.recordsByPath.get(file.path);
    return {
      path: file.path,
      section: file.section === "-" ? "assets" : file.section,
      bytes: file.sizeBytes,
      tokens: estimateTokensForRow(file, sectionOutputFileMap, outputs, manifest),
      mtime,
      mtimeRelative: formatRelativeTime(mtime),
      ready:
        record?.status === "exact"
          ? "ok"
          : record?.status === "copied"
            ? "copy"
            : "no",
      extractability: {
        status: record?.status ?? "blocked",
        reason: record?.reason ?? "section_parse_failed",
        message: record?.message ?? `No extractability record was produced for ${file.path}.`,
      },
    };
  });

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

  process.stdout.write(renderGroupedList(manifestName, rowsWithMeta, manifest));
  return 0;
}
