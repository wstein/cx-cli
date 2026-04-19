// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { CxConfig } from "../../src/config/types.js";
import { buildMasterList } from "../../src/planning/masterList.js";
import type { VCSState } from "../../src/vcs/provider.js";

let testDir: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-ml-test-"));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

function makeConfig(overrides: Partial<CxConfig> = {}): CxConfig {
  return {
    schemaVersion: 1,
    projectName: "test",
    sourceRoot: testDir,
    outputDir: path.join(testDir, "dist"),
    output: {
      extensions: {
        xml: ".xml.txt",
        json: ".json.txt",
        markdown: ".md",
        plain: ".txt",
      },
    },
    repomix: {
      style: "xml",
      showLineNumbers: false,
      includeEmptyDirectories: false,
      securityCheck: false,
    },
    files: {
      include: [],
      exclude: [],
      followSymlinks: false,
      unmatched: "ignore",
    },
    dedup: { mode: "fail", order: "config" },
    manifest: {
      format: "json",
      pretty: false,
      includeFileSha256: false,
      includeOutputSha256: false,
      includeOutputSpans: false,
      includeSourceMetadata: false,
      includeLinkedNotes: false,
    },
    checksums: { algorithm: "sha256", fileName: "test.sha256" },
    tokens: { encoding: "o200k_base" },
    assets: {
      include: [],
      exclude: [],
      mode: "copy",
      targetDir: "assets",
      layout: "flat",
    },
    behavior: { repomixMissingExtension: "warn", configDuplicateEntry: "fail" },
    behaviorSources: {
      dedupMode: "compiled default",
      repomixMissingExtension: "compiled default",
      configDuplicateEntry: "compiled default",
      assetsLayout: "compiled default",
    },
    mcp: { policy: "default", auditLogging: false },
    sections: { main: { include: ["src/**"], exclude: [] } },
    ...overrides,
  } as CxConfig;
}

function vcs(trackedFiles: string[] = []): VCSState {
  return { trackedFiles } as unknown as VCSState;
}

describe("buildMasterList", () => {
  test("returns VCS-tracked files sorted lexically", async () => {
    const config = makeConfig();
    const result = await buildMasterList(config, vcs(["c.ts", "a.ts", "b.ts"]));
    expect(result).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  test("empty VCS list → empty result", async () => {
    const result = await buildMasterList(makeConfig(), vcs([]));
    expect(result).toEqual([]);
  });

  test("files.exclude strips matching files", async () => {
    const config = makeConfig({
      files: {
        include: [],
        exclude: ["node_modules/**"],
        followSymlinks: false,
        unmatched: "ignore",
      },
    });
    const result = await buildMasterList(
      config,
      vcs(["src/a.ts", "node_modules/pkg/index.js"]),
    );
    expect(result).toEqual(["src/a.ts"]);
    expect(result).not.toContain("node_modules/pkg/index.js");
  });

  test("output dir inside source root is always excluded", async () => {
    const config = makeConfig({
      outputDir: path.join(testDir, "dist"),
      files: {
        include: [],
        exclude: [],
        followSymlinks: false,
        unmatched: "ignore",
      },
    });
    const result = await buildMasterList(
      config,
      vcs(["src/a.ts", "dist/bundle.xml"]),
    );
    expect(result).toContain("src/a.ts");
    expect(result).not.toContain("dist/bundle.xml");
  });

  test("output dir outside source root does not exclude extra files", async () => {
    const config = makeConfig({
      sourceRoot: testDir,
      outputDir: path.join(os.tmpdir(), "external-out"),
      files: {
        include: [],
        exclude: [],
        followSymlinks: false,
        unmatched: "ignore",
      },
    });
    const result = await buildMasterList(
      config,
      vcs(["src/a.ts", "dist/local.txt"]),
    );
    expect(result).toContain("src/a.ts");
    expect(result).toContain("dist/local.txt");
  });

  test("files.include extends master set with disk files not in VCS", async () => {
    await fs.mkdir(path.join(testDir, "gen"), { recursive: true });
    await fs.writeFile(path.join(testDir, "gen", "output.ts"), "");

    const config = makeConfig({
      files: {
        include: ["gen/**"],
        exclude: [],
        followSymlinks: false,
        unmatched: "ignore",
      },
    });
    const result = await buildMasterList(config, vcs(["src/a.ts"]));
    expect(result).toContain("src/a.ts");
    expect(result).toContain("gen/output.ts");
  });

  test("files.include does not add files already in VCS (deduped)", async () => {
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });
    await fs.writeFile(path.join(testDir, "src", "a.ts"), "");

    const config = makeConfig({
      files: {
        include: ["src/**"],
        exclude: [],
        followSymlinks: false,
        unmatched: "ignore",
      },
    });
    const result = await buildMasterList(config, vcs(["src/a.ts"]));
    expect(result.filter((f) => f === "src/a.ts")).toHaveLength(1);
  });

  test("files.exclude and output dir both apply", async () => {
    const config = makeConfig({
      outputDir: path.join(testDir, "dist"),
      files: {
        include: [],
        exclude: ["*.log"],
        followSymlinks: false,
        unmatched: "ignore",
      },
    });
    const result = await buildMasterList(
      config,
      vcs(["src/a.ts", "dist/bundle.xml", "debug.log"]),
    );
    expect(result).toEqual(["src/a.ts"]);
  });
});
