import fs from "node:fs/promises";
import path from "node:path";

import { listFilesRecursive, pathExists } from "../shared/fs.js";
import {
  extractWikilinkReferences,
  resolveWikilinkReference,
} from "./linking.js";
import type { NoteMetadata } from "./validate.js";
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
  reason: "unresolved";
}

export interface NoteGraph {
  notes: Map<string, NoteMetadata>;
  links: NoteLink[];
  backlinks: Map<string, string[]>; // toNoteId -> [fromNoteIds]
  brokenLinks: NoteLinkIssue[];
  orphans: string[]; // Note IDs with no incoming or outgoing links
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
        const wikilinks = extractWikilinkReferences(content);

        for (const link of wikilinks) {
          const resolvedId = resolveWikilinkReference(link.target, notesMap);
          if (resolvedId) {
            codeLinks.push({
              fromNoteId: `_code:${file}`,
              toNoteId: resolvedId,
              type: "code-reference",
            });
          } else {
            brokenLinks.push({
              fromNoteId: `_code:${file}`,
              fromTitle: file,
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

export async function buildNoteGraph(
  notesDir: string = "notes",
  projectRoot: string = process.cwd(),
  includeSrcAnalysis: boolean = true,
): Promise<NoteGraph> {
  const validationResult = await validateNotes(notesDir, projectRoot);

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
    const codeReferences = await extractCodeReferences(srcDir, notesMap);
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
