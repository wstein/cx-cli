import { describe, expect, test } from "bun:test";
import type { DoctorSecretsReport } from "../../src/doctor/secrets.js";
import {
  collectDoctorSecretsReport,
  printDoctorSecretsReport,
} from "../../src/doctor/secrets.js";
import { captureCli } from "../helpers/cli/captureCli.js";

function makeReport(
  overrides: Partial<DoctorSecretsReport> = {},
): DoctorSecretsReport {
  return {
    resolvedConfigPath: "/tmp/cx.toml",
    securityCheckEnabled: true,
    scannedFileCount: 0,
    suspiciousCount: 0,
    suspiciousFiles: [],
    ...overrides,
  };
}

describe("printDoctorSecretsReport", () => {
  test("json=true outputs valid JSON", async () => {
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorSecretsReport(makeReport(), true);
        return 0;
      },
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    expect(parsed.suspiciousCount).toBe(0);
  });

  test("zero suspicious files prints clean message", async () => {
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorSecretsReport(makeReport(), false);
        return 0;
      },
    });
    expect(stdout).toContain("No suspicious files detected");
  });

  test("zero suspicious + security disabled prints extra warning", async () => {
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorSecretsReport(
          makeReport({ securityCheckEnabled: false }),
          false,
        );
        return 0;
      },
    });
    expect(stdout).toContain("security_check is disabled");
  });

  test("suspicious files prints file paths and messages", async () => {
    const report = makeReport({
      suspiciousCount: 1,
      suspiciousFiles: [
        { filePath: "secrets/.env", messages: ["contains API key pattern"] },
      ],
    });
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorSecretsReport(report, false);
        return 0;
      },
    });
    expect(stdout).toContain("secrets/.env");
    expect(stdout).toContain("contains API key pattern");
    expect(stdout).toContain("Detected 1 suspicious file");
  });

  test("multiple suspicious files uses plural label", async () => {
    const report = makeReport({
      suspiciousCount: 2,
      suspiciousFiles: [
        { filePath: "a.env", messages: ["msg1"] },
        { filePath: "b.env", messages: ["msg2"] },
      ],
    });
    const { stdout } = await captureCli({
      run: async () => {
        printDoctorSecretsReport(report, false);
        return 0;
      },
    });
    expect(stdout).toContain("Detected 2 suspicious files");
  });
});

describe("collectDoctorSecretsReport", () => {
  test("uses injected deps and returns structured report", async () => {
    const report = await collectDoctorSecretsReport(
      { config: "/tmp/cx.toml" },
      {
        loadConfig: async () =>
          ({
            sourceRoot: "/tmp",
            repomix: { securityCheck: true },
          }) as unknown as Awaited<
            ReturnType<typeof import("../../src/config/load.js").loadCxConfig>
          >,
        getState: async () =>
          ({}) as unknown as Awaited<
            ReturnType<
              typeof import("../../src/vcs/provider.js").getVCSState
            >
          >,
        getMasterList: async () => [] as unknown as string[],
        runScan: async () => [],
        readFile: async () => "" as unknown as Buffer,
      },
    );
    expect(report.suspiciousCount).toBe(0);
    expect(report.scannedFileCount).toBe(0);
    expect(report.securityCheckEnabled).toBe(true);
  });
});
