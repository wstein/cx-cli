import fs from "node:fs/promises";
import path from "node:path";

import { listFilesRecursive, pathExists } from "../shared/fs.js";
import { toPosixPath } from "../shared/paths.js";
import {
  extractHeadings,
  extractWikilinkReferences,
  resolveWikilinkReference,
} from "./linking.js";
import type {
  NoteClaim,
  NoteMetadata,
  NoteValidationOptions,
} from "./validate.js";
import { validateNotes } from "./validate.js";

export interface NoteLink {
  fromNoteId: string;
  toNoteId: string;
  type: "wikilink" | "code-reference";
}

export interface NoteLinkIssue {
  fromNoteId: string;
  fromTitle: string;
  fromPath: string;
  reference: string;
  source: "note" | "code";
  reason: "unresolved" | "anchor-not-found";
}

export interface NoteGraph {
  notes: Map<string, NoteMetadata>;
  links: NoteLink[];
  backlinks: Map<string, string[]>; // toNoteId -> [fromNoteIds]
  brokenLinks: NoteLinkIssue[];
  orphans: string[]; // Note IDs with no incoming or outgoing links
}

export type UnifiedNoteGraphNodeType =
  | "note"
  | "spec"
  | "code"
  | "test"
  | "doc";

export interface UnifiedNoteGraphNode {
  id: string;
  type: UnifiedNoteGraphNodeType;
  path?: string | undefined;
  title?: string | undefined;
  noteId?: string | undefined;
}

export interface UnifiedNoteGraphEdge {
  from: string;
  to: string;
  type:
    | "links_to"
    | "spec_ref"
    | "code_ref"
    | "test_ref"
    | "doc_ref"
    | "supersedes"
    | "mentions";
  claimId?: string | undefined;
}

export interface UnifiedNoteGraph {
  nodes: UnifiedNoteGraphNode[];
  edges: UnifiedNoteGraphEdge[];
  backlinks: Record<string, string[]>;
  unresolvedRefs: NoteLinkIssue[];
  orphanNotes: string[];
}

async function extractLinksFromNote(
  note: NoteMetadata,
  notesMap: Map<string, NoteMetadata>,
): Promise<{ links: string[]; brokenLinks: NoteLinkIssue[] }> {
  try {
    const content = await fs.readFile(note.filePath, "utf-8");
    const wikilinks = extractWikilinkReferences(content);

    const resolvedLinks: string[] = [];
    const brokenLinks: NoteLinkIssue[] = [];
    for (const link of wikilinks) {
      const resolvedId = resolveWikilinkReference(link.target, notesMap);
      if (resolvedId) {
        resolvedLinks.push(resolvedId);
        if (link.anchor !== undefined && link.anchor.length > 0) {
          const targetNote = notesMap.get(resolvedId);
          if (targetNote) {
            try {
              const targetContent = await fs.readFile(
                targetNote.filePath,
                "utf-8",
              );
              const headings = extractHeadings(targetContent);
              if (!headings.includes(link.anchor.toLowerCase())) {
                brokenLinks.push({
                  fromNoteId: note.id,
                  fromTitle: note.title,
                  fromPath: note.filePath,
                  reference: link.raw,
                  source: "note",
                  reason: "anchor-not-found",
                });
              }
            } catch {}
          }
        }
      } else {
        brokenLinks.push({
          fromNoteId: note.id,
          fromTitle: note.title,
          fromPath: note.filePath,
          reference: link.raw,
          source: "note",
          reason: "unresolved",
        });
      }
    }

    return { links: resolvedLinks, brokenLinks };
  } catch {
    return { links: [], brokenLinks: [] };
  }
}

