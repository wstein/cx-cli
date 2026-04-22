// test-lane: contract
import { describe, expect, test } from "vitest";
import {
  MANIFEST_SCHEMA_VERSION,
  parseManifestJson,
  renderManifestJson,
} from "../../src/manifest/json.js";
import type { CxManifest } from "../../src/manifest/types.js";

function sampleManifest(): CxManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    bundleVersion: 1,
    projectName: "demo",
    sourceRoot: "/tmp/source",
    bundleDir: "/tmp/bundle",
    checksumFile: "demo.sha256",
    createdAt: "2026-04-17T00:00:00.000Z",
    cxVersion: "0.3.16",
    checksumAlgorithm: "sha256",
    renderPlanHash: "abc123",
    settings: {
      globalStyle: "xml",
      tokenEncoding: "o200k_base",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: false,
      normalizationPolicy: "repomix-default-v1",
      includeLinkedNotes: false,
    },
    totalTokenCount: 12,
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
        name: "docs",
        style: "xml",
        outputFile: "demo-docs.xml.txt",
        outputSha256: "sha-docs",
        fileCount: 1,
        tokenCount: 5,
        files: [
          {
            path: "README.md",
            kind: "text",
            section: "docs",
            storedIn: "packed",
            sha256: "sha-readme",
            sizeBytes: 12,
            tokenCount: 5,
            mtime: "2026-04-17T00:00:00.000Z",
            mediaType: "text/markdown",
            outputStartLine: 3,
            outputEndLine: 5,
          },
        ],
      },
      {
        name: "src",
        style: "xml",
        outputFile: "demo-src.xml.txt",
        outputSha256: "sha-src",
        fileCount: 1,
        tokenCount: 7,
        files: [
          {
            path: "src/index.ts",
            kind: "text",
            section: "src",
            storedIn: "packed",
            sha256: "sha-src-index",
            sizeBytes: 15,
            tokenCount: 7,
            mtime: "2026-04-17T00:00:00.000Z",
            mediaType: "text/typescript",
            outputStartLine: 3,
            outputEndLine: 4,
          },
        ],
      },
    ],
    assets: [],
    derivedReviewExports: [
      {
        surfaceName: "manual",
        title: "Manual",
        moduleName: "manual",
        storedPath: "demo-docs-exports/manual.mmd.md",
        sha256:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        sizeBytes: 128,
        pageCount: 3,
        sourcePaths: ["docs/modules/manual/pages/index.adoc"],
        generator: {
          name: "@wsmy/antora-markdown-exporter",
          version: "0.7.0",
          format: "multimarkdown",
          extension: ".mmd.md",
        },
        trustClassification: "derived_review_export",
      },
    ],
    files: [],
  };
}

describe("manifest contract", () => {
  test("uses expected schema version", () => {
    expect(sampleManifest().schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
  });

  test("round-trips manifest JSON without losing structure", () => {
    const manifest = sampleManifest();
    const rendered = renderManifestJson(manifest);
    const reparsed = parseManifestJson(rendered);
    expect(reparsed.sections).toHaveLength(2);
    expect(reparsed.sections[0]?.name).toBe("docs");
    expect(reparsed.sections[1]?.name).toBe("src");
    expect(reparsed.sections[0]?.files[0]?.path).toBe("README.md");
    expect(reparsed.sections[1]?.files[0]?.path).toBe("src/index.ts");
    expect(reparsed.traceability.agent.auditLogPath).toBe(".cx/audit.log");
  });

  test("preserves nested section ordering and file ordering", () => {
    const rendered = renderManifestJson(sampleManifest());
    expect(rendered.indexOf('"name": "docs"')).toBeLessThan(
      rendered.indexOf('"name": "src"'),
    );
    expect(rendered.indexOf('"path": "README.md"')).toBeLessThan(
      rendered.indexOf('"path": "src/index.ts"'),
    );
  });

  test("retains output line spans when present", () => {
    const parsed = parseManifestJson(renderManifestJson(sampleManifest()));
    expect(parsed.sections[0]?.files[0]?.outputStartLine).toBe(3);
    expect(parsed.sections[0]?.files[0]?.outputEndLine).toBe(5);
    expect(parsed.sections[1]?.files[0]?.outputStartLine).toBe(3);
    expect(parsed.sections[1]?.files[0]?.outputEndLine).toBe(4);
  });

  test("retains optional shared handover metadata when present", () => {
    const manifest = sampleManifest();
    manifest.handoverFile = "demo-handover.xml.txt";
    const parsed = parseManifestJson(renderManifestJson(manifest));
    expect(parsed.handoverFile).toBe("demo-handover.xml.txt");
  });

  test("retains derived review exports when present", () => {
    const parsed = parseManifestJson(renderManifestJson(sampleManifest()));
    expect(parsed.derivedReviewExports?.[0]?.storedPath).toBe(
      "demo-docs-exports/manual.mmd.md",
    );
    expect(parsed.derivedReviewExports?.[0]?.trustClassification).toBe(
      "derived_review_export",
    );
  });
});
