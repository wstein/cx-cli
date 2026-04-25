import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  checkNoteCoverage,
  checkNotesConsistency,
} from "../../notes/consistency.js";
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
import { compileNotesExtractBundle } from "../../notes/extract.js";
import {
  buildNoteGraph,
  buildUnifiedNoteGraph,
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
const NOTES_CHECK_TOOL = {
  name: "notes_check",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_DRIFT_TOOL = {
  name: "notes_drift",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_TRACE_TOOL = {
  name: "notes_trace",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_EXTRACT_TOOL = {
  name: "notes_extract",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_ASK_TOOL = {
  name: "notes_ask",
  capability: "observe",
  stability: "STABLE",
} as const satisfies CxMcpToolDefinition;
const NOTES_COVERAGE_TOOL = {
  name: "notes_coverage",
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
  NOTES_CHECK_TOOL,
  NOTES_DRIFT_TOOL,
  NOTES_TRACE_TOOL,
  NOTES_EXTRACT_TOOL,
  NOTES_ASK_TOOL,
  NOTES_COVERAGE_TOOL,
] as const satisfies readonly CxMcpToolDefinition[];

function buildNotesTracePayload(params: {
  workspace: CxMcpWorkspace;
  graph: Awaited<ReturnType<typeof buildNoteGraph>>;
  noteId: string;
}) {
  const note = params.graph.notes.get(params.noteId);
  if (!note) {
    throw new CxError(`Note not found: ${params.noteId}`, 2);
  }

  const outgoing = getOutgoingLinks(params.graph, params.noteId);
  const backlinks = getBacklinks(params.graph, params.noteId);
  const codeFiles = getCodeReferences(params.graph, params.noteId);
  const claims = note.claims ?? [];
  const specRefs = claims
    .flatMap((claim) => (claim.specRef === undefined ? [] : [claim.specRef]))
    .sort((left, right) => left.localeCompare(right, "en"));
  const claimCodeRefs = claims
    .flatMap((claim) => claim.codeRefs)
    .sort((left, right) => left.localeCompare(right, "en"));
  const testRefs = claims
    .flatMap((claim) => claim.testRefs)
    .sort((left, right) => left.localeCompare(right, "en"));
  const docRefs = claims
    .flatMap((claim) => claim.docRefs)
    .sort((left, right) => left.localeCompare(right, "en"));

  return {
    command: "notes trace",
    note: {
      id: note.id,
      title: note.title,
      target: note.target,
      kind: note.kind,
      path: relativePosix(params.workspace.sourceRoot, note.filePath),
      summary: note.summary,
      tags: note.tags ?? [],
      aliases: note.aliases ?? [],
      supersedes: note.supersedes ?? [],
      claims,
    },
    linkedNotes: outgoing,
    linkedSpecSections: specRefs,
    linkedCodeFiles: [...new Set([...codeFiles, ...claimCodeRefs])],
    linkedTests: [...new Set(testRefs)],
    linkedDocs: [...new Set(docRefs)],
    reverseBacklinks: backlinks,
    unresolvedRefs: getBrokenLinks(params.graph, params.noteId),
  };
}

async function buildNotesAskPayload(params: {
  workspace: CxMcpWorkspace;
  question: string;
}) {
  const graph = await buildNoteGraph(
    "notes",
    params.workspace.sourceRoot,
    true,
  );
  const terms = params.question
    .toLowerCase()
    .split(/[^a-z0-9-]+/u)
    .filter((term) => term.length >= 3);
  const matches = [...graph.notes.values()]
    .map((note) => {
      const haystack =
        `${note.title} ${note.summary} ${(note.tags ?? []).join(" ")}`.toLowerCase();
      const score = terms.reduce(
        (sum, term) => sum + (haystack.includes(term) ? 1 : 0),
        0,
      );
      return { note, score };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.note.title.localeCompare(right.note.title, "en"),
    )
    .slice(0, 10);

  const matchedNotes = matches.map(({ note, score }) => ({
    id: note.id,
    title: note.title,
    path: relativePosix(params.workspace.sourceRoot, note.filePath),
    summary: note.summary,
    score,
  }));
  const matchedCode = [
    ...new Set(
      matches.flatMap(({ note }) => getCodeReferences(graph, note.id)),
    ),
  ].sort((left, right) => left.localeCompare(right, "en"));
  const confidence =
    matchedNotes.length === 0
      ? "low"
      : matchedNotes.length < 3
        ? "medium"
        : "high";

  return {
    command: "notes ask",
    question: params.question,
    matchedNotes,
    matchedSpecs: [],
    matchedCode,
    matchedTests: [],
    matchedDocs: [],
    confidence,
    unresolvedGaps:
      matchedNotes.length === 0
        ? ["No note summaries or tags matched the question."]
        : [],
    answerScaffold:
      matchedNotes.length === 0
        ? "No answer scaffold is available without note evidence."
        : "Use the matched notes as intent evidence, then verify linked code/tests/docs before writing a final answer.",
  };
}

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
      title: "Inspect note graph",
      description: `${tierLabel(NOTES_GRAPH_TOOL.stability)} Return note reachability for a seed note, or the unified note/spec/code/test/docs graph when format=json and id is omitted.`,
      inputSchema: z.object({
        id: z.string().min(1).optional(),
        depth: z.number().int().positive().max(10).optional(),
        format: z.literal("json").optional(),
      }),
    },
    async (args: Record<string, unknown>) => {
      if (args.format === "json" && args.id === undefined) {
        const graph = await buildUnifiedNoteGraph(
          "notes",
          workspace.sourceRoot,
          true,
          {
            frontmatter: workspace.config.notes.frontmatter,
          },
        );
        return jsonToolResult({
          command: "notes graph",
          format: "json",
          ...graph,
        });
      }

      if (typeof args.id !== "string") {
        throw new CxError(
          "id is required for notes_graph unless format=json is used.",
          2,
        );
      }
      const depth =
        typeof args.depth === "number" && args.depth > 0
          ? (args.depth as number)
          : 2;
      const graph = await buildNoteGraph("notes", workspace.sourceRoot, false);
      const note = graph.notes.get(args.id);
      if (!note) {
        throw new CxError(`Note not found: ${args.id}`, 2);
      }

      const reachable = getReachableNotes(graph, args.id, depth);
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

  registerCxMcpTool(
    server,
    workspace,
    NOTES_CHECK_TOOL,
    {
      title: "Check notes",
      description: `${tierLabel(NOTES_CHECK_TOOL.stability)} Validate notes, summaries, links, graph consistency, cognition quality, and drift pressure.`,
      inputSchema: z.object({}),
    },
    async () => {
      const report = await checkNotesConsistency(
        "notes",
        workspace.sourceRoot,
        {
          frontmatter: workspace.config.notes.frontmatter,
        },
      );
      return jsonToolResult({
        command: "notes check",
        ...report,
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_DRIFT_TOOL,
    {
      title: "Check note drift",
      description: `${tierLabel(NOTES_DRIFT_TOOL.stability)} Report note validation errors, code-path warnings, current-note warnings, and drift-pressured notes.`,
      inputSchema: z.object({}),
    },
    async () => {
      const report = await checkNotesConsistency(
        "notes",
        workspace.sourceRoot,
        {
          frontmatter: workspace.config.notes.frontmatter,
        },
      );
      return jsonToolResult({
        command: "notes drift",
        valid:
          report.validationErrors.length === 0 &&
          report.codePathWarnings.length === 0 &&
          report.currentFeatureWarnings.length === 0,
        validationErrors: report.validationErrors,
        codePathWarnings: report.codePathWarnings,
        currentFeatureWarnings: report.currentFeatureWarnings,
        evaluatedNotes: report.evaluatedNotes.filter(
          (note) => note.driftWarningCount > 0,
        ),
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_TRACE_TOOL,
    {
      title: "Trace note evidence",
      description: `${tierLabel(NOTES_TRACE_TOOL.stability)} Trace one note to linked notes, specs, code files, tests, docs, supersession metadata, and backlinks.`,
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async (args: Record<string, unknown>) => {
      const graph = await buildNoteGraph("notes", workspace.sourceRoot, true);
      return jsonToolResult(
        buildNotesTracePayload({
          workspace,
          graph,
          noteId: args.id as string,
        }),
      );
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_EXTRACT_TOOL,
    {
      title: "Extract notes evidence bundle",
      description: `${tierLabel(NOTES_EXTRACT_TOOL.stability)} Compile a profile-scoped notes evidence bundle without writing files.`,
      inputSchema: z.object({
        profile: z.string().min(1),
        format: z.enum(["markdown", "xml", "json", "plain"]).optional(),
      }),
    },
    async (args: Record<string, unknown>) => {
      const result = await compileNotesExtractBundle({
        workspaceRoot: workspace.sourceRoot,
        profileName: args.profile as string,
        configPath: "cx.toml",
        ...(args.format !== undefined && {
          format: args.format as "markdown" | "xml" | "json" | "plain",
        }),
      });
      return jsonToolResult({
        command: "notes extract",
        profile: result.bundle.profile.name,
        format: result.format,
        selectedNoteCount: result.bundle.notes.length,
        sectionCount: result.bundle.sections.length,
        bundle: result.bundle,
        content: result.content,
      });
    },
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_ASK_TOOL,
    {
      title: "Ask notes question",
      description: `${tierLabel(NOTES_ASK_TOOL.stability)} Resolve a repository question to note-first evidence and an answer scaffold.`,
      inputSchema: z.object({
        question: z.string().min(1),
      }),
    },
    async (args: Record<string, unknown>) =>
      jsonToolResult(
        await buildNotesAskPayload({
          workspace,
          question: args.question as string,
        }),
      ),
  );

  registerCxMcpTool(
    server,
    workspace,
    NOTES_COVERAGE_TOOL,
    {
      title: "Check notes coverage",
      description: `${tierLabel(NOTES_COVERAGE_TOOL.stability)} Report MCP tool documentation coverage in notes.`,
      inputSchema: z.object({}),
    },
    async () => {
      const coverage = await checkNoteCoverage("notes", workspace.sourceRoot);
      return jsonToolResult({
        command: "notes coverage",
        ...coverage,
      });
    },
  );
}
