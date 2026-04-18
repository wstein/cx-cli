import type { NoteMetadata } from "./validate.js";

export interface WikilinkReference {
  raw: string;
  target: string;
}

const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;

export function normalizeWikilinkReference(reference: string): string {
  const displayText = reference.split("|", 1)[0] ?? reference;
  const target = displayText.split("#", 1)[0] ?? displayText;
  return target.trim();
}

export function extractWikilinkReferences(
  content: string,
): WikilinkReference[] {
  const references: WikilinkReference[] = [];

  for (const match of content.matchAll(WIKILINK_REGEX)) {
    const raw = (match[1] ?? "").trim();
    if (raw.length === 0) {
      continue;
    }

    references.push({
      raw,
      target: normalizeWikilinkReference(raw),
    });
  }

  return references;
}

const HEADING_REGEX = /^#{1,6}\s+(.+)$/gm;

/**
 * Extract all heading texts from Markdown content, normalized to lowercase
 * for case-insensitive anchor matching (mirrors how most Markdown renderers
 * slugify headings for anchor links).
 */
export function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const match of content.matchAll(HEADING_REGEX)) {
    const text = (match[1] ?? "").trim();
    if (text.length > 0) {
      headings.push(text.toLowerCase());
    }
  }
  return headings;
}

const CODE_PATH_REGEX =
  /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.[A-Za-z0-9._-]+$/u;

export function looksLikeCodePath(reference: string): boolean {
  return CODE_PATH_REGEX.test(reference);
}

/**
 * Extract repository-path-style wikilink targets from note content.
 * Returns deduplicated, normalized paths (e.g. "src/auth/index.ts").
 */
export function extractCodePathReferences(content: string): string[] {
  const seen = new Set<string>();
  for (const ref of extractWikilinkReferences(content)) {
    const normalized = ref.target.replace(/^\.\/+/u, "");
    if (looksLikeCodePath(normalized)) {
      seen.add(normalized);
    }
  }
  return [...seen].sort();
}

export function resolveWikilinkReference(
  reference: string,
  notesMap: Map<string, NoteMetadata>,
): string | null {
  const normalized = normalizeWikilinkReference(reference);
  if (normalized.length === 0) {
    return null;
  }

  if (notesMap.has(normalized)) {
    return normalized;
  }

  const lowerReference = normalized.toLowerCase();
  for (const note of notesMap.values()) {
    if (note.title.toLowerCase() === lowerReference) {
      return note.id;
    }

    const aliases = note.aliases ?? [];
    if (aliases.some((alias) => alias.toLowerCase() === lowerReference)) {
      return note.id;
    }
  }

  return null;
}
