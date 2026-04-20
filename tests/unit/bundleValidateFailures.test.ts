// test-lane: unit

import path from "node:path";
import { describe, expect, test } from "vitest";
import { validateBundle } from "../../src/bundle/validate.js";
import type { CxManifest } from "../../src/manifest/types.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function createManifest(overrides: Partial<CxManifest> = {}): CxManifest {
  const manifest: CxManifest = {
    schemaVersion: 9,
    bundleVersion: 1,
    projectName: "demo",
    sourceRoot: ".",
    bundleDir: "dist/demo-bundle",
    checksumFile: "demo.sha256",
    handoverFile: "demo-handover.xml.txt",
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
        outputSha256: HASH_A,
        fileCount: 1,
        tokenCount: 8,
        files: [
          {
            path: "src/index.ts",
            kind: "text",
            section: "src",
            storedIn: "packed",
            sha256: HASH_A,
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
    assets: [
      {
        sourcePath: "logo.png",
        storedPath: "demo-assets/logo.png",
        sha256: HASH_B,
        sizeBytes: 4,
        mtime: "2026-04-19T00:00:00.000Z",
        mediaType: "image/png",
      },
    ],
    files: [
      {
        path: "src/index.ts",
        kind: "text",
        section: "src",
        storedIn: "packed",
        sha256: HASH_A,
        sizeBytes: 17,
        tokenCount: 8,
        mtime: "2026-04-19T00:00:00.000Z",
        mediaType: "text/typescript",
        outputStartLine: 1,
        outputEndLine: 1,
      },
      {
        path: "logo.png",
        kind: "asset",
        section: "-",
        storedIn: "copied",
        sha256: HASH_B,
        sizeBytes: 4,
        tokenCount: 0,
        mtime: "2026-04-19T00:00:00.000Z",
        mediaType: "image/png",
        outputStartLine: null,
        outputEndLine: null,
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

describe("validateBundle failure classes", () => {
  test("rejects unsupported bundle versions", async () => {
    await expect(
      validateBundle("/bundle", {
        loadManifestFromBundle: async () => ({
          manifest: createManifest({
            bundleVersion: 2 as unknown as 1,
          }),
          manifestName: "demo-manifest.json",
        }),
      }),
    ).rejects.toThrow(
      "Unsupported bundle version 2. This version of cx supports bundle version 1.",
    );
  });

  test("rejects missing section outputs", async () => {
    const bundleDir = "/bundle";
    const missingOutput = path.join(bundleDir, "demo-src.xml.txt");
    await expect(
      validateBundle(bundleDir, {
        loadManifestFromBundle: async () => ({
          manifest: createManifest(),
          manifestName: "demo-manifest.json",
        }),
        pathExists: async (targetPath) => targetPath !== missingOutput,
      }),
    ).rejects.toThrow("Bundle is missing section output demo-src.xml.txt.");
  });

  test("rejects missing shared handover files", async () => {
    const bundleDir = "/bundle";
    const missingIndex = path.join(bundleDir, "demo-handover.xml.txt");
    await expect(
      validateBundle(bundleDir, {
        loadManifestFromBundle: async () => ({
          manifest: createManifest(),
          manifestName: "demo-manifest.json",
        }),
        pathExists: async (targetPath) => targetPath !== missingIndex,
      }),
    ).rejects.toThrow(
      "Bundle is missing shared handover demo-handover.xml.txt.",
    );
  });

  test("rejects missing assets", async () => {
    const bundleDir = "/bundle";
    const missingAsset = path.join(bundleDir, "demo-assets/logo.png");
    await expect(
      validateBundle(bundleDir, {
        loadManifestFromBundle: async () => ({
          manifest: createManifest(),
          manifestName: "demo-manifest.json",
        }),
        pathExists: async (targetPath) => targetPath !== missingAsset,
      }),
    ).rejects.toThrow("Bundle is missing asset demo-assets/logo.png.");
  });

  test("rejects invalid checksum file contents", async () => {
    await expect(
      validateBundle("/bundle", {
        loadManifestFromBundle: async () => ({
          manifest: createManifest(),
          manifestName: "demo-manifest.json",
        }),
        pathExists: async () => true,
        readFile: async () => "invalid checksum line",
      }),
    ).rejects.toThrow("Invalid checksum line: invalid checksum line");
  });

  test("rejects invalid json section outputs", async () => {
    const baseManifest = createManifest();
    const firstSection = baseManifest.sections[0];
    if (!firstSection) {
      throw new Error("Expected base manifest section");
    }

    await expect(
      validateBundle("/bundle", {
        loadManifestFromBundle: async () => ({
          manifest: createManifest({
            settings: {
              ...baseManifest.settings,
              globalStyle: "json",
            },
            sections: [
              {
                ...firstSection,
                style: "json",
                outputFile: "demo-src.json.txt",
              },
            ],
          }),
          manifestName: "demo-manifest.json",
        }),
        pathExists: async () => true,
        readFile: async (filePath) => {
          if (filePath.endsWith("demo-src.json.txt")) {
            return '{"broken":true}';
          }
          return `${"a".repeat(64)}  demo-manifest.json`;
        },
      }),
    ).rejects.toThrow(
      "Bundle contains invalid JSON section output demo-src.json.txt:",
    );
  });

  test("rejects invalid json shared handovers", async () => {
    const manifest = createManifest({
      settings: {
        ...createManifest().settings,
        globalStyle: "json",
      },
      handoverFile: "demo-handover.json.txt",
    });

    await expect(
      validateBundle("/bundle", {
        loadManifestFromBundle: async () => ({
          manifest,
          manifestName: "demo-manifest.json",
        }),
        pathExists: async () => true,
        readFile: async (filePath) => {
          if (filePath.endsWith("demo-handover.json.txt")) {
            return '{"broken":true}';
          }
          if (filePath.endsWith("demo-src.xml.txt")) {
            return "section output";
          }
          return `${"a".repeat(64)}  demo-manifest.json`;
        },
      }),
    ).rejects.toThrow(
      "Bundle contains invalid JSON shared handover demo-handover.json.txt:",
    );
  });
});
