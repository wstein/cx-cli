import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { loadCxConfig } from "../../src/config/load.js";
import { createCxMcpServer } from "../../src/mcp/server.js";

const execFileAsync = promisify(execFile);

interface RegisteredTool {
  handler: (
    args: unknown,
    context: never,
  ) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
}

type CxMcpToolName =
  | "bundle"
  | "doctor_mcp"
  | "doctor_overlaps"
  | "doctor_secrets"
  | "doctor_workflow"
  | "grep"
  | "inspect"
  | "list"
  | "notes_backlinks"
  | "notes_code_links"
  | "notes_delete"
  | "notes_graph"
  | "notes_links"
  | "notes_list"
  | "notes_new"
  | "notes_orphans"
  | "notes_read"
  | "notes_rename"
  | "notes_search"
  | "notes_update"
  | "read"
  | "replace_repomix_span";

type CxMcpTools = Record<CxMcpToolName, RegisteredTool>;

type ToolResult = Awaited<ReturnType<RegisteredTool["handler"]>>;

function getRegisteredTools(server: unknown): CxMcpTools {
  return (server as unknown as { _registeredTools: CxMcpTools })
    ._registeredTools;
}

function firstContentText(result: ToolResult): string {
  if (result.content.length === 0) {
    throw new Error("Expected at least one content block");
  }
  return result.content[0].text;
}

function getTool<T extends string>(
  tools: Record<string, RegisteredTool>,
  name: T,
): RegisteredTool {
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }
  return tool;
}

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "cx@example.com"], {
    cwd: root,
  });
  await execFileAsync("git", ["config", "user.name", "cx"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: root });
}

async function createWorkspace(
  options: { overlap?: boolean; includeSecret?: boolean } = {},
): Promise<{
  root: string;
  configPath: string;
  mcpPath: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cx-mcp-server-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "src", "index.ts"),
    ["export const greeting = 'hello';", "export const target = 'world';"].join(
      "\n",
    ),
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "README.md"),
    "# Workspace\n\nhello from cx\n",
    "utf8",
  );
  if (options.includeSecret === true) {
    const secretValue = ["ghp_", "123456789012345678901234567890123456"].join(
      "",
    );
    await fs.writeFile(
      path.join(root, "secrets.txt"),
      `${secretValue}\n`,
      "utf8",
    );
  }

  const configPath = path.join(root, "cx.toml");
  const mcpPath = path.join(root, "cx-mcp.toml");

  await fs.writeFile(
    configPath,
    `schema_version = 1
project_name = "demo"
source_root = "."
output_dir = "dist/demo-bundle"

[repomix]
style = "xml"
show_line_numbers = false
include_empty_directories = false
security_check = false

[files]
exclude = ["dist/**"]
follow_symlinks = false
unmatched = "ignore"

[sections.src]
include = ["src/**"]
exclude = []
${options.overlap === true ? '\n[sections.mixed]\ninclude = ["src/**"]\n' : ""}
`,
    "utf8",
  );

  await fs.writeFile(
    mcpPath,
    `extends = "cx.toml"

[mcp]
policy = "unrestricted"
enable_mutation = true

[files]
include = ["README.md"]
`,
    "utf8",
  );

  await initGitRepo(root);

  return { root, configPath, mcpPath };
}

