import path from "node:path";
import kleur from "kleur";
import { resolveDerivedReviewExportIntegrity } from "../../bundle/derivedReviewExports.js";
import { loadManifestFromBundle } from "../../bundle/validate.js";
import type { CxListDisplayConfig } from "../../config/types.js";
import { loadCxUserConfig } from "../../config/user.js";
import { resolveExtractability } from "../../extract/resolution.js";
import type { ManifestFileRow } from "../../manifest/types.js";
import { sortInclusionProvenance } from "../../planning/provenance.js";
import { formatBytes, formatNumber } from "../../shared/format.js";
import {
  selectManifestAssets,
  selectManifestSections,
  summarizeManifest,
} from "../../shared/manifestSummary.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeStdout,
  writeValidatedJson,
} from "../../shared/output.js";
import { selectManifestRows } from "../../shared/verifyFilters.js";
import { ListCommandJsonSchema } from "../jsonContracts.js";

export interface ListArgs {
  bundleDir: string;
  json: boolean;
  sections?: string[] | undefined;
  files?: string[] | undefined;
  derivedReviewExportsOnly?: boolean | undefined;
}

interface RowMeta {
  path: string;
  section: string;
  bytes: number;
  tokens: number;
  mtime: string;
  mtimeRelative: string;
  status: "intact" | "copied" | "degraded" | "blocked";
  provenance: string[];
  extractability: {
    status: "intact" | "copied" | "degraded" | "blocked";
    reason: string;
    message: string;
    expectedSha256?: string;
    actualSha256?: string;
  };
}

interface DerivedReviewExportMeta {
  assemblyName: string;
  title: string;
  moduleName: string | null;
  storedPath: string;
  sha256: string;
  sizeBytes: number;
  pageCount: number;
  rootLevel: 0 | 1;
  sourcePaths: string[];
  trustClassification: "derived_review_export";
  status: "intact" | "blocked";
  extractability: {
    status: "intact" | "blocked";
    reason: "intact" | "missing_artifact" | "hash_mismatch";
    message: string;
    expectedSha256?: string;
    actualSha256?: string;
  };
}

