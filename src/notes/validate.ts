import fs from "node:fs/promises";
import path from "node:path";

import { listFilesRecursive, pathExists } from "../shared/fs.js";
import {
  extractNoteSummary,
  parseMarkdownFrontmatter,
  titleFromFileName,
  validateNoteIdFormat,
} from "./parser.js";

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
  summary: string;
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

function normalizeStringArray(
  value: unknown,
  filePath: string,
  fieldName: "aliases" | "tags",
): { value: string[] } | { error: string } {
  if (value === undefined) {
    return { value: [] };
  }

  if (!Array.isArray(value)) {
    return {
      error: `Invalid frontmatter field: ${fieldName} in ${path.basename(
        filePath,
      )} must be an array of strings`,
    };
  }

  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return {
        error: `Invalid frontmatter field: ${fieldName} in ${path.basename(
          filePath,
        )} must contain only strings`,
      };
    }

    const trimmed = item.trim();
    if (trimmed.length > 0) {
      normalized.push(trimmed);
    }
  }

  return { value: normalized };
}

async function extractNoteMetadata(filePath: string): Promise<{
  metadata: NoteMetadata | null;
  error: NoteValidationError | null;
}> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const { frontmatter, body } = parseMarkdownFrontmatter(content);

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
          error: `Invalid note ID format: "${id}". Expected YYYYMMDDHHMMSS (e.g., 20250113143015)`,
        },
      };
    }

    const aliases = normalizeStringArray(
      frontmatter.aliases,
      filePath,
      "aliases",
    );
    if ("error" in aliases) {
      return {
        metadata: null,
        error: {
          filePath,
          error: aliases.error,
        },
      };
    }

    const tags = normalizeStringArray(frontmatter.tags, filePath, "tags");
    if ("error" in tags) {
      return {
        metadata: null,
        error: {
          filePath,
          error: tags.error,
        },
      };
    }

    const frontmatterTitle = frontmatter.title;
    if (
      frontmatterTitle !== undefined &&
      typeof frontmatterTitle !== "string"
    ) {
      return {
        metadata: null,
        error: {
          filePath,
          error: "Invalid frontmatter field: title must be a string",
        },
      };
    }

    let title = frontmatterTitle?.trim() ?? "";
    if (title.length === 0) {
      const h1Match = body.match(/^#\s+(.+)$/m);
      if (h1Match?.[1] !== undefined) {
        title = h1Match[1].trim();
      }
    }

    if (title.length === 0) {
      title = titleFromFileName(filePath);
    }

    return {
      metadata: {
        id,
        aliases: aliases.value,
        tags: tags.value,
        title,
        summary: extractNoteSummary(body),
        filePath,
        fileName: path.basename(filePath),
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

export async function validateNotes(
  notesDir: string,
  projectRoot: string,
): Promise<ValidateNotesResult> {
  const notesDirAbsolute = path.resolve(projectRoot, notesDir);

  const exists = await pathExists(notesDirAbsolute);
  if (!exists) {
    return {
      valid: true,
      notes: [],
      errors: [],
      duplicateIds: [],
    };
  }

  const markdownFiles = (await listFilesRecursive(notesDirAbsolute))
    .filter((file) => file.endsWith(".md"))
    .filter((file) => {
      const baseName = path.basename(file);
      return baseName !== "README.md" && baseName !== "Atomic Note Template.md";
    });

  const notes: NoteMetadata[] = [];
  const errors: NoteValidationError[] = [];
  const idMap = new Map<string, string[]>();

  for (const file of markdownFiles) {
    const { metadata, error } = await extractNoteMetadata(file);

    if (error) {
      errors.push(error);
      continue;
    }

    if (!metadata) {
      continue;
    }

    notes.push(metadata);
    const files = idMap.get(metadata.id) ?? [];
    files.push(metadata.filePath);
    idMap.set(metadata.id, files);
  }

  const duplicateIds = Array.from(idMap.entries())
    .filter(([, files]) => files.length > 1)
    .map(([id, files]) => ({ id, files }));

  return {
    valid: errors.length === 0 && duplicateIds.length === 0,
    notes,
    errors,
    duplicateIds,
  };
}
