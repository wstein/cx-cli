// test-lane: unit
import { describe, expect, test } from "vitest";

import {
  normalizeText,
  sha256NormalizedText,
  sha256Text,
} from "../../src/shared/hashing.js";

describe("shared hashing utilities", () => {
  test("sha256Text produces hex digest for string input", () => {
    const result = sha256Text("hello world");
    expect(typeof result).toBe("string");
    expect(result.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  test("sha256Text produces consistent hashes", () => {
    const hash1 = sha256Text("consistent");
    const hash2 = sha256Text("consistent");
    expect(hash1).toBe(hash2);
  });

  test("sha256Text produces different hashes for different inputs", () => {
    const hash1 = sha256Text("input1");
    const hash2 = sha256Text("input2");
    expect(hash1).not.toBe(hash2);
  });

  test("normalizeText converts CRLF and CR to LF", () => {
    expect(normalizeText("line1\r\nline2")).toBe("line1\nline2");
    expect(normalizeText("line1\rline2")).toBe("line1\nline2");
    expect(normalizeText("line1\nline2")).toBe("line1\nline2");
  });

  test("normalizeText handles mixed line endings", () => {
    expect(normalizeText("line1\r\nline2\rline3\nline4")).toBe(
      "line1\nline2\nline3\nline4",
    );
  });

  test("normalizeText is idempotent", () => {
    const text = "line1\r\nline2\nline3";
    const normalized1 = normalizeText(text);
    const normalized2 = normalizeText(normalized1);
    expect(normalized1).toBe(normalized2);
  });

  test("sha256NormalizedText normalizes before hashing", () => {
    const textCRLF = "hello\r\nworld";
    const textLF = "hello\nworld";
    const textCR = "hello\rworld";
    expect(sha256NormalizedText(textCRLF)).toBe(sha256NormalizedText(textLF));
    expect(sha256NormalizedText(textLF)).toBe(sha256NormalizedText(textCR));
  });

  test("sha256NormalizedText handles empty strings", () => {
    const result = sha256NormalizedText("");
    expect(result.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });
});
