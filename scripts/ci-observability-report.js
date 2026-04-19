import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CI_OBSERVABILITY_SCHEMA_VERSION = 1;
export const DEFAULT_FAST_LANE_STATE_PATH = ".ci/fast-lane-monitor-state.json";
export const DEFAULT_VERIFY_AGAINST_REPORT_PATH =
  ".ci/verify-against-policy-report.json";
export const DEFAULT_OBSERVABILITY_JSON_PATH = ".ci/observability-summary.json";
export const DEFAULT_OBSERVABILITY_MD_PATH = ".ci/observability-summary.md";

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return undefined;
    }
    throw error;
  }
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

export function classifyFastLaneTrend(samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return "insufficient-data";
  }

  const recent = samples.slice(-5);
  const first = recent[0]?.durationMs;
  const last = recent.at(-1)?.durationMs;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
    return "insufficient-data";
  }

  const ratio = last / first;
  if (ratio >= 1.1) {
    return "regressing";
  }
  if (ratio <= 0.9) {
    return "improving";
  }
  return "stable";
}

function buildFastLaneSection(fastLaneState) {
  if (!fastLaneState || !Array.isArray(fastLaneState.samples)) {
    return {
      available: false,
    };
  }

  const recentSamples = fastLaneState.samples.slice(-5).map((sample) => ({
    timestamp: sample.timestamp,
    durationMs: sample.durationMs,
    durationText: formatMs(sample.durationMs),
    warning: sample.warning === true,
    failureSignal: sample.failureSignal === true,
  }));

  return {
    available: true,
    lastDurationMs: fastLaneState.lastDurationMs,
    lastDurationText: Number.isFinite(fastLaneState.lastDurationMs)
      ? formatMs(fastLaneState.lastDurationMs)
      : "n/a",
    failureStreak:
      typeof fastLaneState.failureStreak === "number"
        ? fastLaneState.failureStreak
        : 0,
    sampleCount: fastLaneState.samples.length,
    trend: classifyFastLaneTrend(fastLaneState.samples),
    warningSampleCount: fastLaneState.samples.filter(
      (sample) => sample.warning === true,
    ).length,
    failureSignalCount: fastLaneState.samples.filter(
      (sample) => sample.failureSignal === true,
    ).length,
    recentSamples,
  };
}

function buildVerifyAgainstSection(verifyAgainstReport) {
  if (!verifyAgainstReport || typeof verifyAgainstReport !== "object") {
    return {
      available: false,
    };
  }

  return {
    available: true,
    ok: verifyAgainstReport.ok === true,
    againstDirTestCount:
      verifyAgainstReport.summary?.againstDirTestCount ?? 0,
    missingJustificationCount:
      verifyAgainstReport.summary?.missingJustificationCount ?? 0,
  };
}

export function buildCiObservabilityReport({
  fastLaneState,
  verifyAgainstReport,
  nowIso = new Date().toISOString(),
}) {
  return {
    schemaVersion: CI_OBSERVABILITY_SCHEMA_VERSION,
    generatedAt: nowIso,
    fastLane: buildFastLaneSection(fastLaneState),
    verifyAgainst: buildVerifyAgainstSection(verifyAgainstReport),
  };
}

export function renderCiObservabilityMarkdown(report) {
  const lines = [
    "# CI Observability Dashboard",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
  ];

  lines.push("## Fast Lane Trend");
  if (report.fastLane.available !== true) {
    lines.push("- No fast-lane timing state was available in this job.");
  } else {
    lines.push(`- Last duration: ${report.fastLane.lastDurationText}`);
    lines.push(`- Failure streak: ${report.fastLane.failureStreak}`);
    lines.push(`- Samples tracked: ${report.fastLane.sampleCount}`);
    lines.push(`- Trend: ${report.fastLane.trend}`);
    lines.push(`- Warning samples: ${report.fastLane.warningSampleCount}`);
    lines.push(`- Failure signals: ${report.fastLane.failureSignalCount}`);
    if (report.fastLane.recentSamples.length > 0) {
      lines.push("");
      lines.push("| Timestamp | Duration | Signal |");
      lines.push("| --- | --- | --- |");
      for (const sample of report.fastLane.recentSamples) {
        const signal = sample.failureSignal
          ? "failure-signal"
          : sample.warning
            ? "warning"
            : "ok";
        lines.push(
          `| ${sample.timestamp} | ${sample.durationText} | ${signal} |`,
        );
      }
    }
  }

  lines.push("");
  lines.push("## Verify Against Policy");
  if (report.verifyAgainst.available !== true) {
    lines.push("- No verify-against policy report was available in this job.");
  } else {
    lines.push(`- Status: ${report.verifyAgainst.ok ? "ok" : "attention"}`);
    lines.push(
      `- Against-dir tests: ${report.verifyAgainst.againstDirTestCount}`,
    );
    lines.push(
      `- Missing justifications: ${report.verifyAgainst.missingJustificationCount}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function generateCiObservabilityReport({
  rootDir = process.cwd(),
  nowIso = new Date().toISOString(),
}) {
  const fastLaneState = await readOptionalJson(
    path.join(rootDir, DEFAULT_FAST_LANE_STATE_PATH),
  );
  const verifyAgainstReport = await readOptionalJson(
    path.join(rootDir, DEFAULT_VERIFY_AGAINST_REPORT_PATH),
  );

  return buildCiObservabilityReport({
    fastLaneState,
    verifyAgainstReport,
    nowIso,
  });
}

async function writeOutput(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function parseCliArgs(args) {
  const parsed = {
    rootDir: process.cwd(),
    outputJson: DEFAULT_OBSERVABILITY_JSON_PATH,
    outputMd: DEFAULT_OBSERVABILITY_MD_PATH,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root-dir requires a path value.");
      }
      parsed.rootDir = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--output-json") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-json requires a file path.");
      }
      parsed.outputJson = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--output-md") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-md requires a file path.");
      }
      parsed.outputMd = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--help") {
      return { ...parsed, help: true };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function helpText() {
  return [
    "Usage: node scripts/ci-observability-report.js [options]",
    "",
    "Options:",
    "  --root-dir <path>       Project root to scan (default: current working directory)",
    "  --output-json <path>    JSON output path (default: .ci/observability-summary.json)",
    "  --output-md <path>      Markdown output path (default: .ci/observability-summary.md)",
    "  --help                  Show this help message",
  ].join("\n");
}

function defaultCliIo() {
  return {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  };
}

export async function runCiObservabilityReportCli(
  args = process.argv.slice(2),
  io = defaultCliIo(),
) {
  try {
    const options = parseCliArgs(args);
    if (options.help === true) {
      io.stdout(`${helpText()}\n`);
      return 0;
    }

    const report = await generateCiObservabilityReport({
      rootDir: options.rootDir,
    });
    const markdown = renderCiObservabilityMarkdown(report);
    const outputJsonPath = path.isAbsolute(options.outputJson)
      ? options.outputJson
      : path.join(options.rootDir, options.outputJson);
    const outputMdPath = path.isAbsolute(options.outputMd)
      ? options.outputMd
      : path.join(options.rootDir, options.outputMd);

    await writeOutput(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeOutput(outputMdPath, markdown);
    io.stdout(markdown);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`ci-observability-report: ${message}\n`);
    return 1;
  }
}

const invokedDirectly = (() => {
  const invokedPath = process.argv[1];
  if (!invokedPath) {
    return false;
  }
  return path.resolve(invokedPath) === path.resolve(fileURLToPath(import.meta.url));
})();

if (invokedDirectly) {
  process.exitCode = await runCiObservabilityReportCli();
}
