// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  getOracleAdapterModulePath,
  setOracleAdapterPath,
} from "../../src/adapter/capabilities.js";
import { renderSectionWithAdapterOracle } from "../../src/adapter/oracleRender.js";
import {
  createRenderFixture,
  writeMockReferenceOracleAdapter,
} from "./helpers.js";

const DEFAULT_ADAPTER_PATH = getOracleAdapterModulePath();

afterEach(() => {
  setOracleAdapterPath(DEFAULT_ADAPTER_PATH);
});

describe("reference-oracle filesystem resolution (integration)", () => {
  test("resolves a directory-backed oracle module and captures output spans", async () => {
    const fixture = await createRenderFixture();
    const oracleDir = path.join(fixture.rootDir, "mock-reference-oracle");
    await fs.mkdir(oracleDir, { recursive: true });
    await writeMockReferenceOracleAdapter(oracleDir, {
      withPackStructured: true,
      withRenderWithMap: true,
      withPack: false,
    });
    setOracleAdapterPath(oracleDir);

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
