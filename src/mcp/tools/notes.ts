import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createNewNote,
  deleteNote,
  describeNoteTarget,
  listNotes,
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
  getReachableNotes,
} from "../../notes/graph.js";
import { validateNotes } from "../../notes/validate.js";
import { CxError } from "../../shared/errors.js";
import { relativePosix } from "../../shared/fs.js";
import { tierLabel } from "../tiers.js";
import type { CxMcpWorkspace } from "../workspace.js";
import type { CxMcpToolDefinition } from "./catalog.js";
import { registerCxMcpTool } from "./register.js";
import { jsonToolResult } from "./utils.js";

const NOTES_NEW_TOOL = {
  name: "notes_new",
  capability: "mutate",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_READ_TOOL = {
  name: "notes_read",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_UPDATE_TOOL = {
  name: "notes_update",
  capability: "mutate",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_RENAME_TOOL = {
  name: "notes_rename",
  capability: "mutate",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_DELETE_TOOL = {
  name: "notes_delete",
  capability: "mutate",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_SEARCH_TOOL = {
  name: "notes_search",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_LIST_TOOL = {
  name: "notes_list",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_BACKLINKS_TOOL = {
  name: "notes_backlinks",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_ORPHANS_TOOL = {
  name: "notes_orphans",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_CODE_LINKS_TOOL = {
  name: "notes_code_links",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_LINKS_TOOL = {
  name: "notes_links",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_GRAPH_TOOL = {
  name: "notes_graph",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;

export const NOTES_TOOL_DEFINITIONS = [
  NOTES_NEW_TOOL,
  NOTES_READ_TOOL,
  NOTES_UPDATE_TOOL,
  NOTES_RENAME_TOOL,
  NOTES_DELETE_TOOL,
  NOTES_SEARCH_TOOL,
  NOTES_LIST_TOOL,
  NOTES_BACKLINKS_TOOL,
  NOTES_ORPHANS_TOOL,
  NOTES_CODE_LINKS_TOOL,
  NOTES_LINKS_TOOL,
  NOTES_GRAPH_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

export function registerNotesTools(
  server: McpServer,
  workspace: CxMcpWorkspace,
): void {
  const notesDir = path.join(workspace.sourceRoot, "notes");

  registerCxMcpTool(
    server,
    workspace,
    NOTES_NEW_TOOL,
    {
      title: "Create note",
      description: `${tierLabel(NOTES_NEW_TOOL.stability)} Create a new note in the workspace notes directory with optional tags and body text.`,
      inputSchema: z.object({
        title: z.string().min(1),
        tags: z.array(z.string().min(1)).optional(),
        body: z.string().min(1).optional(),
        target: z.string().min(1).optional(),
      }),
    },
    async (args: Record<string, unknown>) => {
      const note = await createNewNote(args.title as string, {
        notesDir,
        tags: args.tags as string[] | undefined,
        body: args.body as string | undefined,
        target: typeof args.target === "string" ? args.target : undefined,
      });

      return jsonToolResult({
        command: "notes new",
        id: note.id,
        title: args.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        tags: (args.tags as string[] | undefined) ?? [],
        target: typeof args.target === "string" ? args.target : "current",
        availability:
          typeof args.target === "string"
            ? describeNoteTarget(args.target)
            : describeNoteTarget("current"),
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_READ_TOOL,
    {
      title: "Read note",
      description: `${tierLabel(NOTES_READ_TOOL.stability)} Read a note from the workspace notes directory with parsed metadata and body content.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async (args: Record<string, unknown>) => {
      const note = await readNote(args.id as string, {
        notesDir,
      });

      return jsonToolResult({
        command: "notes read",
        ...note,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        availability: describeNoteTarget(note.target),
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_UPDATE_TOOL,
    {
      title: "Update note",
      description: `${tierLabel(NOTES_UPDATE_TOOL.stability)} Update an existing note in the workspace notes directory while preserving its file path.`,
      inputSchema: z.object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        tags: z.array(z.string().min(1)).optional(),
        body: z.string().min(1).optional(),
        target: z.string().min(1).optional(),
      }),
    },
    async (args: Record<string, unknown>) => {
      const note = await updateNote(args.id as string, {
        notesDir,
        title: args.title as string | undefined,
        tags: args.tags as string[] | undefined,
        body: args.body as string | undefined,
        target: typeof args.target === "string" ? args.target : undefined,
      });

      return jsonToolResult({
        command: "notes update",
        id: note.id,
        title: note.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        tags: note.tags,
        target: note.target,
        availability: describeNoteTarget(note.target),
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_RENAME_TOOL,
    {
      title: "Rename note",
      description: `${tierLabel(NOTES_RENAME_TOOL.stability)} Rename an existing note in the workspace notes directory and update its title in place.`,
      inputSchema: z.object({
        id: z.string().min(1),
        title: z.string().min(1),
      }),
    },
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
        target: note.target,
        availability: describeNoteTarget(note.target),
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_DELETE_TOOL,
    {
      title: "Delete note",
      description: `${tierLabel(NOTES_DELETE_TOOL.stability)} Delete an existing note from the workspace notes directory.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async (args: Record<string, unknown>) => {
      const note = await deleteNote(args.id as string, {
        notesDir,
      });

      return jsonToolResult({
        command: "notes delete",
        id: note.id,
        title: note.title,
        filePath: relativePosix(workspace.sourceRoot, note.filePath),
        target: note.target,
        availability: describeNoteTarget(note.target),
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_SEARCH_TOOL,
    {
      title: "Search notes",
      description: `${tierLabel(NOTES_SEARCH_TOOL.stability)} Search the workspace notes directory by title, aliases, tags, summary, or body text.`,
      inputSchema: z.object({
        query: z.string().min(1),
        regex: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        limit: z.number().int().positive().max(100).optional(),
        tags: z.array(z.string().min(1)).optional(),
      }),
    },
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
          availability: describeNoteTarget(note.target),
        })),
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_LIST_TOOL,
    {
      title: "List notes",
      description: `${tierLabel(NOTES_LIST_TOOL.stability)} List notes in the workspace notes directory with summaries and tags.`,
      inputSchema: z.object({}),
    },
    async () => {
      const validated = await validateNotes("notes", workspace.sourceRoot, {
        frontmatter: workspace.config.notes.frontmatter,
      });
      const indexedNotes = new Map(
        validated.notes.map((note) => [note.id, note]),
      );
      const notes = (
        await listNotes("notes", {
          workspaceRoot: workspace.sourceRoot,
        })
      ).map((note) => {
        const indexed = indexedNotes.get(note.id);
        return {
          id: note.id,
          target: note.target,
          availability: describeNoteTarget(note.target),
          title: note.title,
          fileName: note.fileName,
          tags: note.tags ?? [],
          summary: indexed?.summary ?? "",
          codeLinks: indexed?.codeLinks ?? [],
        };
      });

      return jsonToolResult({
        command: "notes list",
        count: notes.length,
        notes,
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_BACKLINKS_TOOL,
    {
      title: "List note backlinks",
      description: `${tierLabel(NOTES_BACKLINKS_TOOL.stability)} List notes that link to a specific note from the workspace notes graph.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
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
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_ORPHANS_TOOL,
    {
      title: "List orphan notes",
      description: `${tierLabel(NOTES_ORPHANS_TOOL.stability)} List notes with no incoming or outgoing links in the workspace notes graph.`,
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

  registerCxMcpTool(
    server,
    workspace,
    NOTES_CODE_LINKS_TOOL,
    {
      title: "List code references",
      description: `${tierLabel(NOTES_CODE_LINKS_TOOL.stability)} List source files that reference a note through wikilinks in code comments or text.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
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
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_LINKS_TOOL,
    {
      title: "Audit note links",
      description: `${tierLabel(NOTES_LINKS_TOOL.stability)} Audit unresolved note and code references, or inspect one note's outgoing links.`,
      inputSchema: z.object({
        id: z.string().min(1).optional(),
      }),
    },
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
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_GRAPH_TOOL,
    {
      title: "Note graph reachability",
      description: `${tierLabel(NOTES_GRAPH_TOOL.stability)} Return all notes reachable from a given note within a configurable hop depth following outgoing wikilinks.`,
      inputSchema: z.object({
        id: z.string().min(1),
        depth: z.number().int().positive().max(10).optional(),
      }),
    },
    async (args: Record<string, unknown>) => {
      const depth =
        typeof args.depth === "number" && args.depth > 0
          ? (args.depth as number)
          : 2;
      const graph = await buildNoteGraph("notes", workspace.sourceRoot, false);
      const note = graph.notes.get(args.id as string);
      if (!note) {
        throw new CxError(`Note not found: ${args.id}`, 2);
      }

      const reachable = getReachableNotes(graph, args.id as string, depth);
      return jsonToolResult({
        command: "notes graph",
        id: args.id,
        title: note.title,
        depth,
        reachableCount: reachable.length,
        reachable,
      });
    },
  );
}
