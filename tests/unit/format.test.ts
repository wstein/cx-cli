// test-lane: unit
import { describe, expect, test } from "vitest";

import {
  formatBytes,
  formatNumber,
  formatSectionStats,
  printBundleSummary,
  printDivider,
  printError,
  printHeader,
  printInfo,
  printProgress,
  printStat,
  printSubheader,
  printSuccess,
  printTable,
  printWarning,
} from "../../src/shared/format.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("shared format utilities", () => {
  test("formatBytes formats zero and multiples correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512.0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });

  test("formatNumber inserts commas for large values", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  test("printHeader prints a styled section header", () => {
    const capture = createBufferedCommandIo();

    printHeader("Unit Test", capture.io);
    const out = capture.logs();
    expect(out).toContain("📦 Unit Test");
  });

  test("printTable prints padded key/value rows", () => {
    const capture = createBufferedCommandIo();

    printTable(
      [
        ["Alpha", "one"],
        ["Beta", "two"],
      ],
      capture.io,
    );
    const out = capture.logs().split("\n");
    expect(out.length).toBe(2);
    expect(out[0]).toContain("Alpha");
    expect(out[0]).toContain("one");
    expect(out[1]).toContain("Beta");
    expect(out[1]).toContain("two");
  });

  test("printSuccess prints a green success message", () => {
    const capture = createBufferedCommandIo();

    printSuccess("done", capture.io);
    const out = capture.logs().split("\n");
    expect(out.length).toBe(1);
    expect(out[0]).toContain("✓");
    expect(out[0]).toContain("done");
  });

  test("printSubheader prints a simple subsection label", () => {
    const capture = createBufferedCommandIo();

    printSubheader("Details", capture.io);
    const out = capture.logs().split("\n");
    expect(out.length).toBe(1);
    expect(out[0]).toContain("Details");
    expect(out[0]).toContain("  ");
  });

  test("printStat emits a label/value row", () => {
    const capture = createBufferedCommandIo();

    printStat("Count", 42, capture.io);
    const out = capture.logs().split("\n");
    expect(out.length).toBe(1);
    expect(out[0]).toContain("Count");
    expect(out[0]).toContain("42");
  });

  test("printWarning prints a warning message", () => {
    const capture = createBufferedCommandIo();

    printWarning("be careful", capture.io);
    const out = capture.logs().split("\n");
    expect(out.length).toBe(1);
    expect(out[0]).toContain("⚠");
    expect(out[0]).toContain("be careful");
  });

  test("printInfo prints an informational message", () => {
    const capture = createBufferedCommandIo();

    printInfo("note", capture.io);
    const out = capture.logs().split("\n");
    expect(out.length).toBe(1);
    expect(out[0]).toContain("ℹ");
    expect(out[0]).toContain("note");
  });

  test("printError prints an error message", () => {
    const capture = createBufferedCommandIo();

    printError("failed", capture.io);
    const out = capture.logs().split("\n");
    expect(out.length).toBe(1);
    expect(out[0]).toContain("✗");
    expect(out[0]).toContain("failed");
  });

  test("printProgress renders a progress bar and percentage", () => {
    const capture = createBufferedCommandIo();

    printProgress(5, 10, "Loading", capture.io);
    const out = capture.logs().split("\n");
    expect(out.length).toBe(1);
    expect(out[0]).toContain("50%");
    expect(out[0]).toContain("Loading");
  });

  test("printDivider prints a divider line", () => {
    const capture = createBufferedCommandIo();

    printDivider(capture.io);
    const out = capture.logs().split("\n");
    expect(out.length).toBe(1);
    expect(out[0]).toContain("─");
  });

  test("formatSectionStats returns formatted stats lines", () => {
    const lines = formatSectionStats("section", 3, 2048, 1500);
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain("section");
    expect(lines[1]).toContain("Files");
    expect(lines[1]).toContain("3");
    expect(lines[2]).toContain("Size");
    expect(lines[3]).toContain("Tokens");
    expect(lines[3]).toContain("1,500");
  });

  test("printBundleSummary prints header and stats sections", () => {
    const capture = createBufferedCommandIo();

    printBundleSummary("myproj", "/tmp/bundle", 4, 2, 4096, 1024, capture.io);
    const out = capture.logs().split("\n");
    expect(
      out.some((line) => line.includes("Bundle Created Successfully")),
    ).toBe(true);
    expect(out.some((line) => line.includes("Project"))).toBe(true);
    expect(out.some((line) => line.includes("Sections"))).toBe(true);
    expect(out.some((line) => line.includes("Assets"))).toBe(true);
  });
});
