import fs from "node:fs/promises";
import path from "node:path";

import { listFilesRecursive, pathExists } from "../shared/fs.js";
import type { NoteCognitionAssessment } from "./cognition.js";
import { assessNoteCognition, hasNonTrivialSummary } from "./cognition.js";
import { extractCodePathReferences } from "./linking.js";
import {
  extractNoteSummary,
  parseMarkdownFrontmatter,
  titleFromFileName,
  validateNoteIdFormat,
} from "./parser.js";

export interface NoteFrontmatter {
  id: string;
  target: NoteTarget;
  aliases?: string[];
  tags?: string[];
  title?: string;
}

export const NOTE_TARGET_VALUES = ["current", "v0.4", "backlog"] as const;
export type NoteTarget = (typeof NOTE_TARGET_VALUES)[number];

export function isNoteTarget(value: unknown): value is NoteTarget {
  return (
    typeof value === "string" &&
    (NOTE_TARGET_VALUES as readonly string[]).includes(value)
  );
}

export interface NoteMetadata extends NoteFrontmatter {
  filePath: string;
  fileName: string;
  title: string;
  summary: string;
  codeLinks: string[];
  cognition: NoteCognitionAssessment;
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

export interface NoteDocument {
  filePath: string;
  content: string;
}

export interface NoteValidationOptions {
  now?: Date;
}

export const NOTE_VALIDATION_LIMITS = {
  maxBodyCharacters: 4000,
  maxBodyLines: 100,
} as const;

function noteValidationMessage(message: string, protection: string): string {
  return `${message} Why this protects you: ${protection}`;
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

function parseNoteDocument(
  document: NoteDocument,
  options?: NoteValidationOptions,
): {
  metadata: NoteMetadata | null;
  error: NoteValidationError | null;
} {
  const { filePath, content } = document;

  try {
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
          error: `Invalid note ID format: "${id}". Expected YYYYMMDDHHMMSS or YYYYMMDDHHMMSS-XXX for same-second collisions (e.g., 20250113143015 or 20250113143015-001)`,
        },
      };
    }

    const target = frontmatter.target;
    if (target === undefined) {
      return {
        metadata: null,
        error: {
          filePath,
          error:
            "Missing required frontmatter field: target (current | v0.4 | backlog)",
        },
      };
    }

    if (!isNoteTarget(target)) {
      return {
        metadata: null,
        error: {
          filePath,
          error:
            "Invalid frontmatter field: target must be one of current, v0.4, or backlog",
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

    const summary = extractNoteSummary(body);
    if (summary.length === 0) {
      return {
        metadata: null,
        error: {
          filePath,
          error: noteValidationMessage(
            "Missing required summary paragraph. The first body paragraph must stand on its own before the links section.",
            "Manifest note summaries are the fast path agents use to find durable knowledge without reparsing the entire graph.",
          ),
        },
      };
    }

    if (!hasNonTrivialSummary(summary)) {
      return {
        metadata: null,
        error: {
          filePath,
          error: noteValidationMessage(
            "Summary paragraph is too short. Use at least 6 words in the opening paragraph.",
            "Manifest summaries are the first routing surface for later humans and agents, so one-line placeholders are not durable knowledge.",
          ),
        },
      };
    }

    const codeLinks = extractCodePathReferences(body);
    const cognition = assessNoteCognition(body, summary, codeLinks, {
      noteId: id,
      ...(options?.now !== undefined ? { now: options.now } : {}),
    });

    if (cognition.templateBoilerplateDetected) {
      return {
        metadata: null,
        error: {
          filePath,
          error: noteValidationMessage(
            "Untouched template guidance detected in note body. Replace the starter prompts with repository-specific content before saving.",
            "Template prose is scaffolding, not knowledge. Rejecting it keeps the cognition layer from filling with generic text that looks structured but says nothing durable.",
          ),
        },
      };
    }

    const normalizedBody = body.trim();
    const bodyCharacterCount = normalizedBody.length;
    if (bodyCharacterCount > NOTE_VALIDATION_LIMITS.maxBodyCharacters) {
      return {
        metadata: null,
        error: {
          filePath,
          error: noteValidationMessage(
            `Note body exceeds ${NOTE_VALIDATION_LIMITS.maxBodyCharacters} characters (${bodyCharacterCount}).`,
            "Atomic notes stay reusable only when the cognition layer remains small enough for humans and agents to classify quickly.",
          ),
        },
      };
    }

    const bodyLineCount =
      normalizedBody.length === 0 ? 0 : normalizedBody.split(/\r?\n/).length;
    if (bodyLineCount > NOTE_VALIDATION_LIMITS.maxBodyLines) {
      return {
        metadata: null,
        error: {
          filePath,
          error: noteValidationMessage(
            `Note body exceeds ${NOTE_VALIDATION_LIMITS.maxBodyLines} lines (${bodyLineCount}).`,
            "Oversized notes blur multiple ideas together and reduce the signal-to-noise ratio of the repository cognition layer.",
          ),
        },
      };
    }

    return {
      metadata: {
        id,
        target,
        aliases: aliases.value,
        tags: tags.value,
        title,
        summary,
        codeLinks,
        cognition,
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

export function validateNoteDocuments(
  documents: NoteDocument[],
  options?: NoteValidationOptions,
): ValidateNotesResult {
  const notes: NoteMetadata[] = [];
  const errors: NoteValidationError[] = [];
  const idMap = new Map<string, string[]>();

  for (const document of documents) {
    const { metadata, error } = parseNoteDocument(document, options);

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

export async function validateNotes(
  notesDir: string,
  projectRoot: string,
  options?: NoteValidationOptions,
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

  const documents: NoteDocument[] = [];
  const readErrors: NoteValidationError[] = [];

  for (const file of markdownFiles) {
    try {
      const content = await fs.readFile(file, "utf-8");
      documents.push({ filePath: file, content });
    } catch (err) {
      readErrors.push({
        filePath: file,
        error: `Failed to read or parse note: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const parsed = validateNoteDocuments(documents, options);
  const errors = [...readErrors, ...parsed.errors];

  return {
    valid: errors.length === 0 && parsed.duplicateIds.length === 0,
    notes: parsed.notes,
    errors,
    duplicateIds: parsed.duplicateIds,
  };
}
