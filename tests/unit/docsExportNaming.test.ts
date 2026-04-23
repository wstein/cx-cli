// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  pruneEmptyLogOutput,
  resolveDocsExportExtension,
} from "../../src/docs/export.js";

describe("docs export naming", () => {
  test("uses .mmd for multimarkdown exports", () => {
    expect(resolveDocsExportExtension("multimarkdown")).toBe(".mmd");
  });

  test("uses .md for other markdown flavors", () => {
    expect(resolveDocsExportExtension("commonmark")).toBe(".md");
    expect(resolveDocsExportExtension("gfm")).toBe(".md");
    expect(resolveDocsExportExtension("gitlab")).toBe(".md");
    expect(resolveDocsExportExtension("strict")).toBe(".md");
  });

  test("removes empty log output files", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-docs-export-log-"),
    );
    const logPath = path.join(tempDir, "antora-export.log.txt");
    await fs.writeFile(logPath, "", "utf8");

    await pruneEmptyLogOutput(logPath);

    await expect(fs.stat(logPath)).rejects.toThrow();
  });

  test("keeps non-empty log output files", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "cx-docs-export-log-"),
    );
    const logPath = path.join(tempDir, "antora-export.log.txt");
    await fs.writeFile(logPath, "warning\n", "utf8");

    await pruneEmptyLogOutput(logPath);

    await expect(fs.readFile(logPath, "utf8")).resolves.toBe("warning\n");
  });
});
