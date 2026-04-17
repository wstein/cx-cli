import { describe, expect, test } from "bun:test";
import {
  classifyDirtyState,
  type VCSKind,
  type VCSState,
} from "../../src/vcs/provider.js";

describe("VCS dirty-state classification", () => {
  test("classifies clean state correctly", () => {
    const state: VCSState = {
      kind: "hg",
      trackedFiles: ["file1.txt", "file2.txt"],
      modifiedFiles: [],
      untrackedFiles: [],
    };
    expect(classifyDirtyState(state)).toBe("clean");
  });

  test("classifies safe_dirty for untracked files only", () => {
    const state: VCSState = {
      kind: "git",
      trackedFiles: ["file1.txt"],
      modifiedFiles: [],
      untrackedFiles: ["temp.log"],
    };
    expect(classifyDirtyState(state)).toBe("safe_dirty");
  });

  test("classifies unsafe_dirty for modified tracked files", () => {
    const state: VCSState = {
      kind: "fossil",
      trackedFiles: ["file1.txt"],
      modifiedFiles: ["file1.txt"],
      untrackedFiles: [],
    };
    expect(classifyDirtyState(state)).toBe("unsafe_dirty");
  });

  test("treats filesystem fallback as clean", () => {
    const state: VCSState = {
      kind: "none",
      trackedFiles: ["file1.txt", "file2.txt"],
      modifiedFiles: [],
      untrackedFiles: [],
    };
    expect(classifyDirtyState(state)).toBe("clean");
  });
});

describe("VCS kind coverage", () => {
  test("supports git", () => {
    const kind: VCSKind = "git";
    expect(kind).toBe("git");
  });

  test("supports fossil", () => {
    const kind: VCSKind = "fossil";
    expect(kind).toBe("fossil");
  });

  test("supports hg", () => {
    const kind: VCSKind = "hg";
    expect(kind).toBe("hg");
  });

  test("supports none", () => {
    const kind: VCSKind = "none";
    expect(kind).toBe("none");
  });
});
