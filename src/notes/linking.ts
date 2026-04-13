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

    if (note.aliases.some((alias) => alias.toLowerCase() === lowerReference)) {
      return note.id;
    }
  }

  return null;
}
