// test-lane: integration
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

import { loadManifestFromBundle } from "../../src/bundle/validate.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import {
  MANIFEST_SCHEMA_VERSION,
  parseManifestJson,
  renderManifestJson,
} from "../../src/manifest/json.js";
import type { CxManifest } from "../../src/manifest/types.js";
import { createProject } from "./helpers.js";

describe("bundle manifest", () => {
  test("records note summaries in the manifest", async () => {
    const project = await createProject();
    await fs.mkdir(path.join(project.root, "notes"), { recursive: true });
    await fs.writeFile(
      path.join(project.root, "notes", "summary-note.md"),
      `---
id: 20260413123030
aliases: []
tags: []
---

# Summary Note

This note explains the first useful idea.
It should become the manifest summary.

## Links

- [[README.md]] - related context
`,
      "utf8",
    );

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    expect(manifest.notes).toHaveLength(1);
    expect(manifest.notes?.[0]?.summary).toBe(
      "This note explains the first useful idea. It should become the manifest summary.",
    );
    expect(manifest.notes?.[0]?.trustLevel).toBe("conditional");
    expect(manifest.notes?.[0]?.cognitionScore).toBeGreaterThan(0);
    expect(manifest.trustModel.notes).toBe("conditional");
    expect(manifest.traceability.agent.auditLogPath).toBe(".cx/audit.log");
  });

  test("pulls linked notes into the bundle when enabled", async () => {
    const project = await createProject({ includeLinkedNotes: true });

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    const docsSection = manifest.sections.find(
      (section) => section.name === "docs",
    );
    expect(docsSection?.files.map((file) => file.path)).toContain(
      "notes/linked-note.md",
    );
    const linkedNote = docsSection?.files.find(
      (file) => file.path === "notes/linked-note.md",
    );
    const guide = docsSection?.files.find(
      (file) => file.path === "docs/guide.md",
    );
    expect(linkedNote?.provenance).toEqual([
      "linked_note_enrichment",
      "manifest_note_inclusion",
    ]);
    expect(guide?.provenance).toEqual(["section_match"]);

    const docsOutput = await fs.readFile(
      path.join(project.bundleDir, docsSection?.outputFile ?? ""),
      "utf8",
    );
    expect(docsOutput).toContain("This note is linked from source code.");
  });

  test("records asset provenance in manifest outputs", async () => {
    const project = await createProject();

    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const { manifest } = await loadManifestFromBundle(project.bundleDir);
    expect(manifest.assets[0]?.provenance).toEqual(["asset_rule_match"]);
    const assetRow = manifest.files.find((file) => file.path === "logo.png");
    expect(assetRow?.provenance).toEqual(["asset_rule_match"]);
  });

  test("nests files inside their section in the JSON manifest", () => {
    const manifest: CxManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      bundleVersion: 1,
      projectName: "demo",
      sourceRoot: "/tmp",
      bundleDir: "/tmp/out",
      checksumFile: "demo.sha256",
      createdAt: new Date().toISOString(),
      cxVersion: "0.1.0",
      repomixVersion: "1.13.1",
      checksumAlgorithm: "sha256",
      settings: {
        globalStyle: "xml",
        tokenEncoding: "o200k_base",
        showLineNumbers: false,
        includeEmptyDirectories: false,
        securityCheck: false,
        normalizationPolicy: "repomix-default-v1",
        includeLinkedNotes: false,
      },
      totalTokenCount: 20,
      vcsProvider: "none",
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
        notes: {
          governanceCommand: "cx notes check",
          trustLevel: "conditional",
        },
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
          outputFile: "myproject-repomix-docs.xml.txt",
          outputSha256: "aaa",
          fileCount: 2,
          tokenCount: 7,
          files: [
            {
              path: "docs/a.md",
              kind: "text",
              section: "docs",
              storedIn: "packed",
              sha256: "sha1",
              sizeBytes: 1,
              tokenCount: 3,
              mtime: "2026-04-11T00:00:00.000Z",
              mediaType: "text/markdown",
              outputStartLine: 5,
              outputEndLine: 5,
              provenance: ["section_match"],
            },
            {
              path: "docs/b.md",
              kind: "text",
              section: "docs",
              storedIn: "packed",
              sha256: "sha2",
              sizeBytes: 1,
              tokenCount: 4,
              mtime: "2026-04-11T00:00:00.000Z",
              mediaType: "text/markdown",
              outputStartLine: 6,
              outputEndLine: 6,
              provenance: ["section_match"],
            },
          ],
        },
        {
          name: "src",
          style: "xml",
          outputFile: "myproject-repomix-src.xml.txt",
          outputSha256: "bbb",
          fileCount: 1,
          tokenCount: 5,
          files: [
            {
              path: "src/c.ts",
              kind: "text",
              section: "src",
              storedIn: "packed",
              sha256: "sha3",
              sizeBytes: 1,
              tokenCount: 5,
              mtime: "2026-04-11T00:00:00.000Z",
              mediaType: "text/typescript",
              outputStartLine: 10,
              outputEndLine: 10,
              provenance: ["section_match"],
            },
          ],
        },
      ],
      assets: [
        {
          sourcePath: "logo.png",
          storedPath: "assets/logo.png",
          sha256: "ccc",
          sizeBytes: 7,
          mtime: "2026-04-11T00:00:00.000Z",
          mediaType: "image/png",
          provenance: ["asset_rule_match"],
        },
      ],
      files: [],
    };

    const rendered = renderManifestJson(manifest);
    expect(rendered.indexOf("docs")).toBeLessThan(rendered.indexOf("src"));
    expect(rendered.indexOf("myproject-repomix-docs.xml.txt")).toBeLessThan(
      rendered.indexOf("docs/a.md"),
    );
    expect(rendered.indexOf("docs/a.md")).toBeLessThan(
      rendered.indexOf("docs/b.md"),
    );
    expect(rendered.indexOf("myproject-repomix-src.xml.txt")).toBeLessThan(
      rendered.indexOf("src/c.ts"),
    );

    const reparsed = parseManifestJson(rendered);
    expect(reparsed.sections).toHaveLength(2);
    expect(reparsed.sections[0]?.files).toHaveLength(2);
    expect(reparsed.sections[1]?.files).toHaveLength(1);
    expect(reparsed.sections[0]?.files[0]?.path).toBe("docs/a.md");
    expect(reparsed.sections[0]?.files[0]?.provenance).toEqual([
      "section_match",
    ]);
    expect(reparsed.assets[0]?.provenance).toEqual(["asset_rule_match"]);
  });

  test("manifest file is valid JSON with correct schemaVersion and object-list structure", async () => {
    const project = await createProject();
    expect(await runBundleCommand({ config: project.configPath })).toBe(0);

    const entries = await fs.readdir(project.bundleDir);
    const manifestName = entries.find((entry) =>
      entry.endsWith("-manifest.json"),
    );
    expect(manifestName).toBeDefined();

    const source = await fs.readFile(
      path.join(project.bundleDir, manifestName as string),
      "utf8",
    );
    const parsed = JSON.parse(source) as Record<string, unknown>;

    expect(parsed.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);

    const sections = parsed.sections as Array<{ files?: unknown[] }>;
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.files).toBeDefined();
      expect(Array.isArray(section.files)).toBe(true);
    }
  });
});
