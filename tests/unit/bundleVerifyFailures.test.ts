// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import {
  clearVerifyRenderPlanCache,
  VerifyError,
  verifyBundle,
} from "../../src/bundle/verify.js";
import type { CxConfig } from "../../src/config/types.js";
import type { CxManifest } from "../../src/manifest/types.js";
import { sha256NormalizedText } from "../../src/shared/hashing.js";
import { buildConfig } from "../helpers/config/buildConfig.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const AGGREGATE_PLAN_HASH_B = sha256NormalizedText(
  JSON.stringify([["src", HASH_B]]),
);

function createManifest(overrides: Partial<CxManifest> = {}): CxManifest {
  const manifest: CxManifest = {
    schemaVersion: 9,
    bundleVersion: 1,
    projectName: "demo",
    sourceRoot: ".",
    bundleDir: "dist/demo-bundle",
    checksumFile: "demo.sha256",
    createdAt: "2026-04-19T00:00:00.000Z",
    cxVersion: "0.0.0-test",
    checksumAlgorithm: "sha256",
    settings: {
      globalStyle: "xml",
      tokenEncoding: "o200k_base",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: true,
      normalizationPolicy: "repomix-default-v1",
      includeLinkedNotes: false,
    },
    totalTokenCount: 8,
    vcsProvider: "git",
    dirtyState: "clean",
    modifiedFiles: [],
    trustModel: {
      sourceTree: "trusted",
      notes: "conditional",
      agentOutput: "untrusted_until_verified",
      bundle: "trusted",
    },
    traceability: {
      bundle: { command: "cx bundle", track: "A" },
      notes: { governanceCommand: "cx notes check", trustLevel: "conditional" },
      agent: {
        auditLogPath: ".cx/audit.log",
        outputTrust: "untrusted_until_verified",
        decisionSource: "mcp_audit_log",
      },
    },
    sections: [
      {
        name: "src",
        style: "xml",
        outputFile: "demo-src.xml.txt",
        outputSha256: HASH_B,
        fileCount: 1,
        tokenCount: 8,
        files: [
          {
            path: "src/index.ts",
            kind: "text",
            section: "src",
            storedIn: "packed",
            sha256: HASH_C,
            sizeBytes: 17,
            tokenCount: 8,
            mtime: "2026-04-19T00:00:00.000Z",
            mediaType: "text/typescript",
            outputStartLine: 1,
            outputEndLine: 1,
          },
        ],
      },
    ],
    assets: [],
    files: [
      {
        path: "src/index.ts",
        kind: "text",
        section: "src",
        storedIn: "packed",
        sha256: HASH_C,
        sizeBytes: 17,
        tokenCount: 8,
        mtime: "2026-04-19T00:00:00.000Z",
        mediaType: "text/typescript",
        outputStartLine: 1,
        outputEndLine: 1,
      },
    ],
  };

  return {
    ...manifest,
    ...overrides,
    settings: {
      ...manifest.settings,
      ...(overrides.settings ?? {}),
    },
    sections: overrides.sections ?? manifest.sections,
    assets: overrides.assets ?? manifest.assets,
    files: overrides.files ?? manifest.files,
  };
}

const BASE_CONFIG: CxConfig = buildConfig({
  sourceRoot: ".",
  projectName: "demo",
  sections: {
    src: {
      include: ["src/**"],
      exclude: [],
    },
  },
});

function passingChecksumRows() {
  return [
    { hash: HASH_A, relativePath: "demo-manifest.json" },
    { hash: HASH_B, relativePath: "demo-src.xml.txt" },
  ];
}

