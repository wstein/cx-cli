// test-lane: unit

import { describe, expect, test, vi } from "vitest";
import { collectSharedHandoverRepoHistory } from "../../src/cli/commands/bundle.js";

describe("shared handover repo history collection", () => {
  test("skips history collection outside git worktrees", async () => {
    const emitWarning = vi.fn();

    const history = await collectSharedHandoverRepoHistory({
      includeRepoHistory: true,
      repoHistoryCount: 25,
      vcsKind: "none",
      sourceRoot: "/tmp/demo",
      emitWarning,
      historyLoaders: {
        git: vi.fn(),
      },
    });

    expect(history).toEqual([]);
    expect(emitWarning).not.toHaveBeenCalled();
  });

  test("warns and degrades gracefully when git history collection fails", async () => {
    const historyLoader = vi
      .fn()
      .mockRejectedValue(new Error("git log failed"));
    const emitWarning = vi.fn();

    const history = await collectSharedHandoverRepoHistory({
      includeRepoHistory: true,
      repoHistoryCount: 25,
      vcsKind: "git",
      sourceRoot: "/tmp/demo",
      emitWarning,
      historyLoaders: {
        git: historyLoader,
      },
    });

    expect(history).toEqual([]);
    expect(historyLoader).toHaveBeenCalledWith("/tmp/demo", 25);
    expect(emitWarning).toHaveBeenCalledWith(
      "failed to collect recent repository history for shared handover: git log failed",
    );
  });

  test("dispatches to mercurial history collection when hg is detected", async () => {
    const hgLoader = vi.fn().mockResolvedValue([
      {
        shortHash: "aaaaaaaaaaaa",
        message: "Add mercurial history\n\nBody line",
      },
    ]);

    const history = await collectSharedHandoverRepoHistory({
      includeRepoHistory: true,
      repoHistoryCount: 25,
      vcsKind: "hg",
      sourceRoot: "/tmp/demo",
      emitWarning: vi.fn(),
      historyLoaders: {
        hg: hgLoader,
      },
    });

    expect(hgLoader).toHaveBeenCalledWith("/tmp/demo", 25);
    expect(history).toEqual([
      {
        shortHash: "aaaaaaaaaaaa",
        message: "Add mercurial history\n\nBody line",
      },
    ]);
  });

  test("dispatches to fossil history collection when fossil is detected", async () => {
    const fossilLoader = vi.fn().mockResolvedValue([
      {
        shortHash: "bbbbbbbbbbbb",
        message: "Add fossil history\n\nBody line",
      },
    ]);

    const history = await collectSharedHandoverRepoHistory({
      includeRepoHistory: true,
      repoHistoryCount: 25,
      vcsKind: "fossil",
      sourceRoot: "/tmp/demo",
      emitWarning: vi.fn(),
      historyLoaders: {
        fossil: fossilLoader,
      },
    });

    expect(fossilLoader).toHaveBeenCalledWith("/tmp/demo", 25);
    expect(history).toEqual([
      {
        shortHash: "bbbbbbbbbbbb",
        message: "Add fossil history\n\nBody line",
      },
    ]);
  });
});
