// test-lane: unit

import { describe, expect, test, vi } from "vitest";
import { collectSharedHandoverRepoHistory } from "../../src/cli/commands/bundle.js";

describe("shared handover repo history collection", () => {
  test("skips history collection outside git worktrees", async () => {
    const historyLoader = vi.fn();
    const emitWarning = vi.fn();

    const history = await collectSharedHandoverRepoHistory({
      includeRepoHistory: true,
      repoHistoryCount: 30,
      vcsKind: "none",
      sourceRoot: "/tmp/demo",
      emitWarning,
      historyLoader,
    });

    expect(history).toEqual([]);
    expect(historyLoader).not.toHaveBeenCalled();
    expect(emitWarning).not.toHaveBeenCalled();
  });

  test("warns and degrades gracefully when git history collection fails", async () => {
    const historyLoader = vi
      .fn()
      .mockRejectedValue(new Error("git log failed"));
    const emitWarning = vi.fn();

    const history = await collectSharedHandoverRepoHistory({
      includeRepoHistory: true,
      repoHistoryCount: 30,
      vcsKind: "git",
      sourceRoot: "/tmp/demo",
      emitWarning,
      historyLoader,
    });

    expect(history).toEqual([]);
    expect(historyLoader).toHaveBeenCalledWith("/tmp/demo", 30);
    expect(emitWarning).toHaveBeenCalledWith(
      "failed to collect recent repository history for shared handover: git log failed",
    );
  });
});
