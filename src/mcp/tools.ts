import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "node:path";
import { z } from "zod";

import {
  createNewNote,
  deleteNote,
  readNote,
  renameNote,
  searchNotes,
  updateNote,
} from "../notes/crud.js";
import { collectDoctorMcpReport } from "../cli/commands/doctor-mcp.js";
import { collectDoctorOverlapsReport } from "../cli/commands/doctor-overlaps.js";
import { collectDoctorSecretsReport } from "../cli/commands/doctor-secrets.js";
import { recommendWorkflow } from "../cli/commands/doctor.js";
import { collectInspectReport } from "../cli/commands/inspect.js";
import {
  buildNoteGraph,
  getBacklinks,
  getBrokenLinks,
  getCodeReferences,
  getOutgoingLinks,
} from "../notes/graph.js";
import { validateNotes } from "../notes/validate.js";
import { CxError } from "../shared/errors.js";
import { relativePosix } from "../shared/fs.js";
import type { CxMcpWorkspace } from "./workspace.js";
import {
  grepWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  replaceWorkspaceSpan,
} from "./workspace.js";

function jsonToolResult(value: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [
      {
        type: "text",
        text: `${JSON.stringify(value, null, 2)}\n`,
      },
    ],
  };
}

export function registerCxMcpTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  const notesDir = path.join(workspace.sourceRoot, "notes");

  server.registerTool(
    "list",
    {
      title: "List workspace files",
      description:
        "List files from the cx workspace file scope using the active cx configuration.",
      inputSchema: z.object({
        prefix: z.string().optional(),
      }),
    },
    async (args) => {
      const files = await listWorkspaceFiles(workspace, args.prefix);
      return jsonToolResult({
        sourceRoot: workspace.sourceRoot,
        fileCount: files.length,
        files,
      });
    },
  );

  server.registerTool(
    "grep",
    {
      title: "Search workspace files",
      description:
        "Search files from the cx workspace file scope with a string or regular expression.",
      inputSchema: z.object({
        pattern: z.string().min(1),
        regex: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        prefix: z.string().optional(),
        limit: z.number().int().positive().max(1000).optional(),
      }),
    },
    async (args) => {
      const query = {
        pattern: args.pattern,
        ...(args.regex !== undefined ? { regex: args.regex } : {}),
        ...(args.caseSensitive !== undefined
          ? { caseSensitive: args.caseSensitive }
          : {}),
        ...(args.prefix !== undefined ? { prefix: args.prefix } : {}),
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
      };
      const result = await grepWorkspaceFiles(workspace, query);

      return jsonToolResult(result);
    },
  );

  server.registerTool(
    "read",
    {
      title: "Read workspace file",
      description:
        "Read a text file from the cx workspace scope with optional line anchors.",
      inputSchema: z.object({
        path: z.string().min(1),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
      }),
    },
    async (args) => {
      const query = {
        path: args.path,
        ...(args.startLine !== undefined ? { startLine: args.startLine } : {}),
        ...(args.endLine !== undefined ? { endLine: args.endLine } : {}),
      };
      const result = await readWorkspaceFile(workspace, query);

      return jsonToolResult(result);
    },
  );

  server.registerTool(
    "doctor_mcp",
    {
      title: "Diagnose MCP profile",
      description:
        "Inspect the resolved MCP profile and inherited file scopes from the live workspace configuration.",
      inputSchema: z.object({}),
    },
    async () => {
      const report = await collectDoctorMcpReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor mcp",
        ...report,
      });
    },
  );

  server.registerTool(
    "doctor_workflow",
    {
      title: "Recommend workflow",
      description:
        "Recommend whether a task should use inspect, bundle preview, or MCP, including mixed-task sequences.",
      inputSchema: z.object({
        task: z.string().min(1),
      }),
    },
    async (args) => {
      const recommendation = recommendWorkflow(args.task);

      return jsonToolResult({
        command: "doctor workflow",
        task: args.task,
        ...recommendation,
      });
    },
  );

  server.registerTool(
    "doctor_overlaps",
    {
      title: "Diagnose section overlaps",
      description:
        "Inspect live workspace section ownership and duplicate file assignments.",
      inputSchema: z.object({}),
    },
    async () => {
      const report = await collectDoctorOverlapsReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor overlaps",
        ...report,
      });
    },
  );

  server.registerTool(
    "doctor_secrets",
    {
      title: "Diagnose secret hygiene",
      description:
        "Scan the live workspace file scope for suspicious secrets before a patch is written.",
      inputSchema: z.object({}),
    },
    async () => {
      const report = await collectDoctorSecretsReport({
        config: path.join(workspace.sourceRoot, "cx.toml"),
      });

      return jsonToolResult({
        command: "doctor secrets",
        ...report,
      });
    },
  );

  server.registerTool(
    "replace_repomix_span",
    {
      title: "Replace workspace span",
      description:
        "Replace an exact line span in a live workspace file. This acts on the workspace filesystem, not bundle artifacts.",
      inputSchema: z.object({
        path: z.string().min(1),
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive(),
        replacement: z.string(),
      }),
    },
    async (args) => {
      const result = await replaceWorkspaceSpan(workspace, {
        path: args.path,
        startLine: args.startLine,
        endLine: args.endLine,
        replacement: args.replacement,
      });

      return jsonToolResult({
        command: "replace repomix span",
        ...result,
      });
    },
  );

  server.registerTool(
    "inspect",
    {
      title: "Inspect live bundle plan",
      description:
        "Inspect the bundle plan derived from the live workspace files without reading bundle artifacts.",
      inputSchema: z.object({
        tokenBreakdown: z.boolean().optional(),
      }),
    },
    async (args) => {
      const report = await collectInspectReport({
        config: workspace.config,
        ...(args.tokenBreakdown !== undefined
          ? { tokenBreakdown: args.tokenBreakdown }
          : {}),
      });

      return jsonToolResult({
        command: "inspect",
        ...report,
      });
    },
  );

  server.registerTool(
    "bundle",
    {
      title: "Preview bundle snapshot",
      description:
        "Preview the current bundle snapshot from live workspace files. This tool does not read bundle artifacts for reasoning.",
      inputSchema: z.object({
        tokenBreakdown: z.boolean().optional(),
      }),
    },
    async (args) => {
      const report = await collectInspectReport({
        config: workspace.config,
        ...(args.tokenBreakdown !== undefined
          ? { tokenBreakdown: args.tokenBreakdown }
          : {}),
      });

      return jsonToolResult({
        command: "bundle preview",
        projectName: report.summary.projectName,
        sourceRoot: report.summary.sourceRoot,
        bundleDir: report.summary.bundleDir,
        sectionCount: report.summary.sectionCount,
        assetCount: report.summary.assetCount,
        unmatchedCount: report.summary.unmatchedCount,
        tokenBreakdown: report.tokenBreakdown ?? null,
        warnings: report.warnings,
        note:
          "Use cx bundle locally to write the artifact; this MCP preview stays on the live workspace.",
      });
    },
  );

  server.registerTool(
    "notes_new",
    {
      title: "Create note",
      description:
        "Create a new note in the workspace notes directory with optional tags and body text.",
      inputSchema: z.object({
        title: z.string().min(1),
        tags: z.array(z.string().min(1)).optional(),
        body: z.string().min(1).optional(),
      }),
    },
    async (args) => {
      const note = await createNewNote(args.title, {
        notesDir,
        tags: args.tags,
        body: args.body,
      });

      return jsonToolResult({
        command: "notes new",
        id: note.id,
        title: args.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        tags: args.tags ?? [],
      });
    },
  );

  server.registerTool(
    "notes_read",
    {
      title: "Read note",
      description:
        "Read a note from the workspace notes directory with parsed metadata and body content.",
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async (args) => {
      const note = await readNote(args.id, {
        notesDir,
      });

      return jsonToolResult({
        command: "notes read",
        ...note,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
      });
    },
  );

  server.registerTool(
    "notes_update",
    {
      title: "Update note",
      description:
        "Update an existing note in the workspace notes directory while preserving its file path.",
      inputSchema: z.object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        tags: z.array(z.string().min(1)).optional(),
        body: z.string().min(1).optional(),
      }),
    },
    async (args) => {
      const note = await updateNote(args.id, {
        notesDir,
        title: args.title,
        tags: args.tags,
        body: args.body,
      });

      return jsonToolResult({
        command: "notes update",
        id: note.id,
        title: note.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        tags: note.tags,
      });
    },
  );

  server.registerTool(
    "notes_rename",
    {
      title: "Rename note",
      description:
        "Rename an existing note in the workspace notes directory and update its title in place.",
      inputSchema: z.object({
        id: z.string().min(1),
        title: z.string().min(1),
      }),
    },
    async (args) => {
      const note = await renameNote(args.id, args.title, {
        notesDir,
      });

      return jsonToolResult({
        command: "notes rename",
        id: note.id,
        title: note.title,
        previousFilePath: relativePosix(workspace.sourceRoot, note.previousFilePath),
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        tags: note.tags,
      });
    },
  );

  server.registerTool(
    "notes_delete",
    {
      title: "Delete note",
      description:
        "Delete an existing note from the workspace notes directory.",
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async (args) => {
      const note = await deleteNote(args.id, {
        notesDir,
      });

      return jsonToolResult({
        command: "notes delete",
        id: note.id,
        title: note.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
      });
    },
  );

  server.registerTool(
    "notes_search",
    {
      title: "Search notes",
      description:
        "Search the workspace notes directory by title, aliases, tags, summary, or body text.",
      inputSchema: z.object({
        query: z.string().min(1),
        regex: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        limit: z.number().int().positive().max(100).optional(),
        tags: z.array(z.string().min(1)).optional(),
      }),
    },
    async (args) => {
      const result = await searchNotes(args.query, {
        notesDir,
        regex: args.regex,
        caseSensitive: args.caseSensitive,
        limit: args.limit,
        tags: args.tags,
      });

      return jsonToolResult({
        command: "notes search",
        query: result.query,
        count: result.count,
        notes: result.notes.map((note) => ({
          ...note,
          filePath: relativePosix(workspace.sourceRoot, note.filePath),
        })),
      });
    },
  );

  server.registerTool(
    "notes_list",
    {
      title: "List notes",
      description:
        "List notes in the workspace notes directory with summaries and tags.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await validateNotes("notes", workspace.sourceRoot);
      const notes = result.notes.map((note) => ({
        id: note.id,
        title: note.title,
        fileName: note.fileName,
        tags: note.tags ?? [],
        summary: note.summary,
      }));

      return jsonToolResult({
        command: "notes list",
        count: notes.length,
        notes,
      });
    },
  );

  server.registerTool(
    "notes_backlinks",
    {
      title: "List note backlinks",
      description:
        "List notes that link to a specific note from the workspace notes graph.",
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async (args) => {
      const graph = await buildNoteGraph("notes", workspace.sourceRoot);
      const note = graph.notes.get(args.id);
      if (!note) {
        throw new CxError(`Note not found: ${args.id}`, 2);
      }

      const backlinks = getBacklinks(graph, args.id);
      return jsonToolResult({
        command: "notes backlinks",
        noteId: args.id,
        noteTitle: note.title,
        count: backlinks.length,
        backlinks,
      });
    },
  );

  server.registerTool(
    "notes_orphans",
    {
      title: "List orphan notes",
      description:
        "List notes with no incoming or outgoing links in the workspace notes graph.",
      inputSchema: z.object({}),
    },
    async () => {
      const graph = await buildNoteGraph("notes", workspace.sourceRoot);
      const orphans = graph.orphans.map((id) => {
        const note = graph.notes.get(id);
        return {
          id,
          title: note?.title ?? "Unknown",
        };
      });

      return jsonToolResult({
        command: "notes orphans",
        count: orphans.length,
        orphans,
      });
    },
  );

  server.registerTool(
    "notes_code_links",
    {
      title: "List code references",
      description:
        "List source files that reference a note through wikilinks in code comments or text.",
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async (args) => {
      const graph = await buildNoteGraph("notes", workspace.sourceRoot);
      const note = graph.notes.get(args.id);
      if (!note) {
        throw new CxError(`Note not found: ${args.id}`, 2);
      }

      const codeFiles = getCodeReferences(graph, args.id);
      return jsonToolResult({
        command: "notes code-links",
        noteId: args.id,
        noteTitle: note.title,
        count: codeFiles.length,
        codeFiles,
      });
    },
  );

  server.registerTool(
    "notes_links",
    {
      title: "Audit note links",
      description:
        "Audit unresolved note and code references, or inspect one note's outgoing links.",
      inputSchema: z.object({
        id: z.string().min(1).optional(),
      }),
    },
    async (args) => {
      const graph = await buildNoteGraph("notes", workspace.sourceRoot);

      if (args.id) {
        const note = graph.notes.get(args.id);
        if (!note) {
          throw new CxError(`Note not found: ${args.id}`, 2);
        }

        const outgoing = getOutgoingLinks(graph, args.id);
        const broken = getBrokenLinks(graph, args.id);

        return jsonToolResult({
          command: "notes links",
          noteId: args.id,
          noteTitle: note.title,
          outgoing,
          outgoingCount: outgoing.length,
          brokenLinks: broken,
          brokenCount: broken.length,
        });
      }

      const broken = getBrokenLinks(graph);
      return jsonToolResult({
        command: "notes links",
        count: broken.length,
        brokenLinks: broken,
      });
    },
  );
}
