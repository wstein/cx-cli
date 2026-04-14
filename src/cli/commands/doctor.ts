import fs from "node:fs/promises";
import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import {
  analyzeSectionOverlaps,
  buildMasterList,
  type OverlapConflict,
} from "../../planning/overlaps.js";
import { CxError } from "../../shared/errors.js";
import { writeJson } from "../../shared/output.js";
import {
  printWizardComplete,
  printWizardHeader,
  printWizardTip,
  wizardSelect,
} from "../../shared/wizard.js";
import { getVCSState } from "../../vcs/provider.js";
import { collectDoctorMcpReport, printDoctorMcpReport } from "./doctor-mcp.js";
import {
  collectDoctorSecretsReport,
  printDoctorSecretsReport,
} from "./doctor-secrets.js";

export interface DoctorArgs {
  config?: string | undefined;
  subcommand?: "overlaps" | "fix-overlaps" | "mcp" | "secrets" | "workflow";
  all?: boolean | undefined;
  json?: boolean | undefined;
  dryRun?: boolean | undefined;
  interactive?: boolean | undefined;
  task?: string | undefined;
}

interface OverlapOwnership {
  path: string;
  owner: string;
}

interface OverlapFixPlan {
  conflicts: OverlapConflict[];
  ownership: OverlapOwnership[];
  excludesBySection: Record<string, string[]>;
}

interface WorkflowRecommendation {
  mode: "bundle" | "inspect" | "mcp";
  reason: string;
  signals: string[];
}

export async function runDoctorCommand(args: DoctorArgs): Promise<number> {
  if (args.all === true && args.json === true) {
    throw new CxError(
      "doctor --all does not support --json. Run individual diagnostics with --json instead.",
      2,
    );
  }

  if (args.all === true) {
    return runDoctorAll(args);
  }

  if (!args.subcommand) {
    throw new CxError(
      "doctor requires a subcommand unless --all is provided.",
      2,
    );
  }

  switch (args.subcommand) {
    case "overlaps":
      return runDoctorOverlaps(args);
    case "fix-overlaps":
      return runDoctorFixOverlaps(args);
    case "mcp":
      return runDoctorMcp(args);
    case "secrets":
      return runDoctorSecrets(args);
    case "workflow":
      return runDoctorWorkflow(args);
    default:
      throw new CxError(`Unknown doctor subcommand: ${args.subcommand}`, 2);
  }
}

async function runDoctorAll(args: DoctorArgs): Promise<number> {
  const overlapExitCode = await runDoctorOverlaps(args);
  if (overlapExitCode !== 0) {
    return overlapExitCode;
  }

  const mcpExitCode = await runDoctorMcp(args);
  if (mcpExitCode !== 0) {
    return mcpExitCode;
  }

  return await runDoctorSecrets(args);
}

async function runDoctorOverlaps(args: DoctorArgs): Promise<number> {
  const configPath = path.resolve(args.config ?? "cx.toml");
  const config = await loadCxConfig(configPath);
  const vcsState = await getVCSState(config.sourceRoot);
  const masterList = await buildMasterList(config, vcsState);
  const conflicts = await analyzeSectionOverlaps(config, masterList);

  if (args.json ?? false) {
    writeJson({
      configPath,
      conflictCount: conflicts.length,
      conflicts,
    });
  } else if (conflicts.length === 0) {
    process.stdout.write(`No section overlaps detected in ${configPath}.\n`);
  } else {
    process.stdout.write(
      `Detected ${conflicts.length} section overlap${conflicts.length === 1 ? "" : "s"} in ${configPath}.\n\n`,
    );
    for (const conflict of conflicts) {
      process.stdout.write(`${formatConflictSummary(conflict)}\n\n`);
    }
    process.stdout.write(
      "Run `cx doctor fix-overlaps --dry-run` to review the proposed exclude updates.\n",
    );
  }

  return conflicts.length === 0 ? 0 : 4;
}

