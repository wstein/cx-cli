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

function getRegisteredTools(server: unknown): Record<string, RegisteredTool> {
  return (server as { _registeredTools: Record<string, RegisteredTool> })
    ._registeredTools;
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

async function createWorkspace(): Promise<{
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
`,
    "utf8",
  );

  await fs.writeFile(
    mcpPath,
    `extends = "cx.toml"

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
    const instructions = (server as {
      server: { _instructions: string };
    }).server._instructions;

    expect(toolNames).toEqual([
      "grep",
      "list",
      "notes_backlinks",
      "notes_code_links",
      "notes_links",
      "notes_list",
      "notes_new",
      "notes_orphans",
      "notes_read",
      "notes_search",
      "notes_update",
      "read",
    ]);
    expect(instructions).toContain("immutable snapshots");
    expect(instructions).toContain("interactive exploration");
  });

  test("list returns workspace files from the active cx scope", async () => {
    const project = await createWorkspace();
    const config = await loadCxConfig(project.mcpPath);
    const server = createCxMcpServer({
      configPath: project.mcpPath,
      config,
    });
    const listTool = getRegisteredTools(server).list;

    const result = await listTool.handler({}, {} as never);
    const payload = JSON.parse(result.content[0].text) as {
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
    const payload = JSON.parse(result.content[0].text) as {
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
    const payload = JSON.parse(result.content[0].text) as {
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
    const createPayload = JSON.parse(createResult.content[0].text) as {
      id: string;
      filePath: string;
      title: string;
      tags: string[];
    };

    expect(createPayload.title).toBe("Agent Insight");
    expect(createPayload.tags).toEqual(["agent", "workflow"]);

    const createdNote = path.join(project.root, createPayload.filePath);
    const noteContent = await fs.readFile(createdNote, "utf8");
    expect(noteContent).toContain("This note records an important observation.");

    const listResult = await tools.notes_list.handler({}, {} as never);
    const listPayload = JSON.parse(listResult.content[0].text) as {
      count: number;
      notes: Array<{ title: string; summary: string }>;
    };

    expect(listPayload.count).toBeGreaterThan(0);
    expect(listPayload.notes.some((note) => note.title === "Agent Insight")).toBe(
      true,
    );
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
    const createPayload = JSON.parse(createResult.content[0].text) as {
      id: string;
      filePath: string;
    };

    const result = await tools.notes_read.handler(
      { id: createPayload.id },
      {} as never,
    );
    const payload = JSON.parse(result.content[0].text) as {
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
    const payload = JSON.parse(result.content[0].text) as {
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
    const createPayload = JSON.parse(createResult.content[0].text) as {
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
    const updatePayload = JSON.parse(updateResult.content[0].text) as {
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
    const createPayload = JSON.parse(createResult.content[0].text) as {
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
    const payload = JSON.parse(result.content[0].text) as {
      brokenCount: number;
      brokenLinks: Array<{ reference: string }>;
    };

    expect(payload.brokenCount).toBe(1);
    expect(payload.brokenLinks[0]?.reference).toContain("Missing Note");
  });
});
