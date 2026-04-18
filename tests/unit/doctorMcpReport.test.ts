import { describe, expect, test } from "bun:test";
import type { DoctorMcpReport } from "../../src/doctor/mcp.js";
import {
  collectDoctorMcpReport,
  printDoctorMcpReport,
} from "../../src/doctor/mcp.js";
import { captureCli } from "../helpers/cli/captureCli.js";

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
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorMcpReport(makeReport(), true);
        return 0;
      },
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(parsed.activeProfile).toBe("cx.toml");
  });

  test("empty filesInclude prints (empty) placeholder", async () => {
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorMcpReport(makeReport({ filesInclude: [] }), false);
        return 0;
      },
    });
    expect(stdout).toContain("(empty)");
  });

  test("non-empty filesInclude lists each pattern", async () => {
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorMcpReport(
          makeReport({ filesInclude: ["src/**", "docs/**"] }),
          false,
        );
        return 0;
      },
    });
    expect(stdout).toContain("src/**");
    expect(stdout).toContain("docs/**");
  });

  test("sectionNames lists each section", async () => {
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorMcpReport(
          makeReport({ sectionNames: ["alpha", "beta"] }),
          false,
        );
        return 0;
      },
    });
    expect(stdout).toContain("alpha");
    expect(stdout).toContain("beta");
  });

  test("resolvedConfigPath appears in output", async () => {
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorMcpReport(
          makeReport({ resolvedConfigPath: "/proj/cx-mcp.toml" }),
          false,
        );
        return 0;
      },
    });
    expect(stdout).toContain("/proj/cx-mcp.toml");
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