async function runDoctorFixOverlaps(args: DoctorArgs): Promise<number> {
  const configPath = path.resolve(args.config ?? "cx.toml");
  const config = await loadCxConfig(configPath);
  const vcsState = await getVCSState(config.sourceRoot);
  const masterList = await buildMasterList(config, vcsState);
  const conflicts = await analyzeSectionOverlaps(config, masterList);

  if (conflicts.length === 0) {
    if (args.json ?? false) {
      writeJson({
        configPath,
        changed: false,
        conflictCount: 0,
        excludesBySection: {},
      });
    } else {
      process.stdout.write(`No section overlaps detected in ${configPath}.\n`);
    }
    return 0;
  }

  const ownership = await resolveOwnership(
    conflicts,
    Boolean(args.interactive),
  );
  const fixPlan = buildFixPlan(conflicts, ownership);

  if (args.json ?? false) {
    writeJson({
      configPath,
      changed: !(args.dryRun ?? false),
      dryRun: Boolean(args.dryRun),
      conflictCount: fixPlan.conflicts.length,
      ownership: fixPlan.ownership,
      excludesBySection: fixPlan.excludesBySection,
    });
  } else {
    process.stdout.write(
      `Prepared overlap fixes for ${fixPlan.conflicts.length} conflict${fixPlan.conflicts.length === 1 ? "" : "s"} in ${configPath}.\n\n`,
    );
    for (const conflict of fixPlan.conflicts) {
      const owner = ownership.get(conflict.path);
      process.stdout.write(`${formatConflictSummary(conflict, owner)}\n\n`);
    }
    process.stdout.write(`${formatFixPlan(fixPlan)}\n`);
  }

  if (args.dryRun ?? false) {
    return 4;
  }

  const source = await fs.readFile(configPath, "utf8");
  const updated = applyExcludeFixesToToml(source, fixPlan.excludesBySection);
  await fs.writeFile(configPath, updated, "utf8");

  if (!(args.json ?? false)) {
    process.stdout.write(`Updated ${configPath}.\n`);
  }

  return 0;
}

async function runDoctorMcp(args: DoctorArgs): Promise<number> {
  const report = await collectDoctorMcpReport({
    config: args.config,
    json: args.json,
  });
  printDoctorMcpReport(report, args.json ?? false);
  return 0;
}

async function runDoctorSecrets(args: DoctorArgs): Promise<number> {
  const report = await collectDoctorSecretsReport({
    config: args.config,
    json: args.json,
  });
  printDoctorSecretsReport(report, args.json ?? false);
  return report.suspiciousCount === 0 ? 0 : 4;
}

async function runDoctorWorkflow(args: DoctorArgs): Promise<number> {
  const task = args.task?.trim();
  if (!task) {
    throw new CxError("doctor workflow requires --task.", 2);
  }

  const recommendation = recommendWorkflow(task);

  if (args.json ?? false) {
    writeJson({
      task,
      ...recommendation,
    });
  } else {
    process.stdout.write(`Task: ${task}\n`);
    process.stdout.write(
      `Recommended mode: cx ${recommendation.mode}\n`,
    );
    process.stdout.write(`Reason: ${recommendation.reason}\n`);
    process.stdout.write(
      `Signals: ${recommendation.signals.length > 0 ? recommendation.signals.join(", ") : "none"}\n`,
    );
  }

  return 0;
}

function recommendWorkflow(task: string): WorkflowRecommendation {
  const normalized = task.toLowerCase();
  const signals: string[] = [];

  const recordSignals = (
    candidates: Array<[string, boolean]>,
  ): boolean => {
    let matched = false;
    for (const [label, hit] of candidates) {
      if (hit) {
        signals.push(label);
        matched = true;
      }
    }
    return matched;
  };

  const bundleMatch = recordSignals([
    ["bundle", /\b(bundle|snapshot|verify|checksum|manifest|handoff|ci)\b/.test(normalized)],
    ["immutable review", /\b(review|approve|release|audit)\b/.test(normalized)],
  ]);
  if (bundleMatch) {
    return {
      mode: "bundle",
      reason:
        "The task is about a verified snapshot, review, or handoff, so a static bundle is the safest boundary.",
      signals,
    };
  }

  const inspectMatch = recordSignals([
    ["inspect", /\b(inspect|preview|plan|token budget|token breakdown)\b/.test(normalized)],
    ["compare", /\b(compare|diff|drift)\b/.test(normalized)],
  ]);
  if (inspectMatch) {
    return {
      mode: "inspect",
      reason:
        "The task needs planning or comparison before writing, so cx inspect is the right middle step.",
      signals,
    };
  }

  recordSignals([
    ["mcp", /\b(mcp|explore|search|read|update|note|notes|agent|investigate)\b/.test(normalized)],
  ]);
  return {
    mode: "mcp",
    reason:
      "The task is interactive or exploratory, so a live MCP workspace is the best fit.",
    signals,
  };
}