async function extractCodeReferences(
  srcDir: string,
  notesMap: Map<string, NoteMetadata>,
  projectRoot: string,
): Promise<{ links: NoteLink[]; brokenLinks: NoteLinkIssue[] }> {
  const codeLinks: NoteLink[] = [];
  const brokenLinks: NoteLinkIssue[] = [];

  if (!(await pathExists(srcDir))) {
    return { links: codeLinks, brokenLinks };
  }

  const codeExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".cs",
    ".rb",
    ".php",
    ".swift",
  ];

  try {
    const files = await listFilesRecursive(srcDir);
    const codeFiles = files.filter((file) =>
      codeExtensions.some((ext) => file.endsWith(ext)),
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const wikilinks = extractCodeCommentWikilinks(content);
        const relativeFile = toPosixPath(path.relative(projectRoot, file));

        for (const link of wikilinks) {
          const resolvedId = resolveWikilinkReference(link.target, notesMap);
          if (resolvedId) {
            codeLinks.push({
              fromNoteId: `_code:${relativeFile}`,
              toNoteId: resolvedId,
              type: "code-reference",
            });
          } else {
            brokenLinks.push({
              fromNoteId: `_code:${relativeFile}`,
              fromTitle: relativeFile,
              fromPath: file,
              reference: link.raw,
              source: "code",
              reason: "unresolved",
            });
          }
        }
      } catch {}
    }
  } catch {
    return { links: codeLinks, brokenLinks };
  }

  return { links: codeLinks, brokenLinks };
}

function extractCodeCommentWikilinks(content: string) {
  const references = [];
  const lines = content.split(/\r?\n/u);
  let inBlockComment = false;

  for (const line of lines) {
    let remaining = line;
    const commentSegments: string[] = [];

    if (inBlockComment) {
      const blockCommentEnd = remaining.indexOf("*/");
      if (blockCommentEnd === -1) {
        commentSegments.push(remaining);
        references.push(...extractSegmentWikilinks(commentSegments));
        continue;
      }

      commentSegments.push(remaining.slice(0, blockCommentEnd));
      remaining = remaining.slice(blockCommentEnd + 2);
      inBlockComment = false;
    }

    const leadingCommentSegment = extractLeadingCommentSegment(remaining);
    if (leadingCommentSegment !== null) {
      commentSegments.push(leadingCommentSegment);
      references.push(...extractSegmentWikilinks(commentSegments));
      continue;
    }

    const blockCommentStart = remaining.indexOf("/*");
    if (blockCommentStart >= 0 && remaining.includes("[[", blockCommentStart)) {
      const blockCommentBody = remaining.slice(blockCommentStart + 2);
      const blockCommentEnd = blockCommentBody.indexOf("*/");
      if (blockCommentEnd === -1) {
        commentSegments.push(blockCommentBody);
        inBlockComment = true;
      } else {
        commentSegments.push(blockCommentBody.slice(0, blockCommentEnd));
      }
    }

    const lineCommentStart = remaining.indexOf("//");
    if (lineCommentStart >= 0 && remaining.includes("[[", lineCommentStart)) {
      commentSegments.push(remaining.slice(lineCommentStart + 2));
    }

    if (commentSegments.length > 0) {
      references.push(...extractSegmentWikilinks(commentSegments));
    }
  }

  return references;
}

