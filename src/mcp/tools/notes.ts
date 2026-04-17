import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createNewNote,
  deleteNote,
  readNote,
  renameNote,
  searchNotes,
  updateNote,
} from "../../notes/crud.js";
import {
  buildNoteGraph,
  getBacklinks,
  getBrokenLinks,
  getCodeReferences,
  getOutgoingLinks,
} from "../../notes/graph.js";
import { validateNotes } from "../../notes/validate.js";
import { CxError } from "../../shared/errors.js";
import { relativePosix } from "../../shared/fs.js";
import { withPolicyEnforcement } from "../enforce.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import { jsonToolResult } from "./utils.js";

export function registerNotesTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  const notesDir = path.join(workspace.sourceRoot, "notes");

  const notesNewHandler = withPolicyEnforcement(
    "notes_new",
    async (args: Record<string, unknown>) => {
      const note = await createNewNote(args.title as string, {
        notesDir,
        tags: args.tags as string[] | undefined,
        body: args.body as string | undefined,
      });

      return jsonToolResult({
        command: "notes new",
        id: note.id,
        title: args.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        tags: (args.tags as string[] | undefined) ?? [],
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_new",
    {
      title: "Create note",
      description: `${tierLabel("notes_new")} Create a new note in the workspace notes directory with optional tags and body text.`,
      inputSchema: z.object({
        title: z.string().min(1),
        tags: z.array(z.string().min(1)).optional(),
        body: z.string().min(1).optional(),
      }),
    },
    notesNewHandler,
  );

  const notesReadHandler = withPolicyEnforcement(
    "notes_read",
    async (args: Record<string, unknown>) => {
      const note = await readNote(args.id as string, {
        notesDir,
      });

      return jsonToolResult({
        command: "notes read",
        ...note,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_read",
    {
      title: "Read note",
      description: `${tierLabel("notes_read")} Read a note from the workspace notes directory with parsed metadata and body content.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    notesReadHandler,
  );

  const notesUpdateHandler = withPolicyEnforcement(
    "notes_update",
    async (args: Record<string, unknown>) => {
      const note = await updateNote(args.id as string, {
        notesDir,
        title: args.title as string | undefined,
        tags: args.tags as string[] | undefined,
        body: args.body as string | undefined,
      });

      return jsonToolResult({
        command: "notes update",
        id: note.id,
        title: note.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        tags: note.tags,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_update",
    {
      title: "Update note",
      description: `${tierLabel("notes_update")} Update an existing note in the workspace notes directory while preserving its file path.`,
      inputSchema: z.object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        tags: z.array(z.string().min(1)).optional(),
        body: z.string().min(1).optional(),
      }),
    },
    notesUpdateHandler,
  );

  const notesRenameHandler = withPolicyEnforcement(
    "notes_rename",
    async (args: Record<string, unknown>) => {
      const note = await renameNote(args.id as string, args.title as string, {
        notesDir,
      });

      return jsonToolResult({
        command: "notes rename",
        id: note.id,
        title: note.title,
        previousFilePath: relativePosix(
          workspace.sourceRoot,
          note.previousFilePath,
        ),
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        tags: note.tags,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_rename",
    {
      title: "Rename note",
      description: `${tierLabel("notes_rename")} Rename an existing note in the workspace notes directory and update its title in place.`,
      inputSchema: z.object({
        id: z.string().min(1),
        title: z.string().min(1),
      }),
    },
    notesRenameHandler,
  );

  const notesDeleteHandler = withPolicyEnforcement(
    "notes_delete",
    async (args: Record<string, unknown>) => {
      const note = await deleteNote(args.id as string, {
        notesDir,
      });

      return jsonToolResult({
        command: "notes delete",
        id: note.id,
        title: note.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_delete",
    {
      title: "Delete note",
      description: `${tierLabel("notes_delete")} Delete an existing note from the workspace notes directory.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    notesDeleteHandler,
  );

  const notesSearchHandler = withPolicyEnforcement(
    "notes_search",
    async (args: Record<string, unknown>) => {
      const result = await searchNotes(args.query as string, {
        notesDir,
        regex: args.regex as boolean | undefined,
        caseSensitive: args.caseSensitive as boolean | undefined,
        limit: args.limit as number | undefined,
        tags: args.tags as string[] | undefined,
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
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_search",
    {
      title: "Search notes",
      description: `${tierLabel("notes_search")} Search the workspace notes directory by title, aliases, tags, summary, or body text.`,
      inputSchema: z.object({
        query: z.string().min(1),
        regex: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        limit: z.number().int().positive().max(100).optional(),
        tags: z.array(z.string().min(1)).optional(),
      }),
    },
    notesSearchHandler,
  );

  const notesListHandler = withPolicyEnforcement(
    "notes_list",
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
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_list",
    {
      title: "List notes",
      description: `${tierLabel("notes_list")} List notes in the workspace notes directory with summaries and tags.`,
      inputSchema: z.object({}),
    },
    notesListHandler,
  );

  const notesBacklinksHandler = withPolicyEnforcement(
    "notes_backlinks",
    async (args: Record<string, unknown>) => {
      const graph = await buildNoteGraph("notes", workspace.sourceRoot);
      const note = graph.notes.get(args.id as string);
      if (!note) {
        throw new CxError(`Note not found: ${args.id}`, 2);
      }

      const backlinks = getBacklinks(graph, args.id as string);
      return jsonToolResult({
        command: "notes backlinks",
        noteId: args.id,
        noteTitle: note.title,
        count: backlinks.length,
        backlinks,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_backlinks",
    {
      title: "List note backlinks",
      description: `${tierLabel("notes_backlinks")} List notes that link to a specific note from the workspace notes graph.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    notesBacklinksHandler,
  );

  const notesOrphansHandler = withPolicyEnforcement(
    "notes_orphans",
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
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_orphans",
    {
      title: "List orphan notes",
      description: `${tierLabel("notes_orphans")} List notes with no incoming or outgoing links in the workspace notes graph.`,
      inputSchema: z.object({}),
    },
    notesOrphansHandler,
  );

  const notesCodeLinksHandler = withPolicyEnforcement(
    "notes_code_links",
    async (args: Record<string, unknown>) => {
      const graph = await buildNoteGraph("notes", workspace.sourceRoot);
      const note = graph.notes.get(args.id as string);
      if (!note) {
        throw new CxError(`Note not found: ${args.id}`, 2);
      }

      const codeFiles = getCodeReferences(graph, args.id as string);
      return jsonToolResult({
        command: "notes code-links",
        noteId: args.id,
        noteTitle: note.title,
        count: codeFiles.length,
        codeFiles,
      });
    },
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_code_links",
    {
      title: "List code references",
      description: `${tierLabel("notes_code_links")} List source files that reference a note through wikilinks in code comments or text.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    notesCodeLinksHandler,
  );

  const notesLinksHandler = withPolicyEnforcement(
    "notes_links",
    async (args: Record<string, unknown>) => {
      const graph = await buildNoteGraph("notes", workspace.sourceRoot);

      if (args.id) {
        const note = graph.notes.get(args.id as string);
        if (!note) {
          throw new CxError(`Note not found: ${args.id}`, 2);
        }

        const outgoing = getOutgoingLinks(graph, args.id as string);
        const broken = getBrokenLinks(graph, args.id as string);

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
    workspace.policy,
    workspace.auditLogger,
  );

  server.registerTool(
    "notes_links",
    {
      title: "Audit note links",
      description: `${tierLabel("notes_links")} Audit unresolved note and code references, or inspect one note's outgoing links.`,
      inputSchema: z.object({
        id: z.string().min(1).optional(),
      }),
    },
    notesLinksHandler,
  );
}
