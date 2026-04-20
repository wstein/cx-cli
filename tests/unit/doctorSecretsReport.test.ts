// test-lane: unit
import { describe, expect, test } from "vitest";
import type { ScannerPipeline } from "../../src/doctor/scanner.js";
import type { DoctorSecretsReport } from "../../src/doctor/secrets.js";
import {
  collectDoctorSecretsReport,
  printDoctorSecretsReport,
} from "../../src/doctor/secrets.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

function makeReport(
  overrides: Partial<DoctorSecretsReport> = {},
): DoctorSecretsReport {
  return {
    resolvedConfigPath: "/tmp/cx.toml",
    securityCheckEnabled: true,
    scannerMode: "warn",
    scannedFileCount: 0,
    suspiciousCount: 0,
    findings: [],
    warningCount: 0,
    blockingCount: 0,
    ...overrides,
  };
}

describe("printDoctorSecretsReport", () => {
  test("json=true outputs valid JSON", async () => {
    const capture = createBufferedCommandIo();
    printDoctorSecretsReport(makeReport(), true, capture.io);
    const parsed = JSON.parse(capture.stdout()) as Record<string, unknown>;
    expect(parsed.suspiciousCount).toBe(0);
  });

  test("zero suspicious files prints clean message", async () => {
    const capture = createBufferedCommandIo();
    printDoctorSecretsReport(makeReport(), false, capture.io);
    expect(capture.stdout()).toContain("No suspicious files detected");
  });

  test("zero suspicious + security disabled prints extra warning", async () => {
    const capture = createBufferedCommandIo();
    printDoctorSecretsReport(
      makeReport({ securityCheckEnabled: false }),
      false,
      capture.io,
    );
    expect(capture.stdout()).toContain("security_check is disabled");
  });

  test("suspicious files prints file paths and messages", async () => {
    const report = makeReport({
      suspiciousCount: 1,
      findings: [
        {
          scannerId: "reference_secrets",
          profile: "core",
          stage: "pre_pack_source",
          severity: "warning",
          blocksProof: false,
          type: "file",
          filePath: "secrets/.env",
          messages: ["contains API key pattern"],
        },
      ],
    });
    const capture = createBufferedCommandIo();
    printDoctorSecretsReport(report, false, capture.io);
    expect(capture.stdout()).toContain("secrets/.env");
    expect(capture.stdout()).toContain("reference_secrets");
    expect(capture.stdout()).toContain("contains API key pattern");
    expect(capture.stdout()).toContain("Detected 1 suspicious file");
  });

  test("multiple suspicious files uses plural label", async () => {
    const report = makeReport({
      suspiciousCount: 2,
      findings: [
        {
          scannerId: "reference_secrets",
          profile: "core",
          stage: "pre_pack_source",
          severity: "warning",
          blocksProof: false,
          type: "file",
          filePath: "a.env",
          messages: ["msg1"],
        },
        {
          scannerId: "reference_secrets",
          profile: "core",
          stage: "pre_pack_source",
          severity: "warning",
          blocksProof: false,
          type: "file",
          filePath: "b.env",
          messages: ["msg2"],
        },
      ],
    });
    const capture = createBufferedCommandIo();
    printDoctorSecretsReport(report, false, capture.io);
    expect(capture.stdout()).toContain("Detected 2 suspicious files");
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
            scanner: { mode: "warn" },
          }) as unknown as Awaited<
            ReturnType<typeof import("../../src/config/load.js").loadCxConfig>
          >,
        getState: async () =>
          ({}) as unknown as Awaited<
            ReturnType<typeof import("../../src/vcs/provider.js").getVCSState>
          >,
        getMasterList: async () => [] as unknown as string[],
        scannerPipeline: {
          scanFiles: async () => ({
            mode: "warn",
            findings: [],
            warningCount: 0,
            blockingCount: 0,
          }),
        } satisfies ScannerPipeline,
        readFile: (async () =>
          "") as unknown as typeof import("node:fs/promises").readFile,
      },
    );
    expect(report.suspiciousCount).toBe(0);
    expect(report.scannedFileCount).toBe(0);
    expect(report.securityCheckEnabled).toBe(true);
    expect(report.scannerMode).toBe("warn");
  });
});
