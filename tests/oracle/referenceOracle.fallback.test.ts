// test-lane: integration

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  getOracleAdapterCapabilities,
  getOracleAdapterModulePath,
  setOracleAdapterPath,
} from "../../src/adapter/capabilities.js";
import { renderSectionWithAdapterOracle } from "../../src/adapter/oracleRender.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import {
  createRenderFixture,
  writeMockReferenceOracleAdapter,
} from "./helpers.js";

const DEFAULT_ADAPTER_PATH = getOracleAdapterModulePath();
const mockOracleDirs: string[] = [];

async function installMockReferenceOracle(options: {
  withPackStructured: boolean;
  withRenderWithMap: boolean;
  withPack: boolean;
}): Promise<void> {
  const oracleDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-reference-oracle-"),
  );
  mockOracleDirs.push(oracleDir);
  await writeMockReferenceOracleAdapter(oracleDir, options);
  setOracleAdapterPath(pathToFileURL(path.join(oracleDir, "index.js")).href);
}

afterEach(async () => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  setOracleAdapterPath(DEFAULT_ADAPTER_PATH);
  await Promise.all(
    mockOracleDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("reference-oracle fallback behavior", () => {
  test("captures output spans for markdown and plain styles when oracle renderWithMap is available", async () => {
    const fixture = await createRenderFixture();
    await installMockReferenceOracle({
      withPackStructured: true,
      withRenderWithMap: true,
      withPack: false,
    });

    const markdownResult = await renderSectionWithAdapterOracle({
      config: fixture.config,
      style: "markdown",
      sourceRoot: fixture.rootDir,
      outputPath: fixture.outputPath,
      sectionName: "src",
      explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
      requireOutputSpans: true,
    });
    expect(markdownResult.fileSpans?.get("src/index.ts")).toEqual({
      outputStartLine: 3,
      outputEndLine: 4,
    });

    const plainResult = await renderSectionWithAdapterOracle({
      config: fixture.config,
      style: "plain",
      sourceRoot: fixture.rootDir,
      outputPath: fixture.outputPath,
      sectionName: "src",
      explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
      requireOutputSpans: true,
    });
    expect(plainResult.fileSpans?.get("src/index.ts")).toEqual({
      outputStartLine: 4,
      outputEndLine: 5,
    });
  });

  test("warns when oracle output spans are unavailable and fails when they are required", async () => {
    const fixture = await createRenderFixture();
    await installMockReferenceOracle({
      withPackStructured: true,
      withRenderWithMap: false,
      withPack: false,
    });

    const capture = createBufferedCommandIo();
    const renderExitCode = await (async () => {
      const result = await renderSectionWithAdapterOracle({
        config: fixture.config,
        style: "markdown",
        sourceRoot: fixture.rootDir,
        outputPath: fixture.outputPath,
        sectionName: "src",
        explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
        io: capture.io,
      });
      expect(result.fileSpans?.size).toBe(0);
      return 0;
    })();
    expect(renderExitCode).toBe(0);
    expect(capture.stderr()).toContain("Exact output spans are unavailable");

    await expect(
      renderSectionWithAdapterOracle({
        config: fixture.config,
        style: "markdown",
        sourceRoot: fixture.rootDir,
        outputPath: fixture.outputPath,
        sectionName: "src",
        explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
        requireOutputSpans: true,
      }),
    ).rejects.toThrow("Text sections require exact output spans");
  });

  test("throws when the oracle exports neither packStructured nor pack", async () => {
    const fixture = await createRenderFixture();
    await installMockReferenceOracle({
      withPackStructured: false,
      withRenderWithMap: false,
      withPack: false,
    });

    await expect(
      renderSectionWithAdapterOracle({
        config: fixture.config,
        style: "xml",
        sourceRoot: fixture.rootDir,
        outputPath: fixture.outputPath,
        sectionName: "src",
        explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
      }),
    ).rejects.toThrow(
      "neither packStructured() nor pack() is available for rendering",
    );
  });

  test("bundling stays native when structured oracle support is unavailable", async () => {
    const fixture = await createRenderFixture();
    await installMockReferenceOracle({
      withPackStructured: false,
      withRenderWithMap: false,
      withPack: true,
    });

    const capture = createBufferedCommandIo();
    const exitCode = await runBundleCommand(
      { config: fixture.configPath },
      capture.io,
    );

    expect(exitCode).toBe(0);

    const capabilities = await getOracleAdapterCapabilities();
    expect(capabilities.oracleAdapter.contractValid).toBe(true);
    expect(capabilities.capabilities.supportsPackStructured).toBe(false);
    expect(capabilities.spanCapability).toBe("unsupported");
    expect(capture.stderr()).toBe("");
  });

  test("renderSectionWithAdapterOracle falls back to pack when structured oracle rendering is unavailable", async () => {
    const fixture = await createRenderFixture({
      config: {
        manifest: {
          includeOutputSpans: false,
        },
      },
    });
    await installMockReferenceOracle({
      withPackStructured: false,
      withRenderWithMap: false,
      withPack: true,
    });

    const result = await renderSectionWithAdapterOracle({
      config: fixture.config,
      style: "xml",
      sourceRoot: fixture.rootDir,
      outputPath: fixture.outputPath,
      sectionName: "src",
      explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
    });

    expect(result.outputText).toContain('<file path="src/index.ts">');
    expect(result.outputTokenCount).toBeGreaterThan(0);
    expect(result.fileTokenCounts.get("src/index.ts")).toBeGreaterThan(0);
  });
});
