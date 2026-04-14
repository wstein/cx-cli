import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "node:path";
import { z } from "zod";

import {
  createNewNote,
  readNote,
  searchNotes,
  updateNote,
} from "../cli/commands/notes/common.js";
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
