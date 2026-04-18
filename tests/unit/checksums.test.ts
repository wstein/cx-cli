// test-lane: unit
import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseChecksumFile,
  writeChecksumFile,
} from "../../src/manifest/checksums.js";
import { sha256File } from "../../src/shared/hashing.js";

describe("manifest checksums", () => {
  describe("parseChecksumFile", () => {
    it("parses single checksum line", () => {
      const source =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  empty.txt\n";
      const result = parseChecksumFile(source);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        relativePath: "empty.txt",
      });
    });

    it("parses multiple checksum lines", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file1.txt\n" +
        "bbb0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file2.txt\n";
      const result = parseChecksumFile(source);
      expect(result).toHaveLength(2);
      expect(result[0]?.relativePath).toBe("file1.txt");
      expect(result[1]?.relativePath).toBe("file2.txt");
    });

    it("handles file paths with directories", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  src/main/file.js\n";
      const result = parseChecksumFile(source);
      expect(result[0]?.relativePath).toBe("src/main/file.js");
    });

    it("handles file paths with special characters", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file-with-dash_or_underscore.txt\n";
      const result = parseChecksumFile(source);
      expect(result[0]?.relativePath).toBe("file-with-dash_or_underscore.txt");
    });

    it("skips empty lines", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file1.txt\n" +
        "\n" +
        "bbb0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file2.txt\n";
      const result = parseChecksumFile(source);
      expect(result).toHaveLength(2);
    });

    it("handles CRLF line endings", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file1.txt\r\n" +
        "bbb0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file2.txt\r\n";
      const result = parseChecksumFile(source);
      expect(result).toHaveLength(2);
    });

    it("handles mixed line endings (LF and CRLF)", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file1.txt\n" +
        "bbb0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file2.txt\r\n" +
        "ccc0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file3.txt\n";
      const result = parseChecksumFile(source);
      expect(result).toHaveLength(3);
    });

    it("throws on invalid hash format (too short)", () => {
      const source = "aaa  file.txt\n";
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("throws on invalid hash format (non-hex characters)", () => {
      const source =
        "zzz0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file.txt\n";
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("throws on hash with incorrect length", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85  file.txt\n";
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("throws on missing file path", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  \n";
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("throws on single space instead of double space separator", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 file.txt\n";
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("throws on no space separator", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855file.txt\n";
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("handles file names with spaces", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  my file.txt\n";
      const result = parseChecksumFile(source);
      expect(result[0]?.relativePath).toBe("my file.txt");
    });

    it("handles empty source string", () => {
      const result = parseChecksumFile("");
      expect(result).toEqual([]);
    });

    it("handles source with only empty lines", () => {
      const source = "\n\n\n";
      const result = parseChecksumFile(source);
      expect(result).toEqual([]);
    });

    it("handles uppercase hex in hash", () => {
      const source =
        "AAA0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855  file.txt\n";
      // Regex allows lowercase only, so uppercase should fail
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("handles lowercase hex in hash", () => {
      const source =
        "aaa0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  file.txt\n";
      const result = parseChecksumFile(source);
      expect(result[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles hash exactly 64 hex characters", () => {
      const hashStr = "a".repeat(64);
      const source = `${hashStr}  file.txt\n`;
      const result = parseChecksumFile(source);
      expect(result[0]?.hash).toBe(hashStr);
    });

    it("throws on hash longer than 64 characters", () => {
      const hashStr = "a".repeat(65);
      const source = `${hashStr}  file.txt\n`;
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("throws on hash shorter than 64 characters", () => {
      const hashStr = "a".repeat(63);
      const source = `${hashStr}  file.txt\n`;
      expect(() => parseChecksumFile(source)).toThrow();
    });

    it("writes a checksum file sorted lexically", async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-checksums-"));
      try {
        await fs.writeFile(path.join(root, "b.txt"), "beta", "utf8");
        await fs.writeFile(path.join(root, "a.txt"), "alpha", "utf8");

        await writeChecksumFile(root, "checksums.txt", ["b.txt", "a.txt"]);

        const checksumText = await fs.readFile(
          path.join(root, "checksums.txt"),
          "utf8",
        );
        const parsed = parseChecksumFile(checksumText);

        expect(parsed.map((entry) => entry.relativePath)).toEqual([
          "a.txt",
          "b.txt",
        ]);
        expect(parsed[0]?.hash).toBe(
          await sha256File(path.join(root, "a.txt")),
        );
        expect(parsed[1]?.hash).toBe(
          await sha256File(path.join(root, "b.txt")),
        );
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });
});
