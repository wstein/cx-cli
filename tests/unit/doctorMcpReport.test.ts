// test-lane: unit
import { describe, expect, test } from "bun:test";
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
    ...overrides,
  };
}

describe("printDoctorMcpReport", () => {
  test("json=true outputs valid JSON", async () => {
    const capture = createBufferedCommandIo();
    printDoctorMcpReport(makeReport(), true, capture.io);
    const parsed = JSON.parse(capture.stdout()) as Record<string, unknown>;
    expect(parsed.activeProfile).toBe("cx.toml");
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
          }) as unknown as Awaited<
            ReturnType<typeof import("../../src/config/load.js").loadCxConfig>
          >,
      },
    );
    expect(report.activeProfile).toBe("cx-mcp.toml");
    expect(report.filesInclude).toEqual(["src/**"]);
    expect(report.filesExclude).toEqual(["node_modules/**"]);
    expect(report.sectionNames).toEqual(["docs", "main"]);
    expect(report.policy).toBe("default");
    expect(report.mutationEnabled).toBe(false);
  });
});
