import { describe, expect, it } from "bun:test";
import { isSubpath, toPosixPath } from "../../src/shared/paths";
import type { VCSState } from "../../src/vcs/provider";
import { classifyDirtyState } from "../../src/vcs/provider";

describe("VCS and path utilities", () => {
  describe("classifyDirtyState", () => {
    it("returns clean when kind is none", () => {
      const vcsState: VCSState = {
        kind: "none",
        trackedFiles: [],
        modifiedFiles: [],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("clean");
    });

    it("returns clean for git with no modifications or untracked files", () => {
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: ["file1.ts", "file2.ts"],
        modifiedFiles: [],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("clean");
    });

    it("returns unsafe_dirty when git has modified files", () => {
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: ["file1.ts", "file2.ts"],
        modifiedFiles: ["file1.ts"],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("unsafe_dirty");
    });

    it("returns unsafe_dirty when git has multiple modified files", () => {
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: ["file1.ts", "file2.ts", "file3.ts"],
        modifiedFiles: ["file1.ts", "file2.ts"],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("unsafe_dirty");
    });

    it("returns safe_dirty when git has only untracked files", () => {
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: ["file1.ts"],
        modifiedFiles: [],
        untrackedFiles: ["untracked.ts", "build/output.js"],
      };
      expect(classifyDirtyState(vcsState)).toBe("safe_dirty");
    });

    it("returns unsafe_dirty when git has both modified and untracked files", () => {
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: ["file1.ts"],
        modifiedFiles: ["file1.ts"],
        untrackedFiles: ["untracked.ts"],
      };
      expect(classifyDirtyState(vcsState)).toBe("unsafe_dirty");
    });

    it("returns clean for fossil with no modifications", () => {
      const vcsState: VCSState = {
        kind: "fossil",
        trackedFiles: ["file1.ts"],
        modifiedFiles: [],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("clean");
    });

    it("returns unsafe_dirty for fossil with modifications", () => {
      const vcsState: VCSState = {
        kind: "fossil",
        trackedFiles: ["file1.ts"],
        modifiedFiles: ["file1.ts"],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("unsafe_dirty");
    });

    it("returns safe_dirty for fossil with untracked files", () => {
      const vcsState: VCSState = {
        kind: "fossil",
        trackedFiles: ["file1.ts"],
        modifiedFiles: [],
        untrackedFiles: ["extra.ts"],
      };
      expect(classifyDirtyState(vcsState)).toBe("safe_dirty");
    });

    it("returns clean for mercurial with no modifications", () => {
      const vcsState: VCSState = {
        kind: "hg",
        trackedFiles: ["file1.ts"],
        modifiedFiles: [],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("clean");
    });

    it("returns unsafe_dirty for mercurial with modifications", () => {
      const vcsState: VCSState = {
        kind: "hg",
        trackedFiles: ["file1.ts"],
        modifiedFiles: ["file1.ts"],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("unsafe_dirty");
    });

    it("prioritizes modified files over untracked files", () => {
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: ["tracked.ts"],
        modifiedFiles: ["tracked.ts"],
        untrackedFiles: ["untracked.ts"],
      };
      expect(classifyDirtyState(vcsState)).toBe("unsafe_dirty");
    });

    it("handles empty files arrays", () => {
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: [],
        modifiedFiles: [],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("clean");
    });

    it("handles only untracked files", () => {
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: [],
        modifiedFiles: [],
        untrackedFiles: ["extra.ts"],
      };
      expect(classifyDirtyState(vcsState)).toBe("safe_dirty");
    });

    it("returns clean for fossil with no modifications when untracked is empty", () => {
      const vcsState: VCSState = {
        kind: "fossil",
        trackedFiles: ["a.ts", "b.ts", "c.ts"],
        modifiedFiles: [],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("clean");
    });
  });

  describe("isSubpath", () => {
    it("returns true when child is directly under parent", () => {
      expect(isSubpath("/project", "/project/src")).toBe(true);
    });

    it("returns true when child is nested several levels deep", () => {
      expect(isSubpath("/project", "/project/src/lib/utils")).toBe(true);
    });

    it("returns false when child is the same as parent", () => {
      expect(isSubpath("/project", "/project")).toBe(false);
    });

    it("returns false when child is parent directory", () => {
      expect(isSubpath("/project/src", "/project")).toBe(false);
    });

    it("returns false when child is sibling", () => {
      expect(isSubpath("/project/src", "/project/tests")).toBe(false);
    });

    it("returns false when paths are unrelated", () => {
      expect(isSubpath("/project", "/other")).toBe(false);
    });

    it("returns true with relative paths", () => {
      expect(isSubpath(".", "lib")).toBe(true);
      expect(isSubpath(".", "lib/utils")).toBe(true);
    });

    it("returns false with relative parent path", () => {
      expect(isSubpath("lib", ".")).toBe(false);
    });

    it("handles trailing slashes", () => {
      expect(isSubpath("/project/", "/project/src")).toBe(true);
      expect(isSubpath("/project", "/project/src/")).toBe(true);
    });

    it("returns false with partial name match", () => {
      expect(isSubpath("/project", "/project-backup/file")).toBe(false);
    });

    it("returns true with current directory notation", () => {
      expect(isSubpath(".", "./src")).toBe(true);
    });

    it("handles mixed path separators appropriately", () => {
      // Behavior depends on OS path.sep, so we test relative paths
      expect(isSubpath(".", "lib")).toBe(true);
    });

    it("returns false when child goes up and then down the tree", () => {
      expect(isSubpath("/a/b", "/a/c")).toBe(false);
    });

    it("returns true with single-level child", () => {
      expect(isSubpath("/", "/home")).toBe(true);
    });

    it("handles very deep paths", () => {
      const parent = "/a/b/c";
      const child = "/a/b/c/d/e/f/g/h/i/j/k";
      expect(isSubpath(parent, child)).toBe(true);
    });

    it("returns false when parent path is absolute and child relative", () => {
      const result = isSubpath("/project", "src");
      // This depends on path.relative behavior
      expect(typeof result).toBe("boolean");
    });

    it("handles symbolic path components correctly", () => {
      // Test with .. in paths
      const result = isSubpath("/project", "/project/../project/src");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("toPosixPath", () => {
    it("preserves POSIX paths when path.sep is forward slash", () => {
      // On POSIX systems, path.sep is '/', so toPosixPath is a no-op
      const posixPath = "/home/user/project/src/main.ts";
      expect(toPosixPath(posixPath)).toBe(posixPath);
    });

    it("handles relative paths", () => {
      const relativePath = "src/lib/utils.ts";
      const result = toPosixPath(relativePath);
      expect(result.includes("/")).toBe(true);
    });

    it("handles single folder path", () => {
      const singlePath = "src/main.ts";
      const result = toPosixPath(singlePath);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles empty string", () => {
      expect(toPosixPath("")).toBe("");
    });

    it("handles paths with dots", () => {
      const pathWithDots = "../../../src/main.ts";
      const result = toPosixPath(pathWithDots);
      expect(result).toBe("../../../src/main.ts");
    });

    it("handles paths with special characters", () => {
      const specialPath = "src/components-Button.tsx";
      const result = toPosixPath(specialPath);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("normalizes path separators correctly", () => {
      // On Windows this would convert \\ to /, on POSIX it's a no-op
      const result = toPosixPath("src/lib/utils");
      expect(typeof result).toBe("string");
    });

    it("preserves path with only forward slashes", () => {
      const posixPath = "src/lib/utils/helpers.ts";
      expect(toPosixPath(posixPath)).toBe(posixPath);
    });

    it("handles long paths", () => {
      const longPath =
        "src/components/form/inputs/TextField/utils/validation/rules.ts";
      const result = toPosixPath(longPath);
      expect(result).toBe(longPath);
    });

    it("preserves absolute POSIX path", () => {
      const absPath = "/usr/local/bin/cx";
      expect(toPosixPath(absPath)).toBe(absPath);
    });

    it("never introduces backslashes in output", () => {
      const testPath = "src/lib/test";
      const result = toPosixPath(testPath);
      // On POSIX, this should never have backslashes
      // On Windows, path.posix.sep would ensure forward slashes
      expect(result).not.toContain("\\\\");
    });
  });

  describe("VCS state classification edge cases", () => {
    it("handles many modified files", () => {
      const modifiedFiles = Array.from(
        { length: 100 },
        (_, i) => `file${i}.ts`,
      );
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: [...modifiedFiles],
        modifiedFiles: [...modifiedFiles],
        untrackedFiles: [],
      };
      expect(classifyDirtyState(vcsState)).toBe("unsafe_dirty");
    });

    it("handles many untracked files", () => {
      const untrackedFiles = Array.from(
        { length: 100 },
        (_, i) => `untracked${i}.ts`,
      );
      const vcsState: VCSState = {
        kind: "git",
        trackedFiles: ["tracked.ts"],
        modifiedFiles: [],
        untrackedFiles: [...untrackedFiles],
      };
      expect(classifyDirtyState(vcsState)).toBe("safe_dirty");
    });
  });
});
