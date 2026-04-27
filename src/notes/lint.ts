import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { CxSectionConfig } from "../config/types.js";
import {
  collectNoteCodePathWarnings,
  type NoteCodePathWarning,
} from "./consistency.js";
import {
  parseMarkdownFrontmatter,
  stringifyMarkdownFrontmatter,
} from "./parser.js";
import { validateNotes } from "./validate.js";

export type LintFindingCategory =
  | NoteCodePathWarning["status"]
  | "contradiction"
  | "stale_updated_at"
  | "stale_path_tags";

export interface LintFinding {
  readonly category: LintFindingCategory;
  readonly noteId: string;
  readonly noteTitle: string;
  readonly notePath: string;
  readonly targetPath?: string;
  readonly suggestedFix: string;
  readonly confidence: number;
  readonly autoFixable: boolean;
}

export interface LintNotesOptions {
  readonly noteId?: string;
  readonly repositoryPaths?: Iterable<string>;
  readonly sectionEntries?: Map<string, CxSectionConfig>;
}

export interface LintNotesResult {
  readonly valid: boolean;
  readonly findings: LintFinding[];
}

export interface ApplyLintFixOptions {
  readonly projectRoot: string;
  readonly notesDir: string;
  readonly yes?: boolean;
}

export interface ApplyLintFixResult {
  readonly applied: number;
  readonly skipped: number;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function derivePathTags(notePath: string, notesDir: string): string[] {
  const relative = path.relative(notesDir, notePath).replaceAll("\\", "/");
  const parts = relative.split("/");
  if (parts.length <= 1) {
    return [];
  }
  return parts.slice(0, -1).filter((part) => part !== "Templates");
}

function toLintFinding(warning: NoteCodePathWarning, notePath: string) {
  const suggestedFix =
    warning.status === "missing"
      ? "Restore the file, update the structural anchor, or record the rename explicitly."
      : warning.status === "outside_master_list"
        ? "Add the file to the VCS master list or remove the stale anchor."
        : "Move the anchor into an included section or adjust applies_to_sections.";
  return {
    category: warning.status,
    noteId: warning.fromNoteId,
    noteTitle: warning.fromTitle,
    notePath,
    targetPath: warning.path,
    suggestedFix,
    confidence: 0,
    autoFixable: false,
  } satisfies LintFinding;
}

export async function lintNotes(
  notesDir = "notes",
  projectRoot = process.cwd(),
  options: LintNotesOptions = {},
): Promise<LintNotesResult> {
  const validation = await validateNotes(notesDir, projectRoot);
  const filteredNotes =
    options.noteId === undefined
      ? validation.notes
      : validation.notes.filter((note) => note.id === options.noteId);
  const notePathById = new Map(
    filteredNotes.map((note) => [note.id, note.filePath]),
  );
  const findings: LintFinding[] = [];

  const warnings = await collectNoteCodePathWarnings(
    filteredNotes,
    projectRoot,
    options.repositoryPaths,
    options.sectionEntries,
  );
  for (const warning of warnings) {
    findings.push(
      toLintFinding(warning, notePathById.get(warning.fromNoteId) ?? ""),
    );
  }

  for (const note of filteredNotes) {
    const content = await fs.readFile(note.filePath, "utf8");
    const parsed = parseMarkdownFrontmatter(content);
    if (
      typeof parsed.frontmatter.updated_at === "string" &&
      parsed.frontmatter.updated_at !== todayIsoDate()
    ) {
      findings.push({
        category: "stale_updated_at",
        noteId: note.id,
        noteTitle: note.title,
        notePath: note.filePath,
        suggestedFix: "Refresh updated_at in note frontmatter.",
        confidence: 1,
        autoFixable: true,
      });
    }

    const derivedTags = derivePathTags(
      note.filePath,
      path.resolve(projectRoot, notesDir),
    );
    const tags = Array.isArray(parsed.frontmatter.tags)
      ? parsed.frontmatter.tags.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];
    const missingTags = derivedTags.filter((tag) => !tags.includes(tag));
    if (missingTags.length > 0) {
      findings.push({
        category: "stale_path_tags",
        noteId: note.id,
        noteTitle: note.title,
        notePath: note.filePath,
        suggestedFix: `Add derived path tag(s): ${missingTags.join(", ")}.`,
        confidence: 1,
        autoFixable: true,
      });
    }
  }

  return {
    valid: findings.length === 0,
    findings,
  };
}

async function appendHistory(params: {
  notesDir: string;
  noteId: string;
  changeKind: string;
  beforeHash: string;
  afterHash: string;
}) {
  const historyPath = path.join(params.notesDir, ".lint-history.jsonl");
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.appendFile(
    historyPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      noteId: params.noteId,
      changeKind: params.changeKind,
      beforeHash: params.beforeHash,
      afterHash: params.afterHash,
    })}\n`,
    "utf8",
  );
}

export async function readLintHistory(notesDir = "notes") {
  const historyPath = path.join(notesDir, ".lint-history.jsonl");
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function applyLintFixes(
  findings: readonly LintFinding[],
  options: ApplyLintFixOptions,
): Promise<ApplyLintFixResult> {
  let applied = 0;
  let skipped = 0;
  const grouped = new Map<string, LintFinding[]>();
  for (const finding of findings) {
    if (!finding.autoFixable) {
      skipped += 1;
      continue;
    }
    const group = grouped.get(finding.notePath) ?? [];
    group.push(finding);
    grouped.set(finding.notePath, group);
  }

  for (const [notePath, noteFindings] of grouped) {
    const before = await fs.readFile(notePath, "utf8");
    const parsed = parseMarkdownFrontmatter(before);
    const bodyHash = sha256(parsed.body);
    const nextFrontmatter = { ...parsed.frontmatter };
    for (const finding of noteFindings) {
      if (finding.category === "stale_updated_at") {
        nextFrontmatter.updated_at = todayIsoDate();
      }
      if (finding.category === "stale_path_tags") {
        const tags = Array.isArray(nextFrontmatter.tags)
          ? nextFrontmatter.tags.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [];
        nextFrontmatter.tags = [
          ...new Set([
            ...tags,
            ...derivePathTags(
              notePath,
              path.resolve(options.projectRoot, options.notesDir),
            ),
          ]),
        ];
      }
    }
    const after = stringifyMarkdownFrontmatter(nextFrontmatter, parsed.body);
    const afterBodyHash = sha256(parseMarkdownFrontmatter(after).body);
    if (bodyHash !== afterBodyHash) {
      throw new Error(
        `Refusing to rewrite note body while linting ${notePath}`,
      );
    }
    if (before !== after) {
      await fs.writeFile(notePath, after, "utf8");
      await appendHistory({
        notesDir: options.notesDir,
        noteId: noteFindings[0]?.noteId ?? "unknown",
        changeKind: noteFindings.map((finding) => finding.category).join(","),
        beforeHash: sha256(before),
        afterHash: sha256(after),
      });
      applied += noteFindings.length;
    }
  }

  return { applied, skipped };
}
