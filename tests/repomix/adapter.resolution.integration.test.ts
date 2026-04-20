// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  getAdapterModulePath,
  setAdapterPath,
} from "../../src/adapter/capabilities.js";
import { renderSectionWithAdapterOracle } from "../../src/adapter/oracleRender.js";
import { createRenderFixture, writeMockRepomixAdapter } from "./helpers.js";

const DEFAULT_ADAPTER_PATH = getAdapterModulePath();

afterEach(() => {
  setAdapterPath(DEFAULT_ADAPTER_PATH);
});

describe("Repomix adapter filesystem resolution (integration)", () => {
  test("resolves a directory-backed adapter module and captures output spans", async () => {
    const fixture = await createRenderFixture();
    const adapterDir = path.join(fixture.rootDir, "mock-adapter");
    await fs.mkdir(adapterDir, { recursive: true });
    await writeMockRepomixAdapter(adapterDir, {
      withPackStructured: true,
      withRenderWithMap: true,
      withPack: false,
    });
    setAdapterPath(adapterDir);

    const result = await renderSectionWithAdapterOracle({
      config: fixture.config,
      style: "markdown",
      sourceRoot: fixture.rootDir,
      outputPath: fixture.outputPath,
      sectionName: "src",
      explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
      requireOutputSpans: true,
    });

    expect(result.fileSpans?.get("src/index.ts")).toEqual({
      outputStartLine: 3,
      outputEndLine: 4,
    });
    expect(await fs.readFile(fixture.outputPath, "utf8")).toContain("alpha");
  });
});
