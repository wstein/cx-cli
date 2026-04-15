import { describe, expect, test } from "bun:test";

import {
  formatBytes,
  formatNumber,
  printHeader,
  printTable,
  printSuccess,
} from "../../src/shared/format.js";

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
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printHeader("Unit Test");
      expect(out.length).toBe(1);
      expect(out[0]).toContain("📦 Unit Test");
    } finally {
      console.log = originalLog;
    }
  });

  test("printTable prints padded key/value rows", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printTable([
        ["Alpha", "one"],
        ["Beta", "two"],
      ]);
      expect(out.length).toBe(2);
      expect(out[0]).toContain("Alpha");
      expect(out[0]).toContain("one");
      expect(out[1]).toContain("Beta");
      expect(out[1]).toContain("two");
    } finally {
      console.log = originalLog;
    }
  });

  test("printSuccess prints a green success message", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printSuccess("done");
      expect(out.length).toBe(1);
      expect(out[0]).toContain("✓");
      expect(out[0]).toContain("done");
    } finally {
      console.log = originalLog;
    }
  });
});