describe("cx MCP server", () => {
  test("registers workspace file tools and note tools", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const toolNames = Object.keys(getRegisteredTools(server)).sort();
    const instructions = (
      server as unknown as {
        server: { _instructions: string };
      }
    ).server._instructions;

    expect(toolNames).toEqual([
      "bundle",
      "doctor_mcp",
      "doctor_overlaps",
      "doctor_secrets",
      "doctor_workflow",
      "grep",
      "inspect",
      "list",
      "notes_backlinks",
      "notes_code_links",
      "notes_delete",
      "notes_graph",
      "notes_links",
      "notes_list",
      "notes_new",
      "notes_orphans",
      "notes_read",
      "notes_rename",
      "notes_search",
      "notes_update",
      "read",
      "replace_repomix_span",
    ]);
    expect(instructions).toContain("immutable snapshots");
    expect(instructions).toContain("interactive exploration");
  });

  test("doctor_mcp returns the resolved MCP profile and scope", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const result = await getTool(tools, "doctor_mcp").handler({}, {} as never);
    const payload = JSON.parse(firstContentText(result)) as {
      command: string;
      activeProfile: string;
      resolvedConfigPath: string;
      filesInclude: string[];
      filesExclude: string[];
    };

    expect(payload.command).toBe("doctor mcp");
    expect(payload.activeProfile).toBe("cx-mcp.toml");
    expect(payload.resolvedConfigPath).toBe(project.mcpPath);
    expect(payload.filesInclude).toContain("README.md");
    expect(payload.filesExclude.length).toBeGreaterThanOrEqual(0);
  });

  test("doctor_overlaps diagnoses live workspace section overlaps", async () => {
    const project = await createWorkspace({ overlap: true });
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const result = await getTool(
      getRegisteredTools(server),
      "doctor_overlaps",
    ).handler({}, {} as never);
    const payload = JSON.parse(firstContentText(result)) as {
      command: string;
      conflictCount: number;
      conflicts: Array<{ path: string; sections: string[] }>;
    };

    expect(payload.command).toBe("doctor overlaps");
    expect(payload.conflictCount).toBe(1);
    expect(payload.conflicts[0]?.path).toBe("src/index.ts");
    expect(payload.conflicts[0]?.sections).toContain("mixed");
  });

  test("doctor_secrets scans the live workspace file scope", async () => {
    const project = await createWorkspace({ includeSecret: true });
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const result = await getTool(
      getRegisteredTools(server),
      "doctor_secrets",
    ).handler({}, {} as never);
    const payload = JSON.parse(firstContentText(result)) as {
      command: string;
      securityCheckEnabled: boolean;
      scannedFileCount: number;
      suspiciousCount: number;
    };

    expect(payload.command).toBe("doctor secrets");
    expect(payload.scannedFileCount).toBeGreaterThan(0);
    expect(payload.suspiciousCount).toBeGreaterThan(0);
  });

  test("list returns workspace files from the active cx scope", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const listTool = getTool(getRegisteredTools(server), "list");

    const result = await listTool.handler({}, {} as never);
    const payload = JSON.parse(firstContentText(result)) as {
      fileCount: number;
      files: Array<{ path: string }>;
    };

    expect(payload.fileCount).toBeGreaterThanOrEqual(2);
    expect(payload.files.map((file) => file.path)).toContain("README.md");
    expect(payload.files.map((file) => file.path)).toContain("src/index.ts");
  });

  test("grep searches workspace files by content", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const grepTool = getRegisteredTools(server).grep;

    const result = await grepTool.handler(
      {
        pattern: "hello",
        regex: false,
        caseSensitive: false,
      },
      {} as never,
    );
    const payload = JSON.parse(firstContentText(result)) as {
      matchCount: number;
      matches: Array<{
        path: string;
        lineNumber: number;
        line: string;
      }>;
    };

    expect(payload.matchCount).toBeGreaterThan(0);
    expect(payload.matches.some((match) => match.path === "README.md")).toBe(
      true,
    );
    expect(
      payload.matches.some(
        (match) =>
          match.path === "src/index.ts" && match.line.includes("hello"),
      ),
    ).toBe(true);
  });

  test("replace_repomix_span replaces an exact live workspace span", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tool = getRegisteredTools(server).replace_repomix_span;

    const result = await tool.handler(
      {
        path: "src/index.ts",
        startLine: 2,
        endLine: 2,
        replacement: "export const target = 'universe';",
      },
      {} as never,
    );
    const payload = JSON.parse(firstContentText(result)) as {
      command: string;
      path: string;
      lineStart: number;
      lineEnd: number;
      replacementLineCount: number;
    };

    expect(payload.command).toBe("replace repomix span");
    expect(payload.path).toBe("src/index.ts");
    expect(payload.lineStart).toBe(2);
    expect(payload.lineEnd).toBe(2);
    expect(payload.replacementLineCount).toBe(1);

    const updated = await fs.readFile(
      path.join(project.root, "src", "index.ts"),
      "utf8",
    );
    expect(updated).toContain("universe");
    expect(updated).not.toContain("world");
  });

  test("read returns anchored workspace content", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const readTool = getRegisteredTools(server).read;

    const result = await readTool.handler(
      {
        path: "src/index.ts",
        startLine: 2,
        endLine: 2,
      },
      {} as never,
    );
    const payload = JSON.parse(firstContentText(result)) as {
      path: string;
      lineStart: number;
      lineEnd: number;
      content: string;
    };

    expect(payload.path).toBe("src/index.ts");
    expect(payload.lineStart).toBe(2);
    expect(payload.lineEnd).toBe(2);
    expect(payload.content).toContain("world");
  });

  test("notes_new creates a workspace note and notes_list returns it", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const createResult = await tools.notes_new.handler(
      {
        title: "Agent Insight",
        tags: ["agent", "workflow"],
        body: "This note records an important observation.",
      },
      {} as never,
    );
    const createPayload = JSON.parse(firstContentText(createResult)) as {
      id: string;
      filePath: string;
      title: string;
      tags: string[];
    };

    expect(createPayload.title).toBe("Agent Insight");
    expect(createPayload.tags).toEqual(["agent", "workflow"]);

    const createdNote = path.join(project.root, createPayload.filePath);
    const noteContent = await fs.readFile(createdNote, "utf8");
    expect(noteContent).toContain(
      "This note records an important observation.",
    );

    const listResult = await tools.notes_list.handler({}, {} as never);
    const listPayload = JSON.parse(firstContentText(listResult)) as {
      count: number;
      notes: Array<{ title: string; summary: string }>;
    };

    expect(listPayload.count).toBeGreaterThan(0);
    expect(
      listPayload.notes.some((note) => note.title === "Agent Insight"),
    ).toBe(true);
    expect(
      listPayload.notes.some((note) =>
        note.summary.includes("important observation"),
      ),
    ).toBe(true);
  });

  test("notes_read returns the parsed note body and metadata", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const createResult = await tools.notes_new.handler(
      {
        title: "Readable Note",
        body: "A note body for direct MCP reads.",
        tags: ["read"],
      },
      {} as never,
    );
    const createPayload = JSON.parse(firstContentText(createResult)) as {
      id: string;
      filePath: string;
    };

    const result = await tools.notes_read.handler(
      { id: createPayload.id },
      {} as never,
    );
    const payload = JSON.parse(firstContentText(result)) as {
      id: string;
      title: string;
      body: string;
      tags: string[];
      filePath: string;
    };

    expect(payload.id).toBe(createPayload.id);
    expect(payload.title).toBe("Readable Note");
    expect(payload.body).toContain("A note body for direct MCP reads.");
    expect(payload.tags).toEqual(["read"]);
    expect(payload.filePath).toBe(createPayload.filePath);
  });

  test("notes_search finds notes by body text and tags", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    await tools.notes_new.handler(
      {
        title: "Search Candidate",
        body: "This note mentions the MCP workflow in its body.",
        tags: ["search", "agent"],
      },
      {} as never,
    );

    const result = await tools.notes_search.handler(
      {
        query: "workflow",
        tags: ["search"],
      },
      {} as never,
    );
    const payload = JSON.parse(firstContentText(result)) as {
      count: number;
      notes: Array<{ title: string; matchedFields: string[]; snippet: string }>;
    };

    expect(payload.count).toBe(1);
    expect(payload.notes[0]?.title).toBe("Search Candidate");
    expect(payload.notes[0]?.matchedFields).toContain("body");
    expect(payload.notes[0]?.snippet).toContain("workflow");
  });

  test("notes_update revises an existing note in place", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const createResult = await tools.notes_new.handler(
      {
        title: "Editable Note",
        body: "Original body.",
      },
      {} as never,
    );
    const createPayload = JSON.parse(firstContentText(createResult)) as {
      id: string;
      filePath: string;
    };

    const updateResult = await tools.notes_update.handler(
      {
        id: createPayload.id,
        body: "Updated body.",
        tags: ["revised"],
      },
      {} as never,
    );
    const updatePayload = JSON.parse(firstContentText(updateResult)) as {
      title: string;
      tags: string[];
    };

    expect(updatePayload.title).toBe("Editable Note");
    expect(updatePayload.tags).toEqual(["revised"]);

    const updatedContent = await fs.readFile(
      path.join(project.root, createPayload.filePath),
      "utf8",
    );
    expect(updatedContent).toContain("Updated body.");
  });

  test("notes_rename updates the note title and filename", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const createResult = await tools.notes_new.handler(
      {
        title: "Rename Source",
        body: "The original note body.",
      },
      {} as never,
    );
    const createPayload = JSON.parse(firstContentText(createResult)) as {
      id: string;
      filePath: string;
    };

    const renameResult = await tools.notes_rename.handler(
      {
        id: createPayload.id,
        title: "Rename Target",
      },
      {} as never,
    );
    const renamePayload = JSON.parse(firstContentText(renameResult)) as {
      id: string;
      title: string;
      previousFilePath: string;
      filePath: string;
    };

    expect(renamePayload.id).toBe(createPayload.id);
    expect(renamePayload.title).toBe("Rename Target");
    expect(renamePayload.previousFilePath).toBe(createPayload.filePath);
    expect(renamePayload.filePath).toContain("Rename Target");

    const renamedContent = await fs.readFile(
      path.join(project.root, renamePayload.filePath),
      "utf8",
    );
    expect(renamedContent).toContain("Rename Target");
  });

  test("notes_delete removes an existing note", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const createResult = await tools.notes_new.handler(
      {
        title: "Delete Source",
        body: "A note to remove.",
      },
      {} as never,
    );
    const createPayload = JSON.parse(firstContentText(createResult)) as {
      id: string;
      filePath: string;
    };

    const deleteResult = await tools.notes_delete.handler(
      {
        id: createPayload.id,
      },
      {} as never,
    );
    const deletePayload = JSON.parse(firstContentText(deleteResult)) as {
      id: string;
      title: string;
      filePath: string;
    };

    expect(deletePayload.id).toBe(createPayload.id);
    expect(deletePayload.title).toBe("Delete Source");
    await expect(
      fs.stat(path.join(project.root, deletePayload.filePath)),
    ).rejects.toThrow();
  });

  test("inspect and bundle preview report live workspace planning data", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const inspectResult = await tools.inspect.handler(
      { tokenBreakdown: true },
      {} as never,
    );
    const inspectPayload = JSON.parse(firstContentText(inspectResult)) as {
      command: string;
      summary: { projectName: string; bundleDir: string; sectionCount: number };
      bundleComparison: { available: boolean };
      tokenBreakdown?: { totalTokenCount: number };
    };

    expect(inspectPayload.command).toBe("inspect");
    expect(inspectPayload.summary.projectName).toBe("demo");
    expect(inspectPayload.summary.sectionCount).toBeGreaterThan(0);
    expect(inspectPayload.bundleComparison.available).toBe(false);
    expect(inspectPayload.tokenBreakdown).toBeDefined();

    const bundleResult = await tools.bundle.handler({}, {} as never);
    const bundlePayload = JSON.parse(firstContentText(bundleResult)) as {
      command: string;
      bundleDir: string;
      note: string;
    };

    expect(bundlePayload.command).toBe("bundle preview");
    expect(bundlePayload.bundleDir).toContain("dist");
    expect(bundlePayload.note).toContain("live workspace");
  });

  test("doctor workflow recommends an ordered path for mixed tasks", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const result = await tools.doctor_workflow.handler(
      {
        task: "inspect the plan, bundle a handoff snapshot, and update notes in MCP",
      },
      {} as never,
    );
    const payload = JSON.parse(firstContentText(result)) as {
      mode: string;
      sequence: string[];
      reason: string;
    };

    expect(payload.mode).toBe("inspect");
    expect(payload.sequence).toEqual(["inspect", "bundle", "mcp"]);
    expect(payload.reason).toContain("live note work");
  });

  test("notes_graph returns reachable notes from a seed note", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const createA = await tools.notes_new.handler(
      { title: "Graph Root", body: "See [[Graph Hop]]." },
      {} as never,
    );
    const idA = (JSON.parse(firstContentText(createA)) as { id: string }).id;

    await tools.notes_new.handler(
      { title: "Graph Hop", body: "Terminal note." },
      {} as never,
    );

    const result = await getTool(
      tools as unknown as Record<string, RegisteredTool>,
      "notes_graph",
    ).handler({ id: idA, depth: 2 }, {} as never);
    const payload = JSON.parse(firstContentText(result)) as {
      command: string;
      id: string;
      title: string;
      depth: number;
      reachableCount: number;
      reachable: Array<{ noteId: string; depth: number; title: string }>;
    };

    expect(payload.command).toBe("notes graph");
    expect(payload.id).toBe(idA);
    expect(payload.title).toBe("Graph Root");
    expect(payload.depth).toBe(2);
    expect(payload.reachableCount).toBe(1);
    expect(payload.reachable[0]?.title).toBe("Graph Hop");
    expect(payload.reachable[0]?.depth).toBe(1);
  });

  test("notes_links reports unresolved links for a created note", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const tools = getRegisteredTools(server);

    const createResult = await tools.notes_new.handler(
      {
        title: "Link Audit",
        body: "This note points to [[Missing Note]].",
      },
      {} as never,
    );
    const createPayload = JSON.parse(firstContentText(createResult)) as {
      id: string;
      filePath: string;
    };

    const createdNote = path.join(project.root, createPayload.filePath);
    await fs.writeFile(
      createdNote,
      `---
id: ${createPayload.id}
aliases: []
tags: []
---

# Link Audit

This note points to [[Missing Note]].
`,
      "utf8",
    );

    const result = await tools.notes_links.handler(
      { id: createPayload.id },
      {} as never,
    );
    const payload = JSON.parse(firstContentText(result)) as {
      brokenCount: number;
      brokenLinks: Array<{ reference: string }>;
    };

    expect(payload.brokenCount).toBe(1);
    expect(payload.brokenLinks[0]?.reference).toContain("Missing Note");
  });
});
