import fs from "node:fs/promises";
import path from "node:path";

import { listFilesRecursive, pathExists } from "../shared/fs.js";
import type { NoteMetadata } from "./validate.js";
import { validateNotes } from "./validate.js";

export interface NoteLink {
  fromNoteId: string;
  toNoteId: string;
  type: "wikilink" | "code-reference";
}

export interface NoteGraph {
  notes: Map<string, NoteMetadata>;
  links: NoteLink[];
  backlinks: Map<string, string[]>; // toNoteId -> [fromNoteIds]
  orphans: string[]; // Note IDs with no incoming or outgoing links
}

/**
 * Parse wikilinks from markdown content.
 * Matches patterns like [[note-id]] or [[Note Title]]
 */
function extractWikilinks(content: string): string[] {
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const ref = (match[1] ?? "").trim();
    if (ref) {
      links.push(ref);
    }
  }

  return links;
}

/**
 * Resolve a wikilink reference to a note ID.
 * Can match by ID (exact) or by title (case-insensitive).
 */
function resolveWikilink(
  ref: string,
  notesMap: Map<string, NoteMetadata>,
): string | null {
  const ref_lower = ref.toLowerCase();

  // Try exact ID match first
  if (notesMap.has(ref)) {
    return ref;
  }

  // Try title match (case-insensitive)
  for (const note of notesMap.values()) {
    if (note.title.toLowerCase() === ref_lower) {
      return note.id;
    }

    // Try alias match
    const aliases = note.aliases ?? [];
    if (
      aliases.some(
        (alias) => alias.toLowerCase() === ref_lower,
      )
    ) {
      return note.id;
    }
  }

  return null;
}

/**
 * Extract links from a note file.
 */
async function extractLinksFromNote(
  filePath: string,
  notesMap: Map<string, NoteMetadata>,
): Promise<{ noteId: string | null; links: string[] }> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const wikilinks = extractWikilinks(content);

    // Resolve wikilinks to note IDs
    const resolvedLinks: string[] = [];
    for (const link of wikilinks) {
      const resolvedId = resolveWikilink(link, notesMap);
      if (resolvedId) {
        resolvedLinks.push(resolvedId);
      }
    }

    // Find the note ID for this file
    let noteId: string | null = null;
    for (const note of notesMap.values()) {
      if (note.filePath === filePath) {
        noteId = note.id;
        break;
      }
    }

    return { noteId, links: resolvedLinks };
  } catch {
    return { noteId: null, links: [] };
  }
}

/**
 * Search codebase for references to notes.
 * Looks for wikilink patterns in code files.
 */
async function extractCodeReferences(
  srcDir: string,
  notesMap: Map<string, NoteMetadata>,
): Promise<NoteLink[]> {
  const codeLinks: NoteLink[] = [];

  if (!await pathExists(srcDir)) {
    return codeLinks;
  }

  // Find all code files (common extensions)
  const codeExtensions = [
    ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
    ".cpp", ".c", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
  ];

  try {
    const files = await listFilesRecursive(srcDir);
    const codeFiles = files.filter((f) =>
      codeExtensions.some((ext) => f.endsWith(ext)),
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const wikilinks = extractWikilinks(content);

        for (const link of wikilinks) {
          const resolvedId = resolveWikilink(link, notesMap);
          if (resolvedId) {
            codeLinks.push({
              fromNoteId: `_code:${file}`,
              toNoteId: resolvedId,
              type: "code-reference",
            });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
  } catch {
    // Skip if directory can't be read
  }

  return codeLinks;
}

/**
 * Build a note graph by parsing wikilinks and analyzing connections.
 */
export async function buildNoteGraph(
  notesDir: string = "notes",
  projectRoot: string = process.cwd(),
  includeSrcAnalysis: boolean = true,
): Promise<NoteGraph> {
  // Validate and collect notes
  const validationResult = await validateNotes(notesDir, projectRoot);

  const notesMap = new Map<string, NoteMetadata>(
    validationResult.notes.map((note) => [note.id, note]),
  );

  const links: NoteLink[] = [];
  const backlinks = new Map<string, string[]>();

  // Initialize backlinks for all notes
  for (const noteId of notesMap.keys()) {
    backlinks.set(noteId, []);
  }

  // Extract links from notes themselves
  for (const note of validationResult.notes) {
    const { links: extractedLinks } = await extractLinksFromNote(
      note.filePath,
      notesMap,
    );

    for (const toNoteId of extractedLinks) {
      links.push({
        fromNoteId: note.id,
        toNoteId,
        type: "wikilink",
      });

      // Record backlink
      const current = backlinks.get(toNoteId) ?? [];
      if (!current.includes(note.id)) {
        current.push(note.id);
        backlinks.set(toNoteId, current);
      }
    }
  }

  // Analyze source code for references to notes
  if (includeSrcAnalysis) {
    const srcDir = path.join(projectRoot, "src");
    const codeReferences = await extractCodeReferences(srcDir, notesMap);
    links.push(...codeReferences);
  }

  // Identify orphans (notes with no links in or out)
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
  return backlinks
    .map((id) => {
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
  return outgoing
    .map((link) => {
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
export function getCodeReferences(
  graph: NoteGraph,
  noteId: string,
): string[] {
  return graph.links
    .filter(
      (l) =>
        l.toNoteId === noteId &&
        l.type === "code-reference" &&
        l.fromNoteId.startsWith("_code:"),
    )
    .map((l) => l.fromNoteId.slice(6)); // Remove "_code:" prefix
}
