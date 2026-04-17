import { describe, expect, it } from "bun:test";
import { asError, CxError } from "../../src/shared/errors.js";
import {
  normalizeText,
  sha256NormalizedText,
  sha256Text,
} from "../../src/shared/hashing.js";
import { detectMediaType } from "../../src/shared/mime.js";

describe("shared utilities - errors, hashing, and media type", () => {
  describe("CxError", () => {
    it("creates error with default exit code", () => {
      const error = new CxError("Something went wrong");
      expect(error.message).toBe("Something went wrong");
      expect(error.exitCode).toBe(2);
      expect(error.name).toBe("CxError");
    });

    it("creates error with custom exit code", () => {
      const error = new CxError("Not authorized", 401);
      expect(error.message).toBe("Not authorized");
      expect(error.exitCode).toBe(401);
    });

    it("includes cause in error options", () => {
      const cause = new Error("Root cause");
      const error = new CxError("Wrapper error", 1, { cause });
      expect(error.cause).toBe(cause);
    });

    it("has correct name for discrimination", () => {
      const error = new CxError("Test");
      expect(error instanceof CxError).toBe(true);
      expect(error.name).toBe("CxError");
    });

    it("supports various exit codes", () => {
      const codes = [0, 1, 2, 8, 127, 255];
      for (const code of codes) {
        const error = new CxError(`Error with code ${code}`, code);
        expect(error.exitCode).toBe(code);
      }
    });

    it("preserves message exactly", () => {
      const messages = [
        "Simple error",
        "Error with: special characters!",
        "Multi\nline\nerror",
        "Error with 'quotes' and \"double quotes\"",
      ];
      for (const message of messages) {
        const error = new CxError(message);
        expect(error.message).toBe(message);
      }
    });
  });

  describe("asError", () => {
    it("returns Error instances unchanged", () => {
      const original = new Error("Test error");
      const result = asError(original);
      expect(result).toBe(original);
    });

    it("returns CxError instances unchanged", () => {
      const original = new CxError("Custom error", 42);
      const result = asError(original);
      expect(result).toBe(original);
    });

    it("wraps string as Error", () => {
      const result = asError("Error message");
      expect(result instanceof Error).toBe(true);
      expect(result.message).toBe("Error message");
    });

    it("wraps number as Error", () => {
      const result = asError(42);
      expect(result instanceof Error).toBe(true);
      expect(result.message).toBe("42");
    });

    it("wraps boolean as Error", () => {
      const result = asError(true);
      expect(result instanceof Error).toBe(true);
      expect(result.message).toBe("true");
    });

    it("wraps null as Error", () => {
      const result = asError(null);
      expect(result instanceof Error).toBe(true);
      expect(result.message).toBe("null");
    });

    it("wraps undefined as Error", () => {
      const result = asError(undefined);
      expect(result instanceof Error).toBe(true);
      expect(result.message).toBe("undefined");
    });

    it("wraps object as Error with string representation", () => {
      const obj = { error: "details", code: 123 };
      const result = asError(obj);
      expect(result instanceof Error).toBe(true);
      expect(result.message).toBe(String(obj));
    });

    it("wraps array as Error", () => {
      const arr = ["error1", "error2"];
      const result = asError(arr);
      expect(result instanceof Error).toBe(true);
      expect(result.message).toBe(arr.toString());
    });
  });

  describe("normalizeText", () => {
    it("converts CRLF to LF", () => {
      expect(normalizeText("line1\r\nline2\r\nline3")).toBe(
        "line1\nline2\nline3",
      );
    });

    it("converts CR to LF", () => {
      expect(normalizeText("line1\rline2\rline3")).toBe("line1\nline2\nline3");
    });

    it("preserves LF as-is", () => {
      expect(normalizeText("line1\nline2\nline3")).toBe("line1\nline2\nline3");
    });

    it("handles mixed line endings", () => {
      expect(normalizeText("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
    });

    it("handles single line without newline", () => {
      expect(normalizeText("single line")).toBe("single line");
    });

    it("handles empty string", () => {
      expect(normalizeText("")).toBe("");
    });

    it("handles only newline characters", () => {
      expect(normalizeText("\r\n\r\n\n")).toBe("\n\n\n");
    });

    it("preserves content around line endings", () => {
      expect(normalizeText("start\r\nend")).toBe("start\nend");
      expect(normalizeText("start\rend")).toBe("start\nend");
    });

    it("handles trailing line endings", () => {
      expect(normalizeText("content\r\n")).toBe("content\n");
      expect(normalizeText("content\r")).toBe("content\n");
    });

    it("does not affect other whitespace", () => {
      expect(normalizeText("  \t  spaces  \t  ")).toBe("  \t  spaces  \t  ");
    });
  });

  describe("sha256Text", () => {
    it("produces consistent hash for same text", () => {
      const text = "Test content";
      const hash1 = sha256Text(text);
      const hash2 = sha256Text(text);
      expect(hash1).toBe(hash2);
    });

    it("produces different hash for different text", () => {
      const hash1 = sha256Text("content1");
      const hash2 = sha256Text("content2");
      expect(hash1).not.toBe(hash2);
    });

    it("produces 64-character hex string (SHA256)", () => {
      const hash = sha256Text("test");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces empty string hash for empty input", () => {
      const hash = sha256Text("");
      expect(hash).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      );
    });

    it("handles Unicode text", () => {
      const hash = sha256Text("你好世界");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles long text", () => {
      const longText = "x".repeat(10000);
      const hash = sha256Text(longText);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("includes all characters in hash", () => {
      const hash1 = sha256Text("abcde");
      const hash2 = sha256Text("abcdf");
      expect(hash1).not.toBe(hash2);
    });

    it("preserves exact content including whitespace", () => {
      const hash1 = sha256Text("  test  ");
      const hash2 = sha256Text("test");
      expect(hash1).not.toBe(hash2);
    });

    it("handles special characters", () => {
      const hash = sha256Text("!@#$%^&*()_+-=[]{}|;:',.<>?/");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles line endings as-is (not normalized)", () => {
      const hash1 = sha256Text("line1\r\nline2");
      const hash2 = sha256Text("line1\nline2");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("sha256NormalizedText", () => {
    it("normalizes line endings before hashing", () => {
      const hash1 = sha256NormalizedText("line1\r\nline2");
      const hash2 = sha256NormalizedText("line1\nline2");
      expect(hash1).toBe(hash2);
    });

    it("normalizes CR to LF before hashing", () => {
      const hash1 = sha256NormalizedText("a\rb\rc");
      const hash2 = sha256NormalizedText("a\nb\nc");
      expect(hash1).toBe(hash2);
    });

    it("produces 64-character hex hash", () => {
      const hash = sha256NormalizedText("test");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles mixed line endings", () => {
      const hash1 = sha256NormalizedText("a\r\nb\rc\nd");
      const hash2 = sha256NormalizedText("a\nb\nc\nd");
      expect(hash1).toBe(hash2);
    });

    it("is consistent across platforms", () => {
      const content = "cross-platform\nfile\ncontent";
      const hash1 = sha256NormalizedText(content);
      const hash2 = sha256NormalizedText(content);
      expect(hash1).toBe(hash2);
    });

    it("differs from non-normalized hash for CRLF content", () => {
      const hash1 = sha256NormalizedText("line\r\nend");
      const hash2 = sha256Text("line\r\nend");
      expect(hash1).not.toBe(hash2);
    });

    it("handles empty string", () => {
      const hash = sha256NormalizedText("");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("preserves non-whitespace content", () => {
      const hash1 = sha256NormalizedText("content");
      const hash2 = sha256NormalizedText("content");
      expect(hash1).toBe(hash2);
    });
  });

  describe("detectMediaType", () => {
    it("detects TypeScript files", () => {
      expect(detectMediaType("file.ts")).toBe("text/typescript");
      expect(detectMediaType("path/to/file.ts")).toBe("text/typescript");
    });

    it("detects JavaScript files", () => {
      expect(detectMediaType("file.js")).toBe("text/javascript");
      expect(detectMediaType("index.js")).toBe("text/javascript");
    });

    it("detects JSON files", () => {
      expect(detectMediaType("data.json")).toBe("application/json");
    });

    it("detects Markdown files", () => {
      expect(detectMediaType("README.md")).toBe("text/markdown");
    });

    it("detects HTML files", () => {
      expect(detectMediaType("index.html")).toBe("text/html");
    });

    it("detects CSS files", () => {
      expect(detectMediaType("style.css")).toBe("text/css");
    });

    it("detects PNG images", () => {
      expect(detectMediaType("image.png")).toBe("image/png");
    });

    it("detects JPEG images", () => {
      expect(detectMediaType("photo.jpg")).toBe("image/jpeg");
      expect(detectMediaType("photo.jpeg")).toBe("image/jpeg");
    });

    it("detects SVG images", () => {
      expect(detectMediaType("logo.svg")).toBe("image/svg+xml");
    });

    it("detects GIF images", () => {
      expect(detectMediaType("animation.gif")).toBe("image/gif");
    });

    it("detects WebP images", () => {
      expect(detectMediaType("image.webp")).toBe("image/webp");
    });

    it("detects PDF documents", () => {
      expect(detectMediaType("document.pdf")).toBe("application/pdf");
    });

    it("detects MP4 video", () => {
      expect(detectMediaType("video.mp4")).toBe("video/mp4");
    });

    it("detects WAV audio", () => {
      expect(detectMediaType("sound.wav")).toBe("audio/wav");
    });

    it("detects MP3 audio", () => {
      expect(detectMediaType("song.mp3")).toBe("audio/mpeg");
    });

    it("detects plain text files", () => {
      expect(detectMediaType("data.txt")).toBe("text/plain");
    });

    it("detects YAML files", () => {
      expect(detectMediaType("config.yaml")).toBe("text/yaml");
      expect(detectMediaType("config.yml")).toBe("text/yaml");
    });

    it("detects TOML files", () => {
      expect(detectMediaType("config.toml")).toBe("text/toml");
    });

    it("is case-insensitive for extensions", () => {
      expect(detectMediaType("FILE.TS")).toBe("text/typescript");
      expect(detectMediaType("FILE.Ts")).toBe("text/typescript");
      expect(detectMediaType("file.TS")).toBe("text/typescript");
    });

    it("handles files with multiple dots", () => {
      expect(detectMediaType("archive.tar.gz")).toBe("application/gzip");
      expect(detectMediaType("data.backup.json")).toBe("application/json");
    });

    it("uses last extension for media type", () => {
      expect(detectMediaType("file.backup.ts")).toBe("text/typescript");
    });

    it("returns application/octet-stream for unknown extensions", () => {
      expect(detectMediaType("file.xyz")).toBe("application/octet-stream");
      expect(detectMediaType("file.unknown")).toBe("application/octet-stream");
    });

    it("handles no extension", () => {
      expect(detectMediaType("Makefile")).toBe("text/plain");
      expect(detectMediaType("Dockerfile")).toBe("text/plain");
    });

    it("handles dotfiles", () => {
      expect(detectMediaType(".gitignore")).toBe("text/plain");
      expect(detectMediaType(".env")).toBe("text/plain");
    });

    it("handles paths with directories", () => {
      expect(detectMediaType("src/components/Button.tsx")).toBe(
        "text/typescript",
      );
      expect(detectMediaType("public/images/logo.png")).toBe("image/png");
    });
  });

  describe("hash consistency and determinism", () => {
    it("same content always produces same hash", () => {
      const content = "Deterministic content";
      const hashes = Array.from({ length: 5 }, () => sha256Text(content));
      expect(new Set(hashes).size).toBe(1); // All hashes are identical
    });

    it("normalized hashes are consistent", () => {
      const content = "line1\r\nline2\r\nline3";
      const hashes = Array.from({ length: 5 }, () =>
        sha256NormalizedText(content),
      );
      expect(new Set(hashes).size).toBe(1); // All hashes are identical
    });

    it("different content produces different hashes", () => {
      const hashes = [
        sha256Text("content1"),
        sha256Text("content2"),
        sha256Text("content3"),
        sha256Text("content4"),
      ];
      expect(new Set(hashes).size).toBe(4); // All different
    });
  });
});
