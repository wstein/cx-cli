import fsSync from "node:fs";
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
  aliases?: string[];
  tags?: string[];
  title?: string;
  kind?: NoteKind;
  supersedes?: string[];
  claims?: NoteClaim[];
}

export type NoteKind =
  | "decision"
  | "invariant"
  | "mechanism"
  | "failure-mode"
  | "glossary"
  | "workflow"
  | "migration";
export type NoteClaimType = "invariant" | "decision" | "mechanism" | "fact";
export type NoteClaimStatus = "accepted" | "proposed" | "superseded";

export interface NoteClaim {
  id: string;
  type: NoteClaimType;
  status: NoteClaimStatus;
  specRef?: string;
  codeRefs: string[];
  testRefs: string[];
  docRefs: string[];
}

export type NoteFrontmatterFieldType = "string" | "string_array";

export interface NoteFrontmatterFieldRule {
  required: boolean;
  type: NoteFrontmatterFieldType;
  values: string[];
}

export interface NoteFrontmatterConfig {
  fields: Record<string, NoteFrontmatterFieldRule>;
}

export const DEFAULT_NOTE_FRONTMATTER_CONFIG: NoteFrontmatterConfig = {
  fields: {
    id: {
      required: true,
      type: "string",
      values: [],
    },
    aliases: { required: false, type: "string_array", values: [] },
    tags: { required: false, type: "string_array", values: [] },
    title: { required: false, type: "string", values: [] },
    kind: {
      required: false,
      type: "string",
      values: [
        "decision",
        "invariant",
        "mechanism",
        "failure-mode",
        "glossary",
        "workflow",
        "migration",
      ],
    },
    supersedes: { required: false, type: "string_array", values: [] },
  },
};

export interface NoteMetadata extends NoteFrontmatter {
  filePath: string;
  fileName: string;
  title: string;
  summary: string;
  codeLinks: string[];
  kind?: NoteKind;
  supersedes?: string[];
  claims?: NoteClaim[];
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
  frontmatter?: NoteFrontmatterConfig;
  projectRoot?: string;
}

export const NOTE_VALIDATION_LIMITS = {
  maxBodyCharacters: 4000,
  maxBodyLines: 100,
} as const;

