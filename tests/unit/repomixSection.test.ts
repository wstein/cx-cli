// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  getOracleAdapterModulePath,
  setOracleAdapterPath,
} from "../../src/adapter/capabilities.js";
import { renderSection } from "../../src/adapter/section.js";
import {
  createRenderFixture,
  writeMockReferenceOracleAdapter,
} from "../repomix/helpers.js";

const DEFAULT_ADAPTER_PATH = getOracleAdapterModulePath();
const TEMP_PATHS: string[] = [];

afterEach(async () => {
  setOracleAdapterPath(DEFAULT_ADAPTER_PATH);
  await Promise.all(
    TEMP_PATHS.splice(0).map((tmpPath) =>
      fs.rm(tmpPath, { recursive: true, force: true }),
    ),
  );
});

describe("renderSection", () => {
  test("renders a section through the configured render path", async () => {
    const adapterDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-render-adapter-"),
    );
    TEMP_PATHS.push(adapterDir);
    await writeMockReferenceOracleAdapter(adapterDir, {
      withPackStructured: true,
      withRenderWithMap: true,
      withPack: false,
    });
    setOracleAdapterPath(adapterDir);

    const fixture = await createRenderFixture();
    TEMP_PATHS.push(fixture.rootDir);

    const result = await renderSection({
      config: fixture.config,
      section: "src",
      style: "markdown",
      sourceRoot: fixture.rootDir,
      files: [path.join(fixture.rootDir, "src", "index.ts")],
    });

    expect(result.fileCount).toBe(1);
    expect(result.style).toBe("markdown");
    expect(result.tokenCount).toBe(7);
    expect(result.content).toContain("## File: src/index.ts");
    expect(result.content).toContain("export const ok = 1;");
  });
});