async function expectVerifyFailure(
  promise: Promise<void>,
  failureType: VerifyError["type"],
): Promise<VerifyError> {
  try {
    await promise;
    throw new Error(`Expected verifyBundle to fail with ${failureType}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(VerifyError);
    const verifyError = error as VerifyError;
    expect(verifyError.type).toBe(failureType);
    return verifyError;
  }
}

describe("verifyBundle failure classes", () => {
  beforeEach(() => {
    clearVerifyRenderPlanCache();
  });

  test("reuses cached render plans when verify inputs are unchanged", async () => {
    const sourceDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-verify-cache-hit-"),
    );
    const sourceFile = path.join(sourceDir, "src/index.ts");
    await fs.mkdir(path.dirname(sourceFile), { recursive: true });
    await fs.writeFile(sourceFile, "export const x = 1;\n", "utf8");

    const manifest = createManifest({
      renderPlanHash: AGGREGATE_PLAN_HASH_B,
    });
    let renderCallCount = 0;

    const deps = {
      validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
      loadManifestFromBundle: async () => ({
        manifest,
        manifestName: "demo-manifest.json",
      }),
      readFile: async () => "unused",
      parseChecksumFile: () => passingChecksumRows(),
      sha256File: async (targetPath: string) =>
        targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
      mkdtemp: async () => path.join(sourceDir, ".tmp-render"),
      rm: async () => undefined,
      renderSection: async () => {
        renderCallCount += 1;
        return {
          outputText: "",
          outputTokenCount: 0,
          fileTokenCounts: new Map(),
          fileContentHashes: new Map([["src/index.ts", HASH_C]]),
          structuredPlan: {
            entries: [
              {
                path: "src/index.ts",
                content: "export const x = 1;\n",
                sha256: HASH_C,
                tokenCount: 8,
              },
            ],
            ordering: ["src/index.ts"],
          },
          planHash: HASH_B,
          warnings: [],
        };
      },
      validateEntryHashes: () => new Map(),
    };

    try {
      await verifyBundle("/bundle", sourceDir, undefined, BASE_CONFIG, deps);
      await verifyBundle("/bundle", sourceDir, undefined, BASE_CONFIG, deps);
      expect(renderCallCount).toBe(1);
    } finally {
      clearVerifyRenderPlanCache();
      await fs.rm(sourceDir, { recursive: true, force: true });
    }
  });

  test("invalidates cached render plans when source file identity changes", async () => {
    const sourceDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-verify-cache-miss-"),
    );
    const sourceFile = path.join(sourceDir, "src/index.ts");
    await fs.mkdir(path.dirname(sourceFile), { recursive: true });
    await fs.writeFile(sourceFile, "export const x = 1;\n", "utf8");

    const manifest = createManifest({
      renderPlanHash: AGGREGATE_PLAN_HASH_B,
    });
    let renderCallCount = 0;

    const deps = {
      validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
      loadManifestFromBundle: async () => ({
        manifest,
        manifestName: "demo-manifest.json",
      }),
      readFile: async () => "unused",
      parseChecksumFile: () => passingChecksumRows(),
      sha256File: async (targetPath: string) =>
        targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
      mkdtemp: async () => path.join(sourceDir, ".tmp-render"),
      rm: async () => undefined,
      renderSection: async () => {
        renderCallCount += 1;
        const currentContent = await fs.readFile(sourceFile, "utf8");
        const currentHash =
          currentContent === "export const x = 1;\n" ? HASH_C : HASH_A;
        return {
          outputText: "",
          outputTokenCount: 0,
          fileTokenCounts: new Map(),
          fileContentHashes: new Map([["src/index.ts", currentHash]]),
          structuredPlan: {
            entries: [
              {
                path: "src/index.ts",
                content: currentContent,
                sha256: currentHash,
                tokenCount: 8,
              },
            ],
            ordering: ["src/index.ts"],
          },
          planHash: HASH_B,
          warnings: [],
        };
      },
      validateEntryHashes: () => new Map(),
    };

    try {
      await verifyBundle("/bundle", sourceDir, undefined, BASE_CONFIG, deps);
      await fs.writeFile(sourceFile, "export const y = 2;\n", "utf8");

      const failure = await expectVerifyFailure(
        verifyBundle("/bundle", sourceDir, undefined, BASE_CONFIG, deps),
        "source_tree_drift",
      );

      expect(renderCallCount).toBe(2);
      expect(failure.message).toContain("normalized packed content differs");
    } finally {
      clearVerifyRenderPlanCache();
      await fs.rm(sourceDir, { recursive: true, force: true });
    }
  });

  test("fails on unexpected checksum references", async () => {
    const manifest = createManifest();

    await expectVerifyFailure(
      verifyBundle("/bundle", undefined, undefined, undefined, {
        validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
        loadManifestFromBundle: async () => ({
          manifest,
          manifestName: "demo-manifest.json",
        }),
        readFile: async () => "unused",
        parseChecksumFile: () => [
          { hash: HASH_C, relativePath: "unlisted-artifact.txt" },
          ...passingChecksumRows(),
        ],
        sha256File: async (targetPath) =>
          targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
      }),
      "unexpected_checksum_reference",
    );
  });

  test("fails on checksum mismatches", async () => {
    const manifest = createManifest();

    await expectVerifyFailure(
      verifyBundle("/bundle", undefined, undefined, undefined, {
        validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
        loadManifestFromBundle: async () => ({
          manifest,
          manifestName: "demo-manifest.json",
        }),
        readFile: async () => "unused",
        parseChecksumFile: () => passingChecksumRows(),
        sha256File: async (targetPath) => {
          if (targetPath.endsWith("demo-manifest.json")) {
            return HASH_A;
          }
          return HASH_C;
        },
      }),
      "checksum_mismatch",
    );
  });

  test("fails on checksum omissions", async () => {
    const manifest = createManifest();

    await expectVerifyFailure(
      verifyBundle("/bundle", undefined, undefined, undefined, {
        validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
        loadManifestFromBundle: async () => ({
          manifest,
          manifestName: "demo-manifest.json",
        }),
        readFile: async () => "unused",
        parseChecksumFile: () => [
          { hash: HASH_A, relativePath: "demo-manifest.json" },
        ],
        sha256File: async () => HASH_A,
      }),
      "checksum_omission",
    );
  });

  test("requires loaded config for verify --against", async () => {
    const manifest = createManifest();

    await expect(
      verifyBundle("/bundle", "/source-tree", undefined, undefined, {
        validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
        loadManifestFromBundle: async () => ({
          manifest,
          manifestName: "demo-manifest.json",
        }),
        readFile: async () => "unused",
        parseChecksumFile: () => passingChecksumRows(),
        sha256File: async (targetPath) =>
          targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
      }),
    ).rejects.toThrow(
      "A loaded cx config is required to verify normalized content against a source tree.",
    );
  });

  test("fails when render plan ordering is non-deterministic", async () => {
    const manifest = createManifest({
      renderPlanHash: HASH_A,
    });

    const failure = await expectVerifyFailure(
      verifyBundle("/bundle", "/source-tree", undefined, BASE_CONFIG, {
        validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
        loadManifestFromBundle: async () => ({
          manifest,
          manifestName: "demo-manifest.json",
        }),
        readFile: async () => "unused",
        parseChecksumFile: () => passingChecksumRows(),
        sha256File: async (targetPath) =>
          targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
        mkdtemp: async () => "/tmp/cx-verify-ordering",
        rm: async () => undefined,
        stat: async () => ({ mtimeMs: 1, size: 17 }),
        renderSection: async () => ({
          outputText: "",
          outputTokenCount: 0,
          fileTokenCounts: new Map(),
          fileContentHashes: new Map([["src/index.ts", HASH_C]]),
          structuredPlan: {
            entries: [
              {
                path: "src/index.ts",
                content: "export const x = 1;\n",
                sha256: HASH_C,
                tokenCount: 8,
              },
            ],
            ordering: ["src/z.ts", "src/a.ts"],
          },
          planHash: HASH_B,
          warnings: [],
        }),
      }),
      "ordering_violation",
    );

    expect(failure.message).toContain("not deterministic");
  });

  test("fails when structured entry hashes are inconsistent", async () => {
    const manifest = createManifest({
      renderPlanHash: HASH_A,
    });

    const failure = await expectVerifyFailure(
      verifyBundle("/bundle", "/source-tree", undefined, BASE_CONFIG, {
        validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
        loadManifestFromBundle: async () => ({
          manifest,
          manifestName: "demo-manifest.json",
        }),
        readFile: async () => "unused",
        parseChecksumFile: () => passingChecksumRows(),
        sha256File: async (targetPath) =>
          targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
        mkdtemp: async () => "/tmp/cx-verify-hashes",
        rm: async () => undefined,
        stat: async () => ({ mtimeMs: 1, size: 17 }),
        renderSection: async () => ({
          outputText: "",
          outputTokenCount: 0,
          fileTokenCounts: new Map(),
          fileContentHashes: new Map([["src/index.ts", HASH_C]]),
          structuredPlan: {
            entries: [
              {
                path: "src/index.ts",
                content: "export const x = 1;\n",
                sha256: HASH_C,
                tokenCount: 8,
              },
            ],
            ordering: ["src/index.ts"],
          },
          planHash: HASH_B,
          warnings: [],
        }),
        validateEntryHashes: () =>
          new Map([
            [
              "src/index.ts",
              "hash mismatch: expected aaaaaaaaa, got bbbbbbbbb",
            ],
          ]),
      }),
      "structured_contract_mismatch",
    );

    expect(failure.message).toContain("Content hash validation failed");
  });

  test("fails when source-tree render plan hash drifts", async () => {
    const manifest = createManifest({
      renderPlanHash: HASH_A,
    });

    const failure = await expectVerifyFailure(
      verifyBundle("/bundle", "/source-tree", undefined, BASE_CONFIG, {
        validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
        loadManifestFromBundle: async () => ({
          manifest,
          manifestName: "demo-manifest.json",
        }),
        readFile: async () => "unused",
        parseChecksumFile: () => passingChecksumRows(),
        sha256File: async (targetPath) =>
          targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
        mkdtemp: async () => "/tmp/cx-verify-plan-hash",
        rm: async () => undefined,
        stat: async () => ({ mtimeMs: 1, size: 17 }),
        renderSection: async () => ({
          outputText: "",
          outputTokenCount: 0,
          fileTokenCounts: new Map(),
          fileContentHashes: new Map([["src/index.ts", HASH_C]]),
          structuredPlan: {
            entries: [
              {
                path: "src/index.ts",
                content: "export const x = 1;\n",
                sha256: HASH_C,
                tokenCount: 8,
              },
            ],
            ordering: ["src/index.ts"],
          },
          planHash: HASH_B,
          warnings: [],
        }),
        validateEntryHashes: () => new Map(),
      }),
      "render_plan_drift",
    );

    expect(failure.message).toContain("Render plan hash drift");
  });

  test("skips aggregate render_plan_drift check for selective --against by file", async () => {
    const manifest = createManifest({
      renderPlanHash: HASH_A,
    });

    await expect(
      verifyBundle(
        "/bundle",
        "/source-tree",
        { sections: undefined, files: ["src/index.ts"] },
        BASE_CONFIG,
        {
          validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
          loadManifestFromBundle: async () => ({
            manifest,
            manifestName: "demo-manifest.json",
          }),
          readFile: async () => "unused",
          parseChecksumFile: () => passingChecksumRows(),
          sha256File: async (targetPath) =>
            targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
          mkdtemp: async () => "/tmp/cx-verify-selective-file",
          rm: async () => undefined,
          stat: async () => ({ mtimeMs: 1, size: 17 }),
          renderSection: async () => ({
            outputText: "",
            outputTokenCount: 0,
            fileTokenCounts: new Map(),
            fileContentHashes: new Map([["src/index.ts", HASH_C]]),
            structuredPlan: {
              entries: [
                {
                  path: "src/index.ts",
                  content: "export const x = 1;\n",
                  sha256: HASH_C,
                  tokenCount: 8,
                },
              ],
              ordering: ["src/index.ts"],
            },
            // Deliberately mismatched; selective verify must not fail on aggregate drift.
            planHash: HASH_B,
            warnings: [],
          }),
          validateEntryHashes: () => new Map(),
        },
      ),
    ).resolves.toBeUndefined();
  });

  test("skips aggregate render_plan_drift check for selective --against by section", async () => {
    const manifest = createManifest({
      renderPlanHash: HASH_A,
    });

    await expect(
      verifyBundle(
        "/bundle",
        "/source-tree",
        { sections: ["src"], files: undefined },
        BASE_CONFIG,
        {
          validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
          loadManifestFromBundle: async () => ({
            manifest,
            manifestName: "demo-manifest.json",
          }),
          readFile: async () => "unused",
          parseChecksumFile: () => passingChecksumRows(),
          sha256File: async (targetPath) =>
            targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
          mkdtemp: async () => "/tmp/cx-verify-selective-section",
          rm: async () => undefined,
          stat: async () => ({ mtimeMs: 1, size: 17 }),
          renderSection: async () => ({
            outputText: "",
            outputTokenCount: 0,
            fileTokenCounts: new Map(),
            fileContentHashes: new Map([["src/index.ts", HASH_C]]),
            structuredPlan: {
              entries: [
                {
                  path: "src/index.ts",
                  content: "export const x = 1;\n",
                  sha256: HASH_C,
                  tokenCount: 8,
                },
              ],
              ordering: ["src/index.ts"],
            },
            // Deliberately mismatched; selective verify must not fail on aggregate drift.
            planHash: HASH_B,
            warnings: [],
          }),
          validateEntryHashes: () => new Map(),
        },
      ),
    ).resolves.toBeUndefined();
  });

  test("skips aggregate render_plan_drift check when file and section filters are both set", async () => {
    const manifest = createManifest({
      renderPlanHash: HASH_A,
    });

    await expect(
      verifyBundle(
        "/bundle",
        "/source-tree",
        { sections: ["src"], files: ["src/index.ts"] },
        BASE_CONFIG,
        {
          validateBundle: async () => ({ manifestName: "demo-manifest.json" }),
          loadManifestFromBundle: async () => ({
            manifest,
            manifestName: "demo-manifest.json",
          }),
          readFile: async () => "unused",
          parseChecksumFile: () => passingChecksumRows(),
          sha256File: async (targetPath) =>
            targetPath.endsWith("demo-manifest.json") ? HASH_A : HASH_B,
          mkdtemp: async () => "/tmp/cx-verify-selective-file-section",
          rm: async () => undefined,
          stat: async () => ({ mtimeMs: 1, size: 17 }),
          renderSection: async () => ({
            outputText: "",
            outputTokenCount: 0,
            fileTokenCounts: new Map(),
            fileContentHashes: new Map([["src/index.ts", HASH_C]]),
            structuredPlan: {
              entries: [
                {
                  path: "src/index.ts",
                  content: "export const x = 1;\n",
                  sha256: HASH_C,
                  tokenCount: 8,
                },
              ],
              ordering: ["src/index.ts"],
            },
            // Deliberately mismatched; selective verify must not fail on aggregate drift.
            planHash: HASH_B,
            warnings: [],
          }),
          validateEntryHashes: () => new Map(),
        },
      ),
    ).resolves.toBeUndefined();
  });
});