async function resolveOwnership(
  conflicts: OverlapConflict[],
  interactive: boolean,
): Promise<Map<string, string>> {
  const ownership = new Map<string, string>();

  if (!interactive) {
    for (const conflict of conflicts) {
      ownership.set(conflict.path, conflict.recommendedOwner);
    }
    return ownership;
  }

  printWizardHeader("Overlap Resolution");
  printWizardTip(
    "Choose which section should keep each file. cx will exclude it from the others.",
  );

  for (const conflict of conflicts) {
    const owner = await wizardSelect(
      `Which section should own ${conflict.path}?`,
      conflict.sections.map((section) => ({
        name:
          section === conflict.recommendedOwner
            ? `${section} (recommended)`
            : section,
        value: section,
      })),
      {
        description: `Matching sections: ${conflict.sections.join(", ")}`,
        default: conflict.recommendedOwner,
      },
    );
    ownership.set(conflict.path, owner);
  }

  printWizardComplete("Overlap resolution");
  return ownership;
}

function buildFixPlan(
  conflicts: OverlapConflict[],
  ownership: Map<string, string>,
): OverlapFixPlan {
  const excludes = new Map<string, Set<string>>();

  for (const conflict of conflicts) {
    const owner = ownership.get(conflict.path) ?? conflict.recommendedOwner;
    for (const section of conflict.sections) {
      if (section === owner) {
        continue;
      }
      const sectionExcludes = excludes.get(section) ?? new Set<string>();
      sectionExcludes.add(conflict.path);
      excludes.set(section, sectionExcludes);
    }
  }

  return {
    conflicts,
    ownership: conflicts.map((conflict) => ({
      path: conflict.path,
      owner: ownership.get(conflict.path) ?? conflict.recommendedOwner,
    })),
    excludesBySection: Object.fromEntries(
      [...excludes.entries()]
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([section, patterns]) => [
          section,
          [...patterns].sort((left, right) => left.localeCompare(right, "en")),
        ]),
    ),
  };
}

function formatConflictSummary(
  conflict: OverlapConflict,
  owner = conflict.recommendedOwner,
): string {
  const lines = [
    `${conflict.path}`,
    `  matching sections: ${conflict.sections.join(", ")}`,
    `  owner: ${owner}`,
  ];

  const affectedSections = conflict.sections.filter(
    (section) => section !== owner,
  );
  if (affectedSections.length > 0) {
    lines.push(`  exclude from: ${affectedSections.join(", ")}`);
  }

  return lines.join("\n");
}

function formatFixPlan(plan: OverlapFixPlan): string {
  const entries = Object.entries(plan.excludesBySection);
  if (entries.length === 0) {
    return "No exclude updates are required.";
  }

  return entries
    .map(
      ([section, patterns]) =>
        `[sections.${section}]\nexclude = ${formatTomlStringArray(patterns)}`,
    )
    .join("\n\n");
}

function applyExcludeFixesToToml(
  source: string,
  excludesBySection: Record<string, string[]>,
): string {
  let lines = source.split("\n");

  for (const [section, patterns] of Object.entries(excludesBySection)) {
    const ranges = findSectionRanges(lines);
    const range = ranges.get(section);
    if (!range) {
      throw new CxError(
        `Could not update cx.toml: missing [sections.${section}] table.`,
        2,
      );
    }

    const existing = parseExistingExcludePatterns(lines, range);
    const merged = [...new Set([...existing, ...patterns])].sort(
      (left, right) => left.localeCompare(right, "en"),
    );
    lines = upsertSectionArray(lines, range, "exclude", merged, "include");
  }

  return `${lines.join("\n").replace(/\s+$/u, "")}\n`;
}

