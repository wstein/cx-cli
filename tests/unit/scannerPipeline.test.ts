// test-lane: unit

import { describe, expect, test } from "vitest";

import {
  createScannerPipelineFromRunner,
  loadReferenceScannerPipeline,
} from "../../src/doctor/scanner.js";

describe("createScannerPipelineFromRunner", () => {
  test("adapts runner results into stable scanner findings", async () => {
    const pipeline = createScannerPipelineFromRunner(async (files) =>
      files.map((file) => ({
        type: "file",
        filePath: file.path,
        messages: [`checked ${file.content.length} bytes`],
      })),
    );

    await expect(
      pipeline.scanStage(
        "pre_pack_source",
        [{ path: "secrets.env", content: "abc123" }],
        {
          mode: "fail",
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        mode: "fail",
        warningCount: 0,
        blockingCount: 1,
        findings: [
          {
            scannerId: "reference_secrets",
            profile: "core",
            stage: "pre_pack_source",
            severity: "error",
            blocksProof: true,
            type: "file",
            filePath: "secrets.env",
            messages: ["checked 6 bytes"],
          },
        ],
      }),
    );
  });

  test("supports stage-aware scanning and controlled scanner selection", async () => {
    const pipeline = createScannerPipelineFromRunner(async (files) =>
      files.map((file) => ({
        filePath: file.path,
        messages: [`checked ${file.content.length} bytes`],
      })),
    );

    await expect(
      pipeline.scanStage(
        "post_pack_artifact",
        [{ path: "bundle-manifest.json", content: '{"a":1}' }],
        {
          mode: "warn",
          enabledScannerIds: [],
        },
      ),
    ).resolves.toEqual({
      mode: "warn",
      findings: [],
      warningCount: 0,
      blockingCount: 0,
    });

    await expect(
      pipeline.scanStage(
        "post_pack_artifact",
        [{ path: "bundle-manifest.json", content: '{"a":1}' }],
        {
          mode: "warn",
          enabledScannerIds: ["reference_secrets"],
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        mode: "warn",
        warningCount: 1,
        blockingCount: 0,
        findings: [
          expect.objectContaining({
            scannerId: "reference_secrets",
            stage: "post_pack_artifact",
            severity: "warning",
            blocksProof: false,
            filePath: "bundle-manifest.json",
          }),
        ],
      }),
    );
  });
});

describe("loadReferenceScannerPipeline", () => {
  test("fails when the reference adapter does not export runSecurityCheck", async () => {
    await expect(
      loadReferenceScannerPipeline(async () => ({})),
    ).rejects.toThrow("runSecurityCheck");
  });
});
