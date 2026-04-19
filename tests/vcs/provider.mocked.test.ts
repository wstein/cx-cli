// test-lane: integration
import { describe, expect, test } from "vitest";
import {
  getVCSStateWithHandlers,
  type VCSProviderHandlers,
  type VCSState,
} from "../../src/vcs/provider.js";

function baseState(kind: VCSState["kind"]): VCSState {
  return {
    kind,
    trackedFiles: [],
    modifiedFiles: [],
    untrackedFiles: [],
  };
}

function makeHandlers(
  overrides: Partial<VCSProviderHandlers>,
): VCSProviderHandlers {
  return {
    detectGit: async () => false,
    getGitState: async () => baseState("git"),
    detectFossil: async () => false,
    getFossilState: async () => baseState("fossil"),
    detectHg: async () => false,
    getHgState: async () => baseState("hg"),
    getFilesystemState: async () => baseState("none"),
    ...overrides,
  };
}

describe("VCS provider dispatch with mocked handlers", () => {
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
    expect(state.trackedFiles).toEqual(["tracked.txt"]);
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
          modifiedFiles: ["tracked.txt"],
          untrackedFiles: [],
        }),
      }),
    );
    expect(state.kind).toBe("hg");
    expect(state.modifiedFiles).toEqual(["tracked.txt"]);
  });

  test("uses filesystem fallback when no VCS is detected", async () => {
    const state = await getVCSStateWithHandlers(
      "/repo",
      makeHandlers({
        getFilesystemState: async () => ({
          kind: "none",
          trackedFiles: ["file.txt"],
          modifiedFiles: [],
          untrackedFiles: [],
        }),
      }),
    );

    expect(state.kind).toBe("none");
    expect(state.trackedFiles).toEqual(["file.txt"]);
  });
});