function compareDeterministicText(left: string, right: string): number {
  const leftFolded = left.toLowerCase();
  const rightFolded = right.toLowerCase();
  if (leftFolded < rightFolded) {
    return -1;
  }
  if (leftFolded > rightFolded) {
    return 1;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function formatProvenanceSuffix(
  provenance: string[],
  useColor: boolean,
): string {
  if (provenance.length === 0) {
    return "";
  }

  const sorted = sortInclusionProvenance(
    provenance as unknown as Array<
      | "section_match"
      | "catch_all_section_match"
      | "asset_rule_match"
      | "linked_note_enrichment"
      | "manifest_note_inclusion"
    >,
  );
  const suffix = ` [${sorted.join(", ")}]`;
  return useColor ? kleur.gray(suffix) : suffix;
}

function getTokensForRow(row: ManifestFileRow): number {
  return row.tokenCount;
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
  useColor: boolean,
): string {
  if (!useColor) {
    return value;
  }
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
  listDisplay: CxListDisplayConfig,
  useColor: boolean,
): string {
  if (bytes <= listDisplay.bytesWarm) {
    return colorByTemperature(value, "cool", useColor);
  }
  if (bytes <= listDisplay.bytesHot) {
    return colorByTemperature(value, "warm", useColor);
  }
  return colorByTemperature(value, "hot", useColor);
}

function colorTokens(
  tokens: number,
  value: string,
  listDisplay: CxListDisplayConfig,
  useColor: boolean,
): string {
  if (tokens <= listDisplay.tokensWarm) {
    return colorByTemperature(value, "cool", useColor);
  }
  if (tokens <= listDisplay.tokensHot) {
    return colorByTemperature(value, "warm", useColor);
  }
  return colorByTemperature(value, "hot", useColor);
}

function ansi256(value: string, code: number): string {
  return `\u001B[38;5;${code}m${value}\u001B[39m`;
}

function colorTime(
  iso: string,
  value: string,
  listDisplay: CxListDisplayConfig,
  useColor: boolean,
): string {
  if (!useColor) {
    return value;
  }
  if (iso === "-") {
    return kleur.gray(value);
  }

  const ageMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const maxAgeMs = listDisplay.mtimeHotHours * 60 * 60 * 1000;
  const grayscale = listDisplay.timePalette;
  const thresholds = [
    1 / 120,
    1 / 60,
    1 / 30,
    1 / 15,
    1 / 8,
    1 / 4,
    1 / 2,
    3 / 4,
    1,
    Number.POSITIVE_INFINITY,
  ];
  const ratio = ageMs / Math.max(1, maxAgeMs);
  const index = thresholds.findIndex((threshold) => ratio <= threshold);
  const code = grayscale[index] ?? grayscale[grayscale.length - 1] ?? 246;
  return ansi256(value, code);
}

function colorExtractability(
  status: RowMeta["extractability"]["status"],
  value: string,
  useColor: boolean,
): string {
  if (!useColor) {
    return value;
  }
  if (status === "intact") {
    return kleur.green(value);
  }
  if (status === "copied") {
    return kleur.cyan(value);
  }
  if (status === "degraded") {
    return kleur.yellow(value);
  }
  return kleur.red(value);
}

function renderGroupedList(
  manifestName: string,
  rows: RowMeta[],
  derivedReviewExports: DerivedReviewExportMeta[],
  listDisplay: CxListDisplayConfig,
  useColor: boolean,
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
    "time".length,
    ...rows.map((row) => row.mtimeRelative.length),
  );
  const statusWidth = Math.max(
    "status".length,
    ...rows.map((row) => row.status.length),
  );

  const orderedSections = [...groups.keys()].sort((left, right) => {
    if (left === "assets") {
      return 1;
    }
    if (right === "assets") {
      return -1;
    }
    return left.localeCompare(right, "en");
  });

  const lines = [
    useColor
      ? `manifest: ${kleur.bold().white(manifestName)}`
      : `manifest: ${manifestName}`,
  ];
  for (const sectionName of orderedSections) {
    const sectionRows = (groups.get(sectionName) ?? []).toSorted(
      (left, right) => compareDeterministicText(left.path, right.path),
    );
    lines.push("");
    lines.push(useColor ? kleur.bold().cyan(sectionName) : sectionName);
    lines.push(
      [
        "  ",
        useColor
          ? kleur.gray("bytes".padStart(bytesWidth))
          : "bytes".padStart(bytesWidth),
        "  ",
        useColor
          ? kleur.gray("tokens".padStart(tokensWidth))
          : "tokens".padStart(tokensWidth),
        "  ",
        useColor
          ? kleur.gray("time".padEnd(mtimeWidth))
          : "time".padEnd(mtimeWidth),
        "  ",
        useColor
          ? kleur.gray("status".padEnd(statusWidth))
          : "status".padEnd(statusWidth),
        "  ",
        useColor
          ? kleur.gray("path".padEnd(pathWidth))
          : "path".padEnd(pathWidth),
      ].join(""),
    );

    for (const row of sectionRows) {
      const bytesRaw = formatBytes(row.bytes).padStart(bytesWidth);
      const tokensRaw = `${formatNumber(row.tokens)} tok`.padStart(tokensWidth);
      const mtimeRaw = row.mtimeRelative.padEnd(mtimeWidth);
      const statusRaw = row.status.padEnd(statusWidth);
      const pathCell = useColor
        ? kleur.white(row.path.padEnd(pathWidth))
        : row.path.padEnd(pathWidth);
      const provenanceSuffix = formatProvenanceSuffix(row.provenance, useColor);
      lines.push(
        [
          "  ",
          colorBytes(row.bytes, bytesRaw, listDisplay, useColor),
          "  ",
          colorTokens(row.tokens, tokensRaw, listDisplay, useColor),
          "  ",
          colorTime(row.mtime, mtimeRaw, listDisplay, useColor),
          "  ",
          colorExtractability(row.status, statusRaw, useColor),
          "  ",
          `${pathCell}${provenanceSuffix}`,
        ].join(""),
      );
    }
  }

  if (derivedReviewExports.length > 0) {
    const pathWidth = Math.max(
      "stored_path".length,
      ...derivedReviewExports.map((artifact) => artifact.storedPath.length),
    );
    const pagesWidth = Math.max(
      "pages".length,
      ...derivedReviewExports.map(
        (artifact) => formatNumber(artifact.pageCount).length,
      ),
    );
    const bytesWidth = Math.max(
      "bytes".length,
      ...derivedReviewExports.map(
        (artifact) => formatBytes(artifact.sizeBytes).length,
      ),
    );
    const statusWidth = Math.max(
      "status".length,
      ...derivedReviewExports.map((artifact) => artifact.status.length),
    );

    lines.push("");
    lines.push(
      useColor
        ? kleur.bold().cyan("derived_review_exports")
        : "derived_review_exports",
    );
    lines.push(
      [
        "  ",
        useColor
          ? kleur.gray("pages".padStart(pagesWidth))
          : "pages".padStart(pagesWidth),
        "  ",
        useColor
          ? kleur.gray("bytes".padStart(bytesWidth))
          : "bytes".padStart(bytesWidth),
        "  ",
        useColor
          ? kleur.gray("status".padEnd(statusWidth))
          : "status".padEnd(statusWidth),
        "  ",
        useColor
          ? kleur.gray("stored_path".padEnd(pathWidth))
          : "stored_path".padEnd(pathWidth),
      ].join(""),
    );

    for (const artifact of derivedReviewExports.toSorted((left, right) =>
      compareDeterministicText(left.storedPath, right.storedPath),
    )) {
      const pagesRaw = formatNumber(artifact.pageCount).padStart(pagesWidth);
      const bytesRaw = formatBytes(artifact.sizeBytes).padStart(bytesWidth);
      const statusRaw = artifact.status.padEnd(statusWidth);
      const pathCell = useColor
        ? kleur.white(artifact.storedPath.padEnd(pathWidth))
        : artifact.storedPath.padEnd(pathWidth);
      const suffix = ` [${artifact.assemblyName}, ${artifact.trustClassification}]`;
      lines.push(
        [
          "  ",
          pagesRaw,
          "  ",
          colorBytes(artifact.sizeBytes, bytesRaw, listDisplay, useColor),
          "  ",
          colorExtractability(artifact.status, statusRaw, useColor),
          "  ",
          `${pathCell}${useColor ? kleur.gray(suffix) : suffix}`,
        ].join(""),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function runListCommand(
  args: ListArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const useColor = io.stdin.isTTY === true;
  const bundleDir = path.resolve(io.cwd, args.bundleDir);
  const { manifest, manifestName } = await loadManifestFromBundle(bundleDir);
  const userConfig = await loadCxUserConfig();
  const rows = args.derivedReviewExportsOnly
    ? []
    : selectManifestRows(manifest.files, {
        sections: args.sections,
        files: args.files,
      });
  const sections = selectManifestSections(manifest, rows);
  const assets = selectManifestAssets(manifest, rows);
  const extractability = await resolveExtractability({
    bundleDir,
    manifest,
    rows,
  });
  const derivedReviewExports = (
    await resolveDerivedReviewExportIntegrity({ bundleDir, manifest })
  ).map(({ artifact, integrity, diagnostics }) => ({
    assemblyName: artifact.assemblyName,
    title: artifact.title,
    moduleName: artifact.moduleName,
    storedPath: artifact.storedPath,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    pageCount: artifact.pageCount,
    rootLevel: artifact.rootLevel,
    sourcePaths: artifact.sourcePaths,
    trustClassification: artifact.trustClassification,
    status: integrity.status,
    extractability: { ...integrity },
    diagnostics,
  }));

  const rowsWithMeta: RowMeta[] = rows.map((file) => {
    const mtime = file.mtime;
    const record = extractability.recordsByPath.get(file.path);
    const extractabilityObj: RowMeta["extractability"] = {
      status: record?.status ?? "blocked",
      reason: record?.reason ?? "section_parse_failed",
      message:
        record?.message ??
        `No extractability record was produced for ${file.path}.`,
    };
    if (record?.expectedSha256) {
      extractabilityObj.expectedSha256 = record.expectedSha256;
    }
    if (record?.actualSha256) {
      extractabilityObj.actualSha256 = record.actualSha256;
    }
    return {
      path: file.path,
      section: file.section === "-" ? "assets" : file.section,
      bytes: file.sizeBytes,
      tokens: getTokensForRow(file),
      mtime,
      mtimeRelative: formatRelativeTime(mtime),
      status: record?.status ?? "blocked",
      provenance: file.provenance ?? [],
      extractability: extractabilityObj,
    };
  });

  if (args.json) {
    writeValidatedJson(
      ListCommandJsonSchema,
      {
        summary: summarizeManifest(manifestName, manifest, rows),
        settings: manifest.settings,
        display: userConfig.display,
        selection: {
          sections: args.sections ?? [],
          files: args.files ?? [],
          derivedReviewExportsOnly: args.derivedReviewExportsOnly ?? false,
        },
        sections,
        assets,
        derivedReviewExports,
        files: rowsWithMeta,
      },
      io,
    );
    return 0;
  }

  writeStdout(
    renderGroupedList(
      manifestName,
      rowsWithMeta,
      derivedReviewExports,
      userConfig.display.list,
      useColor,
    ),
    io,
  );
  return 0;
}
