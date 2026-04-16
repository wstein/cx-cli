import { afterEach, describe, expect, mock, test } from "bun:test";

afterEach(() => {
  mock.restore();
});

async function loadProvider() {
  return import("../../src/vcs/provider.js");
}

describe("VCS provider dispatch", () => {
  test("prefers git when git is detected", async () => {
    const gitState = {
      kind: "git" as const,
      trackedFiles: ["tracked.txt"],
      modifiedFiles: [],
      untrackedFiles: [],
    };

    mock.module("../../src/vcs/git.js", () => ({
      detectGit: async () => true,
      getGitState: async () => gitState,
    }));
    mock.module("../../src/vcs/fossil.js", () => ({
      detectFossil: async () => false,
      getFossilState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/mercurial.js", () => ({
      detectHg: async () => false,
      getHgState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/fallback.js", () => ({
      getFilesystemState: async () => {
        throw new Error("should not be called");
      },
    }));

    const { getVCSState } = await loadProvider();
    await expect(getVCSState("/tmp/workspace")).resolves.toEqual(gitState);
  });

  test("falls through to fossil when git is absent", async () => {
    const fossilState = {
      kind: "fossil" as const,
      trackedFiles: ["tracked.txt"],
      modifiedFiles: [],
      untrackedFiles: [],
    };

    mock.module("../../src/vcs/git.js", () => ({
      detectGit: async () => false,
      getGitState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/fossil.js", () => ({
      detectFossil: async () => true,
      getFossilState: async () => fossilState,
    }));
    mock.module("../../src/vcs/mercurial.js", () => ({
      detectHg: async () => false,
      getHgState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/fallback.js", () => ({
      getFilesystemState: async () => {
        throw new Error("should not be called");
      },
    }));

    const { getVCSState } = await loadProvider();
    await expect(getVCSState("/tmp/workspace")).resolves.toEqual(fossilState);
  });

  test("falls through to mercurial when git and fossil are absent", async () => {
    const hgState = {
      kind: "hg" as const,
      trackedFiles: ["tracked.txt"],
      modifiedFiles: [],
      untrackedFiles: [],
    };

    mock.module("../../src/vcs/git.js", () => ({
      detectGit: async () => false,
      getGitState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/fossil.js", () => ({
      detectFossil: async () => false,
      getFossilState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/mercurial.js", () => ({
      detectHg: async () => true,
      getHgState: async () => hgState,
    }));
    mock.module("../../src/vcs/fallback.js", () => ({
      getFilesystemState: async () => {
        throw new Error("should not be called");
      },
    }));

    const { getVCSState } = await loadProvider();
    await expect(getVCSState("/tmp/workspace")).resolves.toEqual(hgState);
  });

  test("uses filesystem fallback when no VCS is detected", async () => {
    const filesystemState = {
      kind: "none" as const,
      trackedFiles: ["tracked.txt"],
      modifiedFiles: [],
      untrackedFiles: [],
    };

    mock.module("../../src/vcs/git.js", () => ({
      detectGit: async () => false,
      getGitState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/fossil.js", () => ({
      detectFossil: async () => false,
      getFossilState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/mercurial.js", () => ({
      detectHg: async () => false,
      getHgState: async () => {
        throw new Error("should not be called");
      },
    }));
    mock.module("../../src/vcs/fallback.js", () => ({
      getFilesystemState: async () => filesystemState,
    }));

    const { getVCSState } = await loadProvider();
    await expect(getVCSState("/tmp/workspace")).resolves.toEqual(
      filesystemState,
    );
  });
});
