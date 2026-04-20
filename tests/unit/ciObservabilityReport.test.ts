// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  buildCiObservabilityReport,
  classifyFastLaneTrend,
  renderCiObservabilityMarkdown,
  runCiObservabilityReportCli,
} from "../../scripts/ci-observability-report.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("ci observability report", () => {
  test("classifies recent fast-lane trend from timing samples", () => {
    expect(
      classifyFastLaneTrend([{ durationMs: 10_000 }, { durationMs: 11_500 }]),
    ).toBe("regressing");
    expect(
      classifyFastLaneTrend([{ durationMs: 10_000 }, { durationMs: 8_500 }]),
    ).toBe("improving");
    expect(classifyFastLaneTrend([{ durationMs: 10_000 }])).toBe(
      "insufficient-data",
    );
  });

  test("builds markdown with fast-lane and verify policy summaries", () => {
    const report = buildCiObservabilityReport({
      nowIso: "2026-04-19T12:00:00.000Z",
      fastLaneState: {
        lastDurationMs: 15_000,
        failureStreak: 1,
        samples: [
          {
            timestamp: "2026-04-19T11:55:00.000Z",
            durationMs: 12_000,
            warning: false,
            failureSignal: false,
          },
          {
            timestamp: "2026-04-19T12:00:00.000Z",
            durationMs: 15_000,
            warning: true,
            failureSignal: false,
          },
        ],
      },
      verifyAgainstReport: {
        ok: true,
        summary: {
          againstDirTestCount: 4,
          missingJustificationCount: 0,
        },
      },
    });

    const markdown = renderCiObservabilityMarkdown(report);

    expect(markdown).toContain("# CI Observability Dashboard");
    expect(markdown).toContain("## Fast Lane Trend");
    expect(markdown).toContain("- Last duration: 15.00s");
    expect(markdown).toContain("- Trend: regressing");
    expect(markdown).toContain("| Timestamp | Duration | Signal |");
    expect(markdown).toContain("## Verify Against Policy");
    expect(markdown).toContain("- Status: ok");
    expect(markdown).toContain("- Against-dir tests: 4");
  });

  test("cli writes JSON and markdown outputs from available CI inputs", async () => {
    const rootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-ci-observability-"),
    );
    tempDirs.push(rootDir);

    const ciDir = path.join(rootDir, ".ci");
    await fs.mkdir(ciDir, { recursive: true });
    await fs.writeFile(
      path.join(ciDir, "fast-lane-monitor-state.json"),
      `${JSON.stringify(
        {
          lastDurationMs: 14_000,
          failureStreak: 0,
          samples: [
            {
              timestamp: "2026-04-19T12:00:00.000Z",
              durationMs: 14_000,
              warning: false,
              failureSignal: false,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await fs.writeFile(
      path.join(ciDir, "verify-against-policy-report.json"),
      `${JSON.stringify(
        {
          ok: false,
          summary: {
            againstDirTestCount: 3,
            missingJustificationCount: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCiObservabilityReportCli(
      ["--root-dir", rootDir],
      {
        stdout: (message) => {
          stdout.push(message);
          return true;
        },
        stderr: (message) => {
          stderr.push(message);
          return true;
        },
      },
    );

    const jsonOutput = JSON.parse(
      await fs.readFile(path.join(ciDir, "observability-summary.json"), "utf8"),
    ) as {
      fastLane: { available: boolean };
      verifyAgainst: { available: boolean; missingJustificationCount: number };
    };
    const markdownOutput = await fs.readFile(
      path.join(ciDir, "observability-summary.md"),
      "utf8",
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain("# CI Observability Dashboard");
    expect(jsonOutput.fastLane.available).toBe(true);
    expect(jsonOutput.verifyAgainst.available).toBe(true);
    expect(jsonOutput.verifyAgainst.missingJustificationCount).toBe(1);
    expect(markdownOutput).toContain("- Status: attention");
  });
});
