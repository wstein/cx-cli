// test-lane: unit
import { describe, expect, test } from "vitest";
import { recommendWorkflow } from "../../src/doctor/workflow.js";

describe("recommendWorkflow", () => {
  test("bundle keyword → bundle mode", () => {
    const r = recommendWorkflow("create a bundle for the release");
    expect(r.mode).toBe("bundle");
    expect(r.sequence).toEqual(["bundle"]);
    expect(r.signals).toContain("bundle");
  });

  test("review/audit keyword → bundle mode", () => {
    const r = recommendWorkflow("audit the current snapshot");
    expect(r.mode).toBe("bundle");
    expect(r.signals).toContain("immutable review");
  });

  test("inspect keyword → inspect mode", () => {
    const r = recommendWorkflow("inspect token breakdown before writing");
    expect(r.mode).toBe("inspect");
    expect(r.sequence).toEqual(["inspect"]);
    expect(r.signals).toContain("inspect");
  });

  test("compare/diff keyword → inspect mode", () => {
    const r = recommendWorkflow("diff the changes between branches");
    expect(r.mode).toBe("inspect");
    expect(r.signals).toContain("compare");
  });

  test("explore/notes keyword → mcp mode", () => {
    const r = recommendWorkflow("explore the notes directory");
    expect(r.mode).toBe("mcp");
    expect(r.sequence).toEqual(["mcp"]);
    expect(r.signals).toContain("mcp");
  });

  test("no matching keywords → mcp mode (default)", () => {
    const r = recommendWorkflow("do something unrelated");
    expect(r.mode).toBe("mcp");
    expect(r.signals).toHaveLength(0);
  });

  test("bundle + mcp combo → inspect mode with full sequence", () => {
    const r = recommendWorkflow("bundle the snapshot and update notes");
    expect(r.mode).toBe("inspect");
    expect(r.sequence).toEqual(["inspect", "bundle", "mcp"]);
  });

  test("inspect + notes combo → inspect mode with full sequence", () => {
    const r = recommendWorkflow("inspect token budget then update notes");
    expect(r.mode).toBe("inspect");
    expect(r.sequence).toEqual(["inspect", "bundle", "mcp"]);
  });

  test("reason is a non-empty string for all modes", () => {
    for (const task of [
      "bundle snapshot",
      "inspect tokens",
      "explore notes",
      "unmatched",
    ]) {
      expect(recommendWorkflow(task).reason.length).toBeGreaterThan(0);
    }
  });
});
