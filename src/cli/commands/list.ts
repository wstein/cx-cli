import path from "node:path";

import kleur from "kleur";
import { loadManifestFromBundle } from "../../bundle/validate.js";
import type { CxListDisplayConfig } from "../../config/types.js";
import { loadCxUserConfig } from "../../config/user.js";
import { resolveExtractability } from "../../extract/resolution.js";
import type { ManifestFileRow } from "../../manifest/types.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
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

function formatProvenanceSuffix(provenance: string[]): string {
  if (provenance.length === 0) {
    return "";
  }

  return kleur.gray(` [${provenance.join(", ")}]`);
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
  listDisplay: CxListDisplayConfig,
): string {
  if (bytes <= listDisplay.bytesWarm) {
    return colorByTemperature(value, "cool");
  }
  if (bytes <= listDisplay.bytesHot) {
    return colorByTemperature(value, "warm");
  }
  return colorByTemperature(value, "hot");
}

function colorTokens(
  tokens: number,
  value: string,
  listDisplay: CxListDisplayConfig,
): string {
  if (tokens <= listDisplay.tokensWarm) {
    return colorByTemperature(value, "cool");
  }
  if (tokens <= listDisplay.tokensHot) {
    return colorByTemperature(value, "warm");
  }
  return colorByTemperature(value, "hot");
}

function ansi256(value: string, code: number): string {
  return `\u001B[38;5;${code}m${value}\u001B[39m`;
}

function colorTime(
  iso: string,
  value: string,
  listDisplay: CxListDisplayConfig,
): string {
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
): string {
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
  listDisplay: CxListDisplayConfig,
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

  const lines = [`manifest: ${kleur.bold().white(manifestName)}`];
  for (const sectionName of orderedSections) {
    const sectionRows = groups.get(sectionName) ?? [];
    lines.push("");
    lines.push(kleur.bold().cyan(sectionName));
    lines.push(
      [
        "  ",
        kleur.gray("bytes".padStart(bytesWidth)),
        "  ",
        kleur.gray("tokens".padStart(tokensWidth)),
        "  ",
        kleur.gray("time".padEnd(mtimeWidth)),
        "  ",
        kleur.gray("status".padEnd(statusWidth)),
        "  ",
        kleur.gray("path".padEnd(pathWidth)),
      ].join(""),
    );

    for (const row of sectionRows) {
      const pathCell = kleur.white(row.path.padEnd(pathWidth));
      const bytesRaw = formatBytes(row.bytes).padStart(bytesWidth);
      const tokensRaw = `${formatNumber(row.tokens)} tok`.padStart(tokensWidth);
      const mtimeRaw = row.mtimeRelative.padEnd(mtimeWidth);
      const statusRaw = row.status.padEnd(statusWidth);
      const provenanceSuffix = formatProvenanceSuffix(row.provenance);
      lines.push(
        [
          "  ",
          colorBytes(row.bytes, bytesRaw, listDisplay),
          "  ",
          colorTokens(row.tokens, tokensRaw, listDisplay),
          "  ",
          colorTime(row.mtime, mtimeRaw, listDisplay),
          "  ",
          colorExtractability(row.status, statusRaw),
          "  ",
          `${pathCell}${provenanceSuffix}`,
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
  const bundleDir = path.resolve(io.cwd, args.bundleDir);
  const { manifest, manifestName } = await loadManifestFromBundle(bundleDir);
  const userConfig = await loadCxUserConfig();
  const rows = selectManifestRows(manifest.files, {
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
        repomix: await getRepomixCapabilities(),
        settings: manifest.settings,
        display: userConfig.display,
        selection: {
          sections: args.sections ?? [],
          files: args.files ?? [],
        },
        sections,
        assets,
        files: rowsWithMeta,
      },
      io,
    );
    return 0;
  }

  writeStdout(
    renderGroupedList(manifestName, rowsWithMeta, userConfig.display.list),
    io,
  );
  return 0;
}
