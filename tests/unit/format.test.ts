import { describe, expect, test } from "bun:test";

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

  test("printSubheader prints a simple subsection label", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printSubheader("Details");
      expect(out.length).toBe(1);
      expect(out[0]).toContain("Details");
      expect(out[0]).toContain("  ");
    } finally {
      console.log = originalLog;
    }
  });

  test("printStat emits a label/value row", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printStat("Count", 42);
      expect(out.length).toBe(1);
      expect(out[0]).toContain("Count");
      expect(out[0]).toContain("42");
    } finally {
      console.log = originalLog;
    }
  });

  test("printWarning prints a warning message", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printWarning("be careful");
      expect(out.length).toBe(1);
      expect(out[0]).toContain("⚠");
      expect(out[0]).toContain("be careful");
    } finally {
      console.log = originalLog;
    }
  });

  test("printInfo prints an informational message", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printInfo("note");
      expect(out.length).toBe(1);
      expect(out[0]).toContain("ℹ");
      expect(out[0]).toContain("note");
    } finally {
      console.log = originalLog;
    }
  });

  test("printError prints an error message", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printError("failed");
      expect(out.length).toBe(1);
      expect(out[0]).toContain("✗");
      expect(out[0]).toContain("failed");
    } finally {
      console.log = originalLog;
    }
  });

  test("printProgress renders a progress bar and percentage", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printProgress(5, 10, "Loading");
      expect(out.length).toBe(1);
      expect(out[0]).toContain("50%");
      expect(out[0]).toContain("Loading");
    } finally {
      console.log = originalLog;
    }
  });

  test("printDivider prints a divider line", () => {
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printDivider();
      expect(out.length).toBe(1);
      expect(out[0]).toContain("─");
    } finally {
      console.log = originalLog;
    }
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
    const originalLog = console.log;
    const out: string[] = [];
    console.log = (message?: any) => {
      out.push(String(message));
    };

    try {
      printBundleSummary("myproj", "/tmp/bundle", 4, 2, 4096, 1024);
      expect(out.some((line) => line.includes("Bundle Created Successfully"))).toBe(true);
      expect(out.some((line) => line.includes("Project"))).toBe(true);
      expect(out.some((line) => line.includes("Sections"))).toBe(true);
      expect(out.some((line) => line.includes("Assets"))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });
});