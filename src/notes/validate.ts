import fs from "node:fs/promises";
import path from "node:path";

import { listFilesRecursive, pathExists } from "../shared/fs.js";

export interface NoteFrontmatter {
  id: string;
  aliases?: string[];
  tags?: string[];
  title?: string;
}

export interface NoteMetadata extends NoteFrontmatter {
  filePath: string;
  fileName: string;
  title: string;
}

export interface NoteValidationError {
  filePath: string;
  error: string;
}

export interface ValidateNotesResult {
  valid: boolean;
  notes: NoteMetadata[];
  errors: NoteValidationError[];
  duplicateIds: Array<{ id: string; files: string[] }>;
}

/**
 * Regex for valid note IDs: YYYYMMDDHHMM format
 * Matches: 202501131430, 202512312359, etc.
 */
const NOTE_ID_REGEX = /^\d{12}$/;

function validateNoteIdFormat(id: string): boolean {
  if (!NOTE_ID_REGEX.test(id)) {
    return false;
  }

  // Additional validation: ensure it's a valid date
  const year = parseInt(id.substring(0, 4), 10);
  const month = parseInt(id.substring(4, 6), 10);
  const day = parseInt(id.substring(6, 8), 10);
  const hour = parseInt(id.substring(8, 10), 10);
  const minute = parseInt(id.substring(10, 12), 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;

  return true;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Expects format:
 * ---
 * key: value
 * ---
 *
 * Returns the parsed frontmatter object and remaining content.
 */
function parseFrontmatter(
  content: string,
): { frontmatter: Record<string, unknown>; body: string } {
  const lines = content.split("\n");

  if (!lines[0]?.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.startsWith("---")) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join("\n");

  const frontmatter: Record<string, unknown> = {};

  for (const line of frontmatterLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.substring(0, colonIdx).trim();
    const valueStr = line.substring(colonIdx + 1).trim();

    // Parse YAML values
    if (valueStr === "true") {
      frontmatter[key] = true;
    } else if (valueStr === "false") {
      frontmatter[key] = false;
    } else if (valueStr === "null" || valueStr === "~") {
      frontmatter[key] = null;
    } else if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
      // Simple array parsing
      const arrayContent = valueStr.slice(1, -1).trim();
      if (arrayContent === "") {
        frontmatter[key] = [];
      } else {
        frontmatter[key] = arrayContent
          .split(",")
          .map((item) =>
            item
              .trim()
              .replace(/^["']|["']$/g, "")
              .trim(),
          );
      }
    } else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
      frontmatter[key] = valueStr.slice(1, -1); // Remove quotes
    } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
      frontmatter[key] = valueStr.slice(1, -1); // Remove quotes
    } else {
      frontmatter[key] = valueStr;
    }
  }

  return { frontmatter, body };
}

/**
 * Extract note metadata from a file.
 */
async function extractNoteMetadata(
  filePath: string,
): Promise<{ metadata: NoteMetadata | null; error: NoteValidationError | null }> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);

    // Validate required fields
    const id = String(frontmatter.id ?? "").trim();
    if (!id) {
      return {
        metadata: null,
        error: {
          filePath,
          error: "Missing required frontmatter field: id",
        },
      };
    }

    if (!validateNoteIdFormat(id)) {
      return {
        metadata: null,
        error: {
          filePath,
          error: `Invalid note ID format: "${id}". Expected YYYYMMDDHHMM (e.g., 202501131430)`,
        },
      };
    }

    // Extract aliases and tags
    const aliases = Array.isArray(frontmatter.aliases)
      ? (frontmatter.aliases as string[])
      : [];
    const tags = Array.isArray(frontmatter.tags)
      ? (frontmatter.tags as string[])
      : [];

    // Extract title from frontmatter or first H1 in body
    let title = (frontmatter.title as string) ?? "";

    if (!title) {
      // Try to extract from first H1 in body
      const h1Match = body.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = h1Match[1] ?? "";
      }
    }

    if (!title) {
      return {
        metadata: null,
        error: {
          filePath,
          error: "Could not determine note title (missing title field or H1)",
        },
      };
    }

    const fileName = path.basename(filePath);

    return {
      metadata: {
        id,
        aliases,
        tags,
        title,
        filePath,
        fileName,
      },
      error: null,
    };
  } catch (err) {
    return {
      metadata: null,
      error: {
        filePath,
        error: `Failed to read or parse note: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
}

/**
 * Validate all notes in a directory.
 *
 * @param notesDir Path to the notes directory (e.g., "notes")
 * @param projectRoot Project root directory (for absolute path resolution)
 * @returns Validation result containing all notes, errors, and duplicates
 */
export async function validateNotes(
  notesDir: string,
  projectRoot: string,
): Promise<ValidateNotesResult> {
  const notesDirAbsolute = path.resolve(projectRoot, notesDir);

  // Check if notes directory exists
  const exists = await pathExists(notesDirAbsolute);
  if (!exists) {
    return {
      valid: true,
      notes: [],
      errors: [],
      duplicateIds: [],
    };
  }

  // List all markdown files in notes directory
  const markdownFiles = (await listFilesRecursive(notesDirAbsolute))
    .filter((file) => file.endsWith(".md"))
    // Skip the README and template
    .filter(
      (file) =>
        !file.endsWith("README.md") && !file.endsWith("template-new-zettel.md"),
    );

  const notes: NoteMetadata[] = [];
  const errors: NoteValidationError[] = [];
  const idMap = new Map<string, string[]>();

  // Extract metadata from each note
  for (const file of markdownFiles) {
    const { metadata, error } = await extractNoteMetadata(file);

    if (error) {
      errors.push(error);
    } else if (metadata) {
      notes.push(metadata);

      // Track IDs for duplicate detection
      if (!idMap.has(metadata.id)) {
        idMap.set(metadata.id, []);
      }
      idMap.get(metadata.id)!.push(metadata.filePath);
    }
  }

  // Find duplicates
  const duplicateIds = Array.from(idMap.entries())
    .filter(([, files]) => files.length > 1)
    .map(([id, files]) => ({ id, files }));

  const valid = errors.length === 0 && duplicateIds.length === 0;

  return {
    valid,
    notes,
    errors,
    duplicateIds,
  };
}
