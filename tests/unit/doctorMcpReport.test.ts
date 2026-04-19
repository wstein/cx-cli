// test-lane: unit
import { describe, expect, test } from "vitest";
import type { DoctorMcpReport } from "../../src/doctor/mcp.js";
import {
  collectDoctorMcpReport,
  printDoctorMcpReport,
} from "../../src/doctor/mcp.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

function makeReport(overrides: Partial<DoctorMcpReport> = {}): DoctorMcpReport {
  return {
    resolvedConfigPath: "/tmp/cx.toml",
    activeProfile: "cx.toml",
    filesInclude: [],
    filesExclude: [],
    sectionNames: [],
    policy: "default",
    mutationEnabled: false,
    auditSummary: {
      totalEvents: 0,
      allowedCount: 0,
      deniedCount: 0,
      byCapability: {
        read: 0,
        observe: 0,
        plan: 0,
        mutate: 0,
      },
      byPolicyName: {},
      recentTraceIds: [],
    },
    toolCatalogVersion: 1,
    toolCatalog: [
      {
        name: "bundle",
        capability: "plan",
        stability: "STABLE",
      },
      {
        name: "doctor_mcp",
        capability: "observe",
        stability: "BETA",
      },
    ],
    toolCatalogSummary: {
      totalTools: 2,
      byCapability: {
        read: 0,
        observe: 1,
        plan: 1,
        mutate: 0,
      },
      byStability: {
        STABLE: 1,
        BETA: 1,
        EXPERIMENTAL: 0,
        INTERNAL: 0,
      },
    },
    ...overrides,
  };
}

describe("printDoctorMcpReport", () => {
  test("json=true outputs valid JSON", async () => {
    const capture = createBufferedCommandIo();
    printDoctorMcpReport(makeReport(), true, capture.io);
    const parsed = JSON.parse(capture.stdout()) as Record<string, unknown>;
    expect(parsed.activeProfile).toBe("cx.toml");
    expect(parsed.toolCatalogVersion).toBe(1);
  });

  test("empty filesInclude prints (empty) placeholder", async () => {
    const capture = createBufferedCommandIo();
    printDoctorMcpReport(makeReport({ filesInclude: [] }), false, capture.io);
    expect(capture.stdout()).toContain("(empty)");
  });

  test("non-empty filesInclude lists each pattern", async () => {
    const capture = createBufferedCommandIo();
    printDoctorMcpReport(
      makeReport({ filesInclude: ["src/**", "docs/**"] }),
      false,
      capture.io,
    );
    expect(capture.stdout()).toContain("src/**");
    expect(capture.stdout()).toContain("docs/**");
  });

  test("sectionNames lists each section", async () => {
    const capture = createBufferedCommandIo();
    printDoctorMcpReport(
      makeReport({ sectionNames: ["alpha", "beta"] }),
      false,
      capture.io,
    );
    expect(capture.stdout()).toContain("alpha");
    expect(capture.stdout()).toContain("beta");
  });

  test("resolvedConfigPath appears in output", async () => {
    const capture = createBufferedCommandIo();
    printDoctorMcpReport(
      makeReport({ resolvedConfigPath: "/proj/cx-mcp.toml" }),
      false,
      capture.io,
    );
    expect(capture.stdout()).toContain("/proj/cx-mcp.toml");
  });

  test("prints audit trend summary and recent trace IDs", async () => {
    const capture = createBufferedCommandIo();
    printDoctorMcpReport(
      makeReport({
        auditSummary: {
          totalEvents: 3,
          allowedCount: 2,
          deniedCount: 1,
          byCapability: {
            read: 1,
            observe: 1,
            plan: 0,
            mutate: 1,
          },
          byPolicyName: {
            "default-deny-mutate": 2,
            "strict-read-only": 1,
          },
          recentTraceIds: ["trace-3", "trace-2"],
        },
      }),
      false,
      capture.io,
    );
    expect(capture.stdout()).toContain("Audit events: 3");
    expect(capture.stdout()).toContain("default-deny-mutate: 2");
    expect(capture.stdout()).toContain("trace-3");
  });

  test("prints tool catalog summary and entries", async () => {
    const capture = createBufferedCommandIo();
    printDoctorMcpReport(makeReport(), false, capture.io);
    expect(capture.stdout()).toContain("Tool catalog: v1, 2 tools");
    expect(capture.stdout()).toContain("bundle: plan, STABLE");
    expect(capture.stdout()).toContain("doctor_mcp: observe, BETA");
  });
});

describe("collectDoctorMcpReport", () => {
  test("uses injected deps and returns structured report", async () => {
    const report = await collectDoctorMcpReport(
      { config: "/tmp/cx.toml" },
      {
        resolveProfilePath: async () => "/tmp/cx-mcp.toml",
        loadConfig: async () =>
          ({
            files: { include: ["src/**"], exclude: ["node_modules/**"] },
            sections: { main: {}, docs: {} },
            mcp: { policy: "default", enableMutation: false },
            sourceRoot: "/tmp/workspace",
          }) as unknown as Awaited<
            ReturnType<typeof import("../../src/config/load.js").loadCxConfig>
          >,
        readAuditSummary: async () => ({
          totalEvents: 2,
          allowedCount: 1,
          deniedCount: 1,
          byCapability: {
            read: 1,
            observe: 0,
            plan: 0,
            mutate: 1,
          },
          byPolicyName: {
            "default-deny-mutate": 2,
          },
          recentTraceIds: ["trace-2", "trace-1"],
        }),
      },
    );
    expect(report.activeProfile).toBe("cx-mcp.toml");
    expect(report.filesInclude).toEqual(["src/**"]);
    expect(report.filesExclude).toEqual(["node_modules/**"]);
    expect(report.sectionNames).toEqual(["docs", "main"]);
    expect(report.policy).toBe("default");
    expect(report.mutationEnabled).toBe(false);
    expect(report.auditSummary.totalEvents).toBe(2);
    expect(report.auditSummary.recentTraceIds).toEqual(["trace-2", "trace-1"]);
    expect(report.toolCatalogVersion).toBe(1);
    expect(report.toolCatalog.length).toBeGreaterThan(0);
    expect(report.toolCatalogSummary.totalTools).toBe(
      report.toolCatalog.length,
    );
    expect(report.toolCatalog.find((tool) => tool.name === "bundle")).toEqual({
      name: "bundle",
      capability: "plan",
      stability: "STABLE",
    });
    expect(
      report.toolCatalog.find((tool) => tool.name === "doctor_mcp"),
    ).toEqual({
      name: "doctor_mcp",
      capability: "observe",
      stability: "BETA",
    });
  });
});