function findSectionRanges(
  lines: string[],
): Map<string, { start: number; endExclusive: number }> {
  const ranges = new Map<string, { start: number; endExclusive: number }>();
  const headerPattern = /^\s*\[sections\.(?:"([^"]+)"|([A-Za-z0-9_-]+))\]\s*$/u;

  let currentSection: string | undefined;
  let currentStart = -1;

  for (const [index, line] of lines.entries()) {
    const match = line.match(headerPattern);
    if (match) {
      if (currentSection) {
        ranges.set(currentSection, {
          start: currentStart,
          endExclusive: index,
        });
      }
      currentSection = match[1] ?? match[2];
      currentStart = index;
      continue;
    }

    if (currentSection && /^\s*\[/.test(line)) {
      ranges.set(currentSection, {
        start: currentStart,
        endExclusive: index,
      });
      currentSection = undefined;
      currentStart = -1;
    }
  }

  if (currentSection) {
    ranges.set(currentSection, {
      start: currentStart,
      endExclusive: lines.length,
    });
  }

  return ranges;
}

function parseExistingExcludePatterns(
  lines: string[],
  range: { start: number; endExclusive: number },
): string[] {
  const value = readSectionArray(lines, range, "exclude");
  return value ?? [];
}

function readSectionArray(
  lines: string[],
  range: { start: number; endExclusive: number },
  key: string,
): string[] | undefined {
  const entry = findArrayAssignment(lines, range, key);
  if (!entry) {
    return undefined;
  }

  const source = lines.slice(entry.start, entry.endInclusive + 1).join("\n");
  const normalized = source.replace(/^\s*[A-Za-z0-9_-]+\s*=\s*/u, "").trim();
  const value = normalized
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ");

  if (!value.startsWith("[") || !value.endsWith("]")) {
    throw new CxError(`Expected ${key} to be a TOML array in cx.toml.`, 2);
  }

  try {
    return JSON.parse(value) as string[];
  } catch (error) {
    throw new CxError(
      `Could not parse ${key} array from cx.toml: ${
        error instanceof Error ? error.message : String(error)
      }`,
      2,
    );
  }
}

function upsertSectionArray(
  lines: string[],
  range: { start: number; endExclusive: number },
  key: string,
  values: string[],
  anchorKey: string,
): string[] {
  const assignment = `${key} = ${formatTomlStringArray(values)}`;
  const existing = findArrayAssignment(lines, range, key);

  if (existing) {
    return [
      ...lines.slice(0, existing.start),
      assignment,
      ...lines.slice(existing.endInclusive + 1),
    ];
  }

  const insertIndex = findSectionInsertIndex(lines, range, anchorKey);
  return [
    ...lines.slice(0, insertIndex),
    assignment,
    ...lines.slice(insertIndex),
  ];
}

function findSectionInsertIndex(
  lines: string[],
  range: { start: number; endExclusive: number },
  anchorKey: string,
): number {
  const anchor = findArrayAssignment(lines, range, anchorKey);
  if (anchor) {
    return anchor.endInclusive + 1;
  }

  return range.start + 1;
}

function findArrayAssignment(
  lines: string[],
  range: { start: number; endExclusive: number },
  key: string,
): { start: number; endInclusive: number } | undefined {
  const keyPattern = new RegExp(`^\\s*${key}\\s*=`, "u");

  for (let index = range.start + 1; index < range.endExclusive; index += 1) {
    if (!keyPattern.test(lines[index] ?? "")) {
      continue;
    }

    let depth = 0;
    let started = false;
    for (let cursor = index; cursor < range.endExclusive; cursor += 1) {
      const line = lines[cursor] ?? "";
      for (const character of line) {
        if (character === "[") {
          depth += 1;
          started = true;
        } else if (character === "]") {
          depth -= 1;
        }
      }

      if (started && depth <= 0) {
        return { start: index, endInclusive: cursor };
      }
    }

    return { start: index, endInclusive: index };
  }

  return undefined;
}

function formatTomlStringArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}
