// test-lane: integration
import { describe, expect, test } from "bun:test";
import path from "node:path";
import { AuditLogger } from "../../src/mcp/audit.js";
import {
  createCxMcpWorkspace,
  listWorkspaceFiles,
  readWorkspaceFile,
  replaceWorkspaceSpan,
} from "../../src/mcp/workspace.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

describe("createCxMcpWorkspace", () => {
  test("forwards the audit logger when provided", async () => {
    const workspace = await createWorkspace({ fixture: "minimal" });
    const auditLogger = new AuditLogger(workspace.rootDir, false);

    const mcpWorkspace = createCxMcpWorkspace(
      {
        sourceRoot: workspace.rootDir,
      } as never,
      {
        auditLogger,
      },
    );

    expect(mcpWorkspace.auditLogger).toBe(auditLogger);
  });

  test("normalizes prefixes before matching workspace files", async () => {
    const workspace = await createWorkspace({
      files: {
        "src/index.ts": "alpha\nbeta\n",
      },
    });
    const mcpWorkspace = {
      sourceRoot: workspace.rootDir,
      resolveMasterList: async () => ["src/index.ts", "docs/readme.md"],
    } as never;

    const files = await listWorkspaceFiles(mcpWorkspace, path.join("/src/"));
    expect(files.some((file) => file.path.startsWith("src/"))).toBe(true);
  });

  test("rejects an empty path when reading a workspace file", async () => {
    const workspace = await createWorkspace({
      files: {
        "src/index.ts": "alpha\nbeta\n",
      },
    });
    const mcpWorkspace = {
      sourceRoot: workspace.rootDir,
      resolveMasterList: async () => ["src/index.ts"],
    } as never;

    await expect(readWorkspaceFile(mcpWorkspace, { path: "" })).rejects.toThrow(
      "path is required",
    );
  });

  test("rejects invalid line ranges when replacing a workspace span", async () => {
    const workspace = await createWorkspace({
      files: {
        "src/index.ts": "alpha\nbeta\n",
      },
    });
    const mcpWorkspace = {
      sourceRoot: workspace.rootDir,
      resolveMasterList: async () => ["src/index.ts"],
    } as never;

    await expect(
      replaceWorkspaceSpan(mcpWorkspace, {
        path: "src/index.ts",
        startLine: 5,
        endLine: 3,
        replacement: "demo",
      }),
    ).rejects.toThrow("startLine and endLine must describe a valid span.");
  });
});
