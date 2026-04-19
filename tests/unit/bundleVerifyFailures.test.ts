// test-lane: unit
import { describe, expect, test } from "bun:test";
import { VerifyError, verifyBundle } from "../../src/bundle/verify.js";
import type { CxConfig } from "../../src/config/types.js";
import type { CxManifest } from "../../src/manifest/types.js";
import { buildConfig } from "../helpers/config/buildConfig.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function createManifest(overrides: Partial<CxManifest> = {}): CxManifest {
  const manifest: CxManifest = {
    schemaVersion: 6,
    bundleVersion: 1,
    projectName: "demo",
    sourceRoot: ".",
    bundleDir: "dist/demo-bundle",
    checksumFile: "demo.sha256",
    createdAt: "2026-04-19T00:00:00.000Z",
    cxVersion: "0.0.0-test",
    repomixVersion: "0.0.0-test",
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
    sections: [
      {
        name: "src",
        style: "xml",
        outputFile: "demo-repomix-src.xml.txt",
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
    { hash: HASH_B, relativePath: "demo-repomix-src.xml.txt" },
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
        renderSectionWithRepomix: async () => ({
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
        renderSectionWithRepomix: async () => ({
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
        renderSectionWithRepomix: async () => ({
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
});
