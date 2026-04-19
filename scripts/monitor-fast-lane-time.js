import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_FAST_LANE_MONITOR_CONFIG = {
  baselineMs: 20_000,
  warnRatio: 1.25,
  failRatio: 1.75,
  failAbsoluteDeltaMs: 30_000,
  requiredConsecutiveFailures: 2,
};

function parsePositiveInt(raw, name) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return parsed;
}

function parsePositiveFloat(raw, name) {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number, got "${raw}".`);
  }
  return parsed;
}

function resolveConfig(env) {
  return {
    baselineMs:
      env.FAST_LANE_BASELINE_MS !== undefined
        ? parsePositiveInt(env.FAST_LANE_BASELINE_MS, "FAST_LANE_BASELINE_MS")
        : DEFAULT_FAST_LANE_MONITOR_CONFIG.baselineMs,
    warnRatio:
      env.FAST_LANE_WARN_RATIO !== undefined
        ? parsePositiveFloat(env.FAST_LANE_WARN_RATIO, "FAST_LANE_WARN_RATIO")
        : DEFAULT_FAST_LANE_MONITOR_CONFIG.warnRatio,
    failRatio:
      env.FAST_LANE_FAIL_RATIO !== undefined
        ? parsePositiveFloat(env.FAST_LANE_FAIL_RATIO, "FAST_LANE_FAIL_RATIO")
        : DEFAULT_FAST_LANE_MONITOR_CONFIG.failRatio,
    failAbsoluteDeltaMs:
      env.FAST_LANE_FAIL_ABSOLUTE_DELTA_MS !== undefined
        ? parsePositiveInt(
            env.FAST_LANE_FAIL_ABSOLUTE_DELTA_MS,
            "FAST_LANE_FAIL_ABSOLUTE_DELTA_MS",
          )
        : DEFAULT_FAST_LANE_MONITOR_CONFIG.failAbsoluteDeltaMs,
    requiredConsecutiveFailures:
      env.FAST_LANE_REQUIRED_CONSECUTIVE_FAILURES !== undefined
        ? parsePositiveInt(
            env.FAST_LANE_REQUIRED_CONSECUTIVE_FAILURES,
            "FAST_LANE_REQUIRED_CONSECUTIVE_FAILURES",
          )
        : DEFAULT_FAST_LANE_MONITOR_CONFIG.requiredConsecutiveFailures,
  };
}

function resolveStateFilePath(env) {
  return path.resolve(
    env.FAST_LANE_MONITOR_STATE_FILE ?? ".ci/fast-lane-monitor-state.json",
  );
}

async function readState(stateFilePath) {
  try {
    const raw = await fs.readFile(stateFilePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      failureStreak: 0,
      samples: [],
    };
  }
}

async function writeState(stateFilePath, state) {
  await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
  await fs.writeFile(stateFilePath, `${JSON.stringify(state, null, 2)}\n`);
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

export async function monitorFastLaneDuration({
  durationMs,
  env = process.env,
  nowIso = new Date().toISOString(),
}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(
      `durationMs must be a positive number, got "${String(durationMs)}".`,
    );
  }

  const config = resolveConfig(env);
  const stateFilePath = resolveStateFilePath(env);
  const state = await readState(stateFilePath);

  const warnThresholdMs = Math.round(config.baselineMs * config.warnRatio);
  const failRatioThresholdMs = Math.round(config.baselineMs * config.failRatio);
  const failAbsoluteThresholdMs =
    config.baselineMs + config.failAbsoluteDeltaMs;
  const failThresholdMs = Math.max(failRatioThresholdMs, failAbsoluteThresholdMs);

  const isWarning = durationMs >= warnThresholdMs;
  const isFailureSignal = durationMs >= failThresholdMs;
  const nextFailureStreak = isFailureSignal
    ? (state.failureStreak ?? 0) + 1
    : 0;
  const shouldFail =
    nextFailureStreak >= config.requiredConsecutiveFailures &&
    isFailureSignal;

  const nextState = {
    failureStreak: nextFailureStreak,
    lastDurationMs: durationMs,
    lastUpdatedAt: nowIso,
    samples: [
      ...(Array.isArray(state.samples) ? state.samples : []),
      {
        timestamp: nowIso,
        durationMs,
        warning: isWarning,
        failureSignal: isFailureSignal,
      },
    ].slice(-20),
  };
  await writeState(stateFilePath, nextState);

  const summary = [
    `fast-lane monitor: duration=${formatMs(durationMs)}`,
    `baseline=${formatMs(config.baselineMs)}`,
    `warn>=${formatMs(warnThresholdMs)}`,
    `fail-signal>=${formatMs(failThresholdMs)}`,
    `streak=${nextFailureStreak}/${config.requiredConsecutiveFailures}`,
  ].join(" | ");

  if (shouldFail) {
    console.error(
      `${summary}\nfast-lane monitor: sustained significant regression detected; failing CI.`,
    );
    return { shouldFail: true, summary };
  }

  if (isFailureSignal) {
    console.warn(
      `${summary}\nfast-lane monitor: significant regression signal recorded; warning until sustained threshold is reached.`,
    );
    return { shouldFail: false, summary };
  }

  if (isWarning) {
    console.warn(`${summary}\nfast-lane monitor: runtime drift warning.`);
    return { shouldFail: false, summary };
  }

  console.log(summary);
  return { shouldFail: false, summary };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const durationArg = process.argv[2];
  if (!durationArg) {
    console.error(
      "monitor-fast-lane-time: missing duration argument (milliseconds).",
    );
    process.exit(1);
  }

  const durationMs = Number.parseInt(durationArg, 10);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    console.error(
      `monitor-fast-lane-time: invalid duration "${durationArg}" (expected positive integer milliseconds).`,
    );
    process.exit(1);
  }

  try {
    const result = await monitorFastLaneDuration({ durationMs });
    process.exit(result.shouldFail ? 1 : 0);
  } catch (error) {
    console.error(
      `monitor-fast-lane-time: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
