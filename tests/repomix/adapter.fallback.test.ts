// test-lane: adversarial

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  getAdapterCapabilities,
  getAdapterModulePath,
  setAdapterPath,
} from "../../src/adapter/capabilities.js";
import { renderSectionWithAdapterOracle } from "../../src/adapter/oracleRender.js";
import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { createRenderFixture, writeMockRepomixAdapter } from "./helpers.js";

const DEFAULT_ADAPTER_PATH = getAdapterModulePath();
const mockAdapterDirs: string[] = [];

async function installMockAdapter(options: {
  withPackStructured: boolean;
  withRenderWithMap: boolean;
  withPack: boolean;
}): Promise<void> {
  const adapterDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-repomix-adapter-"),
  );
  mockAdapterDirs.push(adapterDir);
  await writeMockRepomixAdapter(adapterDir, options);
  setAdapterPath(pathToFileURL(path.join(adapterDir, "index.js")).href);
}

afterEach(async () => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  setAdapterPath(DEFAULT_ADAPTER_PATH);
  await Promise.all(
    mockAdapterDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("Repomix adapter fallback behavior", () => {
  test("captures output spans for markdown and plain styles when renderWithMap is available", async () => {
    const fixture = await createRenderFixture();
    await installMockAdapter({
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

  test("warns when output spans are unavailable and fails when they are required", async () => {
    const fixture = await createRenderFixture();
    await installMockAdapter({
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

  test("throws when neither packStructured nor pack is available", async () => {
    const fixture = await createRenderFixture();
    await installMockAdapter({
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

  test("bundling stays native when structured adapter support is unavailable", async () => {
    const fixture = await createRenderFixture();
    await installMockAdapter({
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

    const capabilities = await getAdapterCapabilities();
    expect(capabilities.oracleAdapter.contractValid).toBe(true);
    expect(capabilities.capabilities.supportsPackStructured).toBe(false);
    expect(capabilities.spanCapability).toBe("unsupported");
    expect(capture.stderr()).toBe("");
  });

  test("renderSectionWithAdapterOracle falls back to pack when structured rendering is unavailable", async () => {
    const fixture = await createRenderFixture({
      config: {
        manifest: {
          includeOutputSpans: false,
        },
      },
    });
    await installMockAdapter({
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