function noteValidationMessage(message: string, protection: string): string {
  return `${message} Why this protects you: ${protection}`;
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const source = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${source}$`, "u");
}

function valuePatternToRegex(pattern: string): RegExp {
  if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
    const lastSlash = pattern.lastIndexOf("/");
    const source = pattern.slice(1, lastSlash);
    const flags = pattern.slice(lastSlash + 1);
    return new RegExp(source, flags.includes("u") ? flags : `${flags}u`);
  }

  if (pattern.includes("*") || pattern.includes("?")) {
    return wildcardToRegex(pattern);
  }

  return new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "u");
}

function matchesAllowedValue(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => valuePatternToRegex(pattern).test(value));
}

function describeAllowedValues(patterns: string[]): string {
  return patterns.join(", ");
}

function validateFrontmatterRules(
  frontmatter: Record<string, unknown>,
  config: NoteFrontmatterConfig,
): string | null {
  for (const [fieldName, rule] of Object.entries(config.fields)) {
    const value = frontmatter[fieldName];

    if (value === undefined) {
      if (rule.required) {
        return `Missing required frontmatter field: ${fieldName}`;
      }
      continue;
    }

    if (rule.type === "string") {
      if (typeof value !== "string" || value.trim().length === 0) {
        return `Invalid frontmatter field: ${fieldName} must be a non-empty string`;
      }
      if (
        rule.values.length > 0 &&
        !matchesAllowedValue(value.trim(), rule.values)
      ) {
        return `Invalid frontmatter field: ${fieldName} must match one of ${describeAllowedValues(rule.values)}`;
      }
      continue;
    }

    if (!Array.isArray(value)) {
      return `Invalid frontmatter field: ${fieldName} must be an array of strings`;
    }

    for (const item of value) {
      if (typeof item !== "string") {
        return `Invalid frontmatter field: ${fieldName} must contain only strings`;
      }
      const trimmed = item.trim();
      if (
        trimmed.length > 0 &&
        rule.values.length > 0 &&
        !matchesAllowedValue(trimmed, rule.values)
      ) {
        return `Invalid frontmatter field: ${fieldName} entries must match one of ${describeAllowedValues(rule.values)}`;
      }
    }
  }

  return null;
}

function normalizeStringArray(
  value: unknown,
  filePath: string,
  fieldName: "aliases" | "tags" | "supersedes",
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

function normalizeStringList(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    const trimmed = item.trim();
    if (trimmed.length > 0) {
      normalized.push(trimmed);
    }
  }
  return normalized;
}

const CLAIM_TYPES = new Set<NoteClaimType>([
  "invariant",
  "decision",
  "mechanism",
  "fact",
]);
const CLAIM_STATUSES = new Set<NoteClaimStatus>([
  "accepted",
  "proposed",
  "superseded",
]);

function normalizeClaims(
  value: unknown,
  filePath: string,
): { value: NoteClaim[] } | { error: string } {
  if (value === undefined) {
    return { value: [] };
  }
  if (!Array.isArray(value)) {
    return {
      error: `Invalid frontmatter field: claims in ${path.basename(filePath)} must be an array of claim objects`,
    };
  }

  const claims: NoteClaim[] = [];
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { error: `Invalid claim ${index + 1}: must be an object` };
    }
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const type = typeof record.type === "string" ? record.type.trim() : "";
    const status =
      typeof record.status === "string" ? record.status.trim() : "";
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) {
      return {
        error: `Invalid claim ${index + 1}: id must be a lowercase slug`,
      };
    }
    if (ids.has(id)) {
      return {
        error: `Duplicate claim id in ${path.basename(filePath)}: ${id}`,
      };
    }
    ids.add(id);
    if (!CLAIM_TYPES.has(type as NoteClaimType)) {
      return {
        error: `Invalid claim ${id}: type must be one of ${[...CLAIM_TYPES].join(", ")}`,
      };
    }
    if (!CLAIM_STATUSES.has(status as NoteClaimStatus)) {
      return {
        error: `Invalid claim ${id}: status must be one of ${[...CLAIM_STATUSES].join(", ")}`,
      };
    }
    const codeRefs = normalizeStringList(record.code_refs);
    const testRefs = normalizeStringList(record.test_refs);
    const docRefs = normalizeStringList(record.doc_refs);
    if (codeRefs === null || testRefs === null || docRefs === null) {
      return {
        error: `Invalid claim ${id}: code_refs, test_refs, and doc_refs must be arrays of strings when present`,
      };
    }
    if (record.spec_ref !== undefined && typeof record.spec_ref !== "string") {
      return { error: `Invalid claim ${id}: spec_ref must be a string` };
    }
    claims.push({
      id,
      type: type as NoteClaimType,
      status: status as NoteClaimStatus,
      ...(typeof record.spec_ref === "string" &&
        record.spec_ref.trim().length > 0 && {
          specRef: record.spec_ref.trim(),
        }),
      codeRefs,
      testRefs,
      docRefs,
    });
  }

  return { value: claims };
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
    const frontmatterConfig =
      options?.frontmatter ?? DEFAULT_NOTE_FRONTMATTER_CONFIG;
    const frontmatterError = validateFrontmatterRules(
      frontmatter,
      frontmatterConfig,
    );
    if (frontmatterError !== null) {
      return {
        metadata: null,
        error: {
          filePath,
          error: frontmatterError,
        },
      };
    }

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

    if (Object.hasOwn(frontmatter, "target")) {
      return {
        metadata: null,
        error: {
          filePath,
          error: "Unsupported frontmatter field: target",
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

    const supersedes = normalizeStringArray(
      frontmatter.supersedes,
      filePath,
      "supersedes",
    );
    if ("error" in supersedes) {
      return {
        metadata: null,
        error: {
          filePath,
          error: supersedes.error,
        },
      };
    }

    for (const supersededId of supersedes.value) {
      if (!validateNoteIdFormat(supersededId)) {
        return {
          metadata: null,
          error: {
            filePath,
            error: `Invalid supersedes note ID: "${supersededId}"`,
          },
        };
      }
    }

    const claims = normalizeClaims(frontmatter.claims, filePath);
    if ("error" in claims) {
      return {
        metadata: null,
        error: {
          filePath,
          error: claims.error,
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
        aliases: aliases.value,
        tags: tags.value,
        title,
        summary,
        codeLinks,
        ...(typeof frontmatter.kind === "string" &&
          frontmatter.kind.trim().length > 0 && {
            kind: frontmatter.kind.trim() as NoteKind,
          }),
        supersedes: supersedes.value,
        claims: claims.value,
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
  const relationalErrors = validateNoteRelations(notes, options);

  return {
    valid:
      errors.length === 0 &&
      duplicateIds.length === 0 &&
      relationalErrors.length === 0,
    notes,
    errors: [...errors, ...relationalErrors],
    duplicateIds,
  };
}

function validateNoteRelations(
  notes: NoteMetadata[],
  options?: NoteValidationOptions,
): NoteValidationError[] {
  const noteIds = new Set(notes.map((note) => note.id));
  const errors: NoteValidationError[] = [];

  for (const note of notes) {
    for (const supersededId of note.supersedes ?? []) {
      if (!noteIds.has(supersededId)) {
        errors.push({
          filePath: note.filePath,
          error: `Supersedes references missing note ID: ${supersededId}`,
        });
      }
    }

    for (const claim of note.claims ?? []) {
      for (const referencedPath of claimFileRefs(claim)) {
        const normalizedPath = referencedPath.split("#", 1)[0] ?? "";
        if (normalizedPath.length === 0) {
          continue;
        }
        const root = options?.projectRoot ?? process.cwd();
        if (!fsSyncPathExists(path.resolve(root, normalizedPath))) {
          errors.push({
            filePath: note.filePath,
            error: `Claim ${claim.id} references missing file: ${referencedPath}`,
          });
        }
      }
    }
  }

  errors.push(...validateSupersessionCycles(notes));
  return errors;
}

function claimFileRefs(claim: NoteClaim): string[] {
  return [
    ...(claim.specRef !== undefined ? [claim.specRef] : []),
    ...claim.codeRefs,
    ...claim.testRefs,
    ...claim.docRefs,
  ];
}

function fsSyncPathExists(filePath: string): boolean {
  try {
    return fsSync.existsSync(filePath);
  } catch {
    return false;
  }
}

function validateSupersessionCycles(
  notes: NoteMetadata[],
): NoteValidationError[] {
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const errors: NoteValidationError[] = [];

  for (const note of notes) {
    const visited = new Set<string>();
    const stack = [...(note.supersedes ?? [])];
    while (stack.length > 0) {
      const nextId = stack.pop();
      if (nextId === undefined) {
        continue;
      }
      if (nextId === note.id) {
        errors.push({
          filePath: note.filePath,
          error: `Supersedes chain contains a cycle back to ${note.id}`,
        });
        break;
      }
      if (visited.has(nextId)) {
        continue;
      }
      visited.add(nextId);
      stack.push(...(notesById.get(nextId)?.supersedes ?? []));
    }
  }

  return errors;
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

  const parsed = validateNoteDocuments(documents, { ...options, projectRoot });
  const errors = [...readErrors, ...parsed.errors];

  return {
    valid: errors.length === 0 && parsed.duplicateIds.length === 0,
    notes: parsed.notes,
    errors,
    duplicateIds: parsed.duplicateIds,
  };
}
