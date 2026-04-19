// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  getAdapterModulePath,
  setAdapterPath,
} from "../../src/repomix/capabilities.js";
import { renderSection } from "../../src/repomix/section.js";
import {
  createRenderFixture,
  writeMockRepomixAdapter,
} from "../repomix/helpers.js";

const DEFAULT_ADAPTER_PATH = getAdapterModulePath();
const TEMP_PATHS: string[] = [];

afterEach(async () => {
  setAdapterPath(DEFAULT_ADAPTER_PATH);
  await Promise.all(
    TEMP_PATHS.splice(0).map((tmpPath) =>
      fs.rm(tmpPath, { recursive: true, force: true }),
    ),
  );
});

describe("renderSection", () => {
  test("renders a section through the configured adapter", async () => {
    const adapterDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-render-adapter-"),
    );
    TEMP_PATHS.push(adapterDir);
    await writeMockRepomixAdapter(adapterDir, {
      withPackStructured: true,
      withRenderWithMap: true,
      withPack: false,
    });
    setAdapterPath(adapterDir);

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
    expect(result.content).toContain("alpha");
  });
});
