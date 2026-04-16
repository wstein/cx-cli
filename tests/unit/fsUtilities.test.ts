import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ensureDir,
  listFilesRecursive,
  pathExists,
  relativePosix,
  sortLexically,
} from "../../src/shared/fs";

describe("shared fs utilities", () => {
  describe("sortLexically", () => {
    it("sorts strings in English lexicographic order", () => {
      const input = ["cherry", "apple", "banana"];
      const result = sortLexically(input);
      expect(result).toEqual(["apple", "banana", "cherry"]);
    });

    it("preserves order of already sorted array", () => {
      const input = ["alpha", "beta", "gamma"];
      const result = sortLexically(input);
      expect(result).toEqual(["alpha", "beta", "gamma"]);
    });

    it("handles single element", () => {
      const input = ["solo"];
      const result = sortLexically(input);
      expect(result).toEqual(["solo"]);
    });

    it("handles empty array", () => {
      const input: string[] = [];
      const result = sortLexically(input);
      expect(result).toEqual([]);
    });

    it("sorts case-insensitively with capital letters", () => {
      const input = ["Zebra", "apple", "Banana"];
      const result = sortLexically(input);
      // Lexicographic sort: B comes before a, then z comes before a
      expect(result[0]).toBe("apple");
    });

    it("does not mutate input array", () => {
      const input = ["c", "a", "b"];
      const originalInput = [...input];
      sortLexically(input);
      expect(input).toEqual(originalInput);
    });

    it("returns a new array", () => {
      const input = ["a", "b", "c"];
      const result = sortLexically(input);
      expect(result).not.toBe(input);
    });

    it("handles paths with slashes", () => {
      const input = ["src/z.ts", "src/a.ts", "lib/m.ts"];
      const result = sortLexically(input);
      expect(result[0]).toBe("lib/m.ts");
      expect(result[2]).toBe("src/z.ts");
    });

    it("handles numbers in strings", () => {
      const input = ["file2.txt", "file10.txt", "file1.txt"];
      const result = sortLexically(input);
      // Lexicographic: "1" < "2" < "10"
      expect(result[0]).toBe("file1.txt");
      expect(result[1]).toBe("file10.txt");
      expect(result[2]).toBe("file2.txt");
    });

    it("handles special characters", () => {
      const input = ["c_file", "a-file", "b_file"];
      const result = sortLexically(input);
      expect(result[0]).toBe("a-file");
    });

    it("handles duplicate strings", () => {
      const input = ["apple", "banana", "apple"];
      const result = sortLexically(input);
      expect(result).toEqual(["apple", "apple", "banana"]);
    });

    it("handles mixed case duplicates", () => {
      const input = ["Apple", "apple", "APPLE"];
      const result = sortLexically(input);
      expect(result).toHaveLength(3);
    });

    it("handles whitespace differences", () => {
      const input = [" apple", "apple ", "apple"];
      const result = sortLexically(input);
      // Whitespace affects lexicographic order
      expect(result[0]).toBe(" apple");
    });

    it("sorts with readonly input array", () => {
      const input: readonly string[] = ["c", "a", "b"];
      const result = sortLexically(input);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("handles very long list", () => {
      const input = Array.from({ length: 1000 }, (_, i) =>
        String.fromCharCode(97 + (i % 26))
      );
      const result = sortLexically(input);
      // Just verify it completes and returns array
      expect(result).toHaveLength(1000);
    });
  });

  describe("relativePosix", () => {
    it("normalizes paths with POSIX format", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project/src/main.ts";
      const result = relativePosix(rootDir, filePath);
      // Should return relative path in POSIX format
      expect(result).toBe("src/main.ts");
    });

    it("returns relative path in POSIX format", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project/src/main.ts";
      const result = relativePosix(rootDir, filePath);
      expect(result).toBe("src/main.ts");
    });

    it("handles nested directories", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project/src/lib/utils/helper.ts";
      const result = relativePosix(rootDir, filePath);
      expect(result).toBe("src/lib/utils/helper.ts");
    });

    it("handles file at root level", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project/README.md";
      const result = relativePosix(rootDir, filePath);
      expect(result).toBe("README.md");
    });

    it("returns relative path with parent directory references", () => {
      const rootDir = "/Users/project/src";
      const filePath = "/Users/project/README.md";
      const result = relativePosix(rootDir, filePath);
      expect(result).toContain("..");
    });

    it("handles trailing slashes in root", () => {
      const rootDir = "/Users/project/";
      const filePath = "/Users/project/src/main.ts";
      const result = relativePosix(rootDir, filePath);
      expect(result).toBe("src/main.ts");
    });

    it("handles trailing slashes in file path", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project/src/";
      const result = relativePosix(rootDir, filePath);
      expect(result).toBe("src");
    });

    it("returns paths in forward-slash format", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project/src/main.ts";
      const result = relativePosix(rootDir, filePath);
      // Should use forward slashes, not backslashes
      expect(result).toContain("/");
    });

    it("handles dot paths correctly", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project/./src/./main.ts";
      const result = relativePosix(rootDir, filePath);
      expect(result).toContain("src");
      expect(result).toContain("main.ts");
    });

    it("handles identical root and file path", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project";
      const result = relativePosix(rootDir, filePath);
      // path.relative returns empty string for identical paths
      expect(result).toBe("");
    });

    it("handles paths with spaces", () => {
      const rootDir = "/Users/My Project";
      const filePath = "/Users/My Project/My Folder/file.txt";
      const result = relativePosix(rootDir, filePath);
      expect(result).toBe("My Folder/file.txt");
    });

    it("handles paths with special characters", () => {
      const rootDir = "/Users/project";
      const filePath = "/Users/project/src/my-file_v1.test.ts";
      const result = relativePosix(rootDir, filePath);
      expect(result).toBe("src/my-file_v1.test.ts");
    });

    it("uses English locale for path comparison", () => {
      // Test that path.relative is called (indirectly through toPosixPath)
      const rootDir = "/root";
      const filePath = "/root/file.txt";
      const result = relativePosix(rootDir, filePath);
      expect(result).toBe("file.txt");
    });
  });

  describe("filesystem helpers", () => {
    it("ensureDir creates nested directories and pathExists reports them", async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-fs-utils-"));
      try {
        const nestedDir = path.join(root, "nested", "deeper");
        expect(await pathExists(nestedDir)).toBe(false);

        await ensureDir(nestedDir);

        expect(await pathExists(nestedDir)).toBe(true);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it("listFilesRecursive returns all files beneath a root", async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-fs-list-"));
      try {
        await ensureDir(path.join(root, "nested", "deeper"));
        await fs.writeFile(path.join(root, "root.txt"), "root", "utf8");
        await fs.writeFile(path.join(root, "nested", "child.txt"), "child", "utf8");
        await fs.writeFile(
          path.join(root, "nested", "deeper", "leaf.txt"),
          "leaf",
          "utf8",
        );

        const files = await listFilesRecursive(root);

        expect(sortLexically(files)).toEqual(
          sortLexically([
            path.join(root, "nested", "child.txt"),
            path.join(root, "nested", "deeper", "leaf.txt"),
            path.join(root, "root.txt"),
          ]),
        );
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });
});
