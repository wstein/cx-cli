// test-lane: unit
import { describe, expect, test } from "vitest";
import type {
  DoctorOverlapsDeps,
  DoctorOverlapsReport,
} from "../../src/doctor/overlaps.js";
import {
  collectDoctorOverlapsReport,
  printDoctorOverlapsReport,
} from "../../src/doctor/overlaps.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("collectDoctorOverlapsReport", () => {
  test("uses injected deps and returns structured report", async () => {
    const deps: DoctorOverlapsDeps = {
      loadConfig: async () =>
        ({ sourceRoot: "/tmp" }) as unknown as Awaited<
          ReturnType<typeof import("../../src/config/load.js").loadCxConfig>
        >,
      getState: async () =>
        ({}) as unknown as Awaited<
          ReturnType<typeof import("../../src/vcs/provider.js").getVCSState>
        >,
      getMasterList: async () =>
        [] as unknown as Awaited<
          ReturnType<
            typeof import("../../src/planning/masterList.js").buildMasterList
          >
        >,
      analyzeOverlaps: async () => [],
    };

    const report = await collectDoctorOverlapsReport(
      { config: "/tmp/cx.toml" },
      deps,
    );
    expect(report.conflictCount).toBe(0);
    expect(report.conflicts).toEqual([]);
    expect(report.resolvedConfigPath).toContain("cx.toml");
  });

  test("propagates conflicts from analyzeOverlaps dep", async () => {
    const fakeConflicts = [
      {
        path: "a.ts",
        sections: ["x", "y"],
        recommendedOwner: "x",
        suggestions: [],
      },
    ];
    const deps: DoctorOverlapsDeps = {
      loadConfig: async () =>
        ({ sourceRoot: "/tmp" }) as unknown as Awaited<
          ReturnType<typeof import("../../src/config/load.js").loadCxConfig>
        >,
      getState: async () =>
        ({}) as unknown as Awaited<
          ReturnType<typeof import("../../src/vcs/provider.js").getVCSState>
        >,
      getMasterList: async () =>
        [] as unknown as Awaited<
          ReturnType<
            typeof import("../../src/planning/masterList.js").buildMasterList
          >
        >,
      analyzeOverlaps: async () => fakeConflicts,
    };

    const report = await collectDoctorOverlapsReport(
      { config: "/tmp/cx.toml" },
      deps,
    );
    expect(report.conflictCount).toBe(1);
    expect(report.conflicts[0]?.path).toBe("a.ts");
  });
});

function makeReport(
  overrides: Partial<DoctorOverlapsReport> = {},
): DoctorOverlapsReport {
  return {
    resolvedConfigPath: "/tmp/cx.toml",
    conflictCount: 0,
    conflicts: [],
    ...overrides,
  };
}

describe("printDoctorOverlapsReport", () => {
  test("json=true outputs valid JSON with report fields", async () => {
    const capture = createBufferedCommandIo();
    printDoctorOverlapsReport(
      makeReport({ conflictCount: 0 }),
      true,
      capture.io,
    );
    const parsed = JSON.parse(capture.stdout()) as Record<string, unknown>;
    expect(parsed.conflictCount).toBe(0);
    expect(parsed.resolvedConfigPath).toBe("/tmp/cx.toml");
  });

  test("zero conflicts text output contains no-overlap message", async () => {
    const capture = createBufferedCommandIo();
    printDoctorOverlapsReport(makeReport(), false, capture.io);
    expect(capture.stdout()).toContain("No section overlaps detected");
    expect(capture.stdout()).toContain("cx.toml");
  });

  test("single conflict prints singular label, conflict detail, and fix hint", async () => {
    const report = makeReport({
      conflictCount: 1,
      conflicts: [
        {
          path: "src/index.ts",
          sections: ["src", "docs"],
          recommendedOwner: "src",
          suggestions: [{ section: "docs", pattern: "!src/index.ts" }],
        },
      ],
    });
    const capture = createBufferedCommandIo();
    printDoctorOverlapsReport(report, false, capture.io);
    expect(capture.stdout()).toContain("Detected 1 section overlap in");
    expect(capture.stdout()).toContain("src/index.ts");
    expect(capture.stdout()).toContain("matching sections: src, docs");
    expect(capture.stdout()).toContain("owner: src");
    expect(capture.stdout()).toContain("exclude from: docs");
    expect(capture.stdout()).toContain("cx doctor fix-overlaps");
  });

  test("multiple conflicts uses plural label", async () => {
    const report = makeReport({
      conflictCount: 2,
      conflicts: [
        {
          path: "a.ts",
          sections: ["a", "b"],
          recommendedOwner: "a",
          suggestions: [],
        },
        {
          path: "b.ts",
          sections: ["b", "c"],
          recommendedOwner: "b",
          suggestions: [],
        },
      ],
    });
    const capture = createBufferedCommandIo();
    printDoctorOverlapsReport(report, false, capture.io);
    expect(capture.stdout()).toContain("Detected 2 section overlaps in");
  });

  test("conflict with single section omits exclude-from line", async () => {
    const report = makeReport({
      conflictCount: 1,
      conflicts: [
        {
          path: "solo.ts",
          sections: ["only"],
          recommendedOwner: "only",
          suggestions: [],
        },
      ],
    });
    const capture = createBufferedCommandIo();
    printDoctorOverlapsReport(report, false, capture.io);
    expect(capture.stdout()).toContain("owner: only");
    expect(capture.stdout()).not.toContain("exclude from:");
  });
});
