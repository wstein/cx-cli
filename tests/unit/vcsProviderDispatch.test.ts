// test-lane: unit
import { describe, expect, test } from "bun:test";
import {
  getVCSStateWithHandlers,
  type VCSProviderHandlers,
} from "../../src/vcs/provider.js";

/**
 * VCS provider dispatch tests using injected handlers.
 *
 * This ensures dispatch semantics can be tested deterministically without
 * host binary dependencies.
 */
describe("VCS provider dispatch", () => {
  function makeHandlers(
    overrides: Partial<VCSProviderHandlers>,
  ): VCSProviderHandlers {
    return {
      detectGit: async () => false,
      getGitState: async () => ({
        kind: "git",
        trackedFiles: [],
        modifiedFiles: [],
        untrackedFiles: [],
      }),
      detectFossil: async () => false,
      getFossilState: async () => ({
        kind: "fossil",
        trackedFiles: [],
        modifiedFiles: [],
        untrackedFiles: [],
      }),
      detectHg: async () => false,
      getHgState: async () => ({
        kind: "hg",
        trackedFiles: [],
        modifiedFiles: [],
        untrackedFiles: [],
      }),
      getFilesystemState: async () => ({
        kind: "none",
        trackedFiles: ["file.txt"],
        modifiedFiles: [],
        untrackedFiles: [],
      }),
      ...overrides,
    };
  }

  test("prefers git when git is detected", async () => {
    const state = await getVCSStateWithHandlers(
      "/repo",
      makeHandlers({
        detectGit: async () => true,
        getGitState: async () => ({
          kind: "git",
          trackedFiles: ["tracked.txt"],
          modifiedFiles: [],
          untrackedFiles: [],
        }),
      }),
    );
    expect(state.kind).toBe("git");
    expect(state.trackedFiles).toContain("tracked.txt");
  });

  test("uses filesystem fallback when no VCS is detected", async () => {
    const state = await getVCSStateWithHandlers("/repo", makeHandlers({}));
    expect(state.kind).toBe("none");
    expect(state.trackedFiles).toContain("file.txt");
    expect(state.modifiedFiles).toEqual([]);
    expect(state.untrackedFiles).toEqual([]);
  });

  test("falls through to fossil when git is absent", async () => {
    const state = await getVCSStateWithHandlers(
      "/repo",
      makeHandlers({
        detectFossil: async () => true,
        getFossilState: async () => ({
          kind: "fossil",
          trackedFiles: ["tracked.txt"],
          modifiedFiles: [],
          untrackedFiles: [],
        }),
      }),
    );
    expect(state.kind).toBe("fossil");
  });

  test("falls through to mercurial when git and fossil are absent", async () => {
    const state = await getVCSStateWithHandlers(
      "/repo",
      makeHandlers({
        detectHg: async () => true,
        getHgState: async () => ({
          kind: "hg",
          trackedFiles: ["tracked.txt"],
          modifiedFiles: [],
          untrackedFiles: [],
        }),
      }),
    );
    expect(state.kind).toBe("hg");
  });
});