function extractLeadingCommentSegment(line: string) {
  const trimmed = line.trimStart();

  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("--")
  ) {
    return trimmed.replace(/^(\/\/+|#|\*+|--)\s*/u, "");
  }

  if (trimmed.startsWith("/*")) {
    return trimmed.slice(2);
  }

  if (trimmed.startsWith("<!--")) {
    return trimmed.slice(4);
  }

  return null;
}

function extractSegmentWikilinks(segments: string[]) {
  return segments.flatMap((segment) => extractWikilinkReferences(segment));
}

export async function buildNoteGraph(
  notesDir: string = "notes",
  projectRoot: string = process.cwd(),
  includeSrcAnalysis: boolean = true,
  options?: NoteValidationOptions,
): Promise<NoteGraph> {
  const validationResult = await validateNotes(notesDir, projectRoot, options);

  const notesMap = new Map<string, NoteMetadata>(
    validationResult.notes.map((note) => [note.id, note]),
  );

  const links: NoteLink[] = [];
  const brokenLinks: NoteLinkIssue[] = [];
  const backlinks = new Map<string, string[]>();

  for (const noteId of notesMap.keys()) {
    backlinks.set(noteId, []);
  }

  for (const note of validationResult.notes) {
    const { links: extractedLinks, brokenLinks: noteBrokenLinks } =
      await extractLinksFromNote(note, notesMap);
    brokenLinks.push(...noteBrokenLinks);

    for (const toNoteId of extractedLinks) {
      links.push({
        fromNoteId: note.id,
        toNoteId,
        type: "wikilink",
      });

      const current = backlinks.get(toNoteId) ?? [];
      if (!current.includes(note.id)) {
        current.push(note.id);
        backlinks.set(toNoteId, current);
      }
    }
  }

  if (includeSrcAnalysis) {
    const srcDir = path.join(projectRoot, "src");
    const codeReferences = await extractCodeReferences(
      srcDir,
      notesMap,
      projectRoot,
    );
    links.push(...codeReferences.links);
    brokenLinks.push(...codeReferences.brokenLinks);
  }

  const orphans: string[] = [];
  for (const noteId of notesMap.keys()) {
    const hasOutgoing = links.some((l) => l.fromNoteId === noteId);
    const hasIncoming = (backlinks.get(noteId) ?? []).length > 0;

    if (!hasOutgoing && !hasIncoming) {
      orphans.push(noteId);
    }
  }

  return {
    notes: notesMap,
    links,
    backlinks,
    brokenLinks,
    orphans,
  };
}

function fileNodeId(type: UnifiedNoteGraphNodeType, reference: string): string {
  return `${type}:${reference}`;
}

function specPathFromRef(specRef: string): string {
  return specRef.split("#", 1)[0] ?? specRef;
}

function addFileNode(
  nodes: Map<string, UnifiedNoteGraphNode>,
  type: UnifiedNoteGraphNodeType,
  reference: string,
): string {
  const nodeId = fileNodeId(type, reference);
  if (!nodes.has(nodeId)) {
    nodes.set(nodeId, { id: nodeId, type, path: reference });
  }
  return nodeId;
}

function addClaimEdges(params: {
  note: NoteMetadata;
  claim: NoteClaim;
  nodes: Map<string, UnifiedNoteGraphNode>;
  edges: UnifiedNoteGraphEdge[];
}): void {
  const from = `note:${params.note.id}`;
  if (params.claim.specRef !== undefined) {
    const ref = specPathFromRef(params.claim.specRef);
    params.edges.push({
      from,
      to: addFileNode(params.nodes, "spec", ref),
      type: "spec_ref",
      claimId: params.claim.id,
    });
  }
  for (const codeRef of params.claim.codeRefs) {
    params.edges.push({
      from,
      to: addFileNode(params.nodes, "code", codeRef),
      type: "code_ref",
      claimId: params.claim.id,
    });
  }
  for (const testRef of params.claim.testRefs) {
    params.edges.push({
      from,
      to: addFileNode(params.nodes, "test", testRef),
      type: "test_ref",
      claimId: params.claim.id,
    });
  }
  for (const docRef of params.claim.docRefs) {
    params.edges.push({
      from,
      to: addFileNode(params.nodes, "doc", docRef),
      type: "doc_ref",
      claimId: params.claim.id,
    });
  }
}

export async function buildUnifiedNoteGraph(
  notesDir: string = "notes",
  projectRoot: string = process.cwd(),
  includeSrcAnalysis = true,
  options?: NoteValidationOptions,
): Promise<UnifiedNoteGraph> {
  const graph = await buildNoteGraph(
    notesDir,
    projectRoot,
    includeSrcAnalysis,
    options,
  );
  const nodes = new Map<string, UnifiedNoteGraphNode>();
  const edges: UnifiedNoteGraphEdge[] = [];

  for (const note of graph.notes.values()) {
    nodes.set(`note:${note.id}`, {
      id: `note:${note.id}`,
      type: "note",
      noteId: note.id,
      title: note.title,
      path: toPosixPath(path.relative(projectRoot, note.filePath)),
    });
    for (const supersededId of note.supersedes ?? []) {
      edges.push({
        from: `note:${note.id}`,
        to: `note:${supersededId}`,
        type: "supersedes",
      });
    }
    for (const claim of note.claims ?? []) {
      addClaimEdges({ note, claim, nodes, edges });
    }
  }

  for (const link of graph.links) {
    if (link.type === "wikilink") {
      edges.push({
        from: `note:${link.fromNoteId}`,
        to: `note:${link.toNoteId}`,
        type: "links_to",
      });
      continue;
    }
    if (link.fromNoteId.startsWith("_code:")) {
      const codePath = link.fromNoteId.slice(6);
      edges.push({
        from: addFileNode(nodes, "code", codePath),
        to: `note:${link.toNoteId}`,
        type: "mentions",
      });
    }
  }

  return {
    nodes: [...nodes.values()].sort((left, right) =>
      left.id.localeCompare(right.id, "en"),
    ),
    edges: edges.sort((left, right) =>
      `${left.from}:${left.type}:${left.to}:${left.claimId ?? ""}`.localeCompare(
        `${right.from}:${right.type}:${right.to}:${right.claimId ?? ""}`,
        "en",
      ),
    ),
    backlinks: Object.fromEntries(
      [...graph.backlinks.entries()].sort(([left], [right]) =>
        left.localeCompare(right, "en"),
      ),
    ),
    unresolvedRefs: [...graph.brokenLinks].sort((left, right) =>
      `${left.fromNoteId}:${left.reference}`.localeCompare(
        `${right.fromNoteId}:${right.reference}`,
        "en",
      ),
    ),
    orphanNotes: [...graph.orphans].sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
  };
}

/**
 * Get all backlinks to a specific note.
 */
export function getBacklinks(
  graph: NoteGraph,
  noteId: string,
): Array<{ fromNoteId: string; title: string }> {
  const backlinks = graph.backlinks.get(noteId) ?? [];
  return backlinks.map((id) => {
    const note = graph.notes.get(id);
    return {
      fromNoteId: id,
      title: note?.title ?? "Unknown",
    };
  });
}

/**
 * Get all outgoing links from a specific note.
 */
export function getOutgoingLinks(
  graph: NoteGraph,
  noteId: string,
): Array<{ toNoteId: string; title: string }> {
  const outgoing = graph.links.filter((l) => l.fromNoteId === noteId);
  return outgoing.map((link) => {
    const note = graph.notes.get(link.toNoteId);
    return {
      toNoteId: link.toNoteId,
      title: note?.title ?? "Unknown",
    };
  });
}

/**
 * Get code references to a note.
 */
export function getCodeReferences(graph: NoteGraph, noteId: string): string[] {
  return graph.links
    .filter(
      (l) =>
        l.toNoteId === noteId &&
        l.type === "code-reference" &&
        l.fromNoteId.startsWith("_code:"),
    )
    .map((l) => l.fromNoteId.slice(6)); // Remove "_code:" prefix
}

export function getBrokenLinks(
  graph: NoteGraph,
  noteId?: string,
): NoteLinkIssue[] {
  if (noteId === undefined) {
    return graph.brokenLinks;
  }

  return graph.brokenLinks.filter((issue) => issue.fromNoteId === noteId);
}

export interface ReachableNote {
  noteId: string;
  depth: number;
  title: string;
}

/**
 * BFS traversal from noteId up to maxDepth hops following outgoing wikilinks.
 * The seed note is not included in the result.
 */
export function getReachableNotes(
  graph: NoteGraph,
  noteId: string,
  maxDepth = 2,
): ReachableNote[] {
  const visited = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: noteId, depth: 0 },
  ];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item || visited.has(item.id)) {
      continue;
    }
    visited.set(item.id, item.depth);

    if (item.depth < maxDepth) {
      for (const link of graph.links) {
        if (link.fromNoteId === item.id && link.type === "wikilink") {
          if (!visited.has(link.toNoteId)) {
            queue.push({ id: link.toNoteId, depth: item.depth + 1 });
          }
        }
      }
    }
  }

  visited.delete(noteId);

  return [...visited.entries()]
    .map(([id, depth]) => ({
      noteId: id,
      depth,
      title: graph.notes.get(id)?.title ?? "Unknown",
    }))
    .sort((left, right) => {
      const depthDiff = left.depth - right.depth;
      return depthDiff !== 0
        ? depthDiff
        : left.title.localeCompare(right.title, "en");
    });
}
