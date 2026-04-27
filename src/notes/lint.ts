import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { CxSectionConfig } from "../config/types.js";
import {
  collectNoteCodePathWarnings,
  type NoteCodePathWarning,
} from "./consistency.js";
import { looksLikeCodePath } from "./linking.js";
import {
  parseMarkdownFrontmatter,
  stringifyMarkdownFrontmatter,
} from "./parser.js";
import type { NoteMetadata } from "./validate.js";
import { validateNotes } from "./validate.js";

const execFileAsync = promisify(execFile);
const MIN_RENAME_CONFIDENCE = 0.9;

export type NotesLintMutationKind =
  | "frontmatter.path_tags"
  | "frontmatter.structural_anchor";

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
  readonly replacementPath?: string;
  readonly suggestedFix: string;
  readonly confidence: number;
  readonly autoFixable: boolean;
}

export interface RenameCandidate {
  readonly oldPath: string;
  readonly newPath: string;
  readonly score: number;
  readonly commit: string;
}

export type RenameDetector = (
  missingPath: string,
  projectRoot: string,
) => Promise<RenameCandidate[]>;

type GitRenameRunner = (
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
) => Promise<{ stdout: string }>;

function runGitCommand(
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
): Promise<{ stdout: string }> {
  const [command, ...commandArgs] = args;
  if (command === undefined) {
    return Promise.resolve({ stdout: "" });
  }
  return execFileAsync(command, commandArgs, options);
}

export interface LintNotesOptions {
  readonly noteId?: string;
  readonly repositoryPaths?: Iterable<string>;
  readonly sectionEntries?: Map<string, CxSectionConfig>;
  readonly renameDetector?: RenameDetector;
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

function parseGitRenameCandidates(
  stdout: string,
  missingPath: string,
): RenameCandidate[] {
  const candidates: RenameCandidate[] = [];
  let commit = "unknown";
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith("commit:")) {
      commit = line.slice("commit:".length).trim();
      continue;
    }
    const fields = line.split("\t");
    const status = fields[0] ?? "";
    if (!status.startsWith("R") || fields.length < 3) {
      continue;
    }
    const oldPath = fields[1] ?? "";
    const newPath = fields[2] ?? "";
    if (oldPath !== missingPath || newPath.length === 0) {
      continue;
    }
    const scoreText = status.slice(1);
    const score =
      scoreText.length === 0 ? 1 : Number.parseInt(scoreText, 10) / 100;
    candidates.push({
      oldPath,
      newPath,
      score: Number.isFinite(score) ? score : 1,
      commit,
    });
  }
  return candidates;
}

export async function detectGitFollowRenames(
  missingPath: string,
  projectRoot: string,
  runGit: GitRenameRunner = runGitCommand,
): Promise<RenameCandidate[]> {
  const commands = [
    [
      "log",
      "--max-count=5",
      "--follow",
      "--name-status",
      "--format=commit:%H",
      "-M",
      "--",
      missingPath,
    ],
    [
      "log",
      "--max-count=5",
      "--name-status",
      "--format=commit:%H",
      "-M",
      "--",
      "notes/",
    ],
  ];
  const candidates = new Map<string, RenameCandidate>();
  for (const args of commands) {
    try {
      const { stdout } = await runGit(["git", ...args], {
        cwd: projectRoot,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_PAGER: "cat",
        },
      });
      for (const candidate of parseGitRenameCandidates(stdout, missingPath)) {
        const current = candidates.get(candidate.newPath);
        if (current === undefined || candidate.score > current.score) {
          candidates.set(candidate.newPath, candidate);
        }
      }
      if (candidates.size > 0) {
        break;
      }
    } catch {
      // Non-git workspaces keep rename fixes report-only.
    }
  }
  return [...candidates.values()];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function scoreRenameCandidates(candidates: readonly RenameCandidate[]): {
  candidate?: RenameCandidate;
  confidence: number;
} {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const [best, second] = sorted;
  if (best === undefined) {
    return { confidence: 0 };
  }
  if (second === undefined) {
    return { candidate: best, confidence: 0.95 };
  }
  return {
    candidate: best,
    confidence: Math.max(0, best.score - second.score),
  };
}

async function noteHasFrontmatterReference(
  notePath: string,
  referencePath: string,
): Promise<boolean> {
  const content = await fs.readFile(notePath, "utf8");
  const { frontmatter } = parseMarkdownFrontmatter(content);
  const stack: unknown[] = Object.values(frontmatter);
  while (stack.length > 0) {
    const value = stack.pop();
    if (value === referencePath) {
      return true;
    }
    if (Array.isArray(value)) {
      stack.push(...value);
    } else if (typeof value === "object" && value !== null) {
      stack.push(...Object.values(value as Record<string, unknown>));
    }
  }
  return false;
}

async function toLintFinding(
  warning: NoteCodePathWarning,
  notePath: string,
  projectRoot: string,
  renameDetector: RenameDetector,
): Promise<LintFinding> {
  if (warning.status === "missing") {
    const candidates = (await renameDetector(warning.path, projectRoot)).filter(
      (candidate) => candidate.oldPath === warning.path,
    );
    const existingCandidates: RenameCandidate[] = [];
    for (const candidate of candidates) {
      if (await pathExists(path.join(projectRoot, candidate.newPath))) {
        existingCandidates.push(candidate);
      }
    }
    const rename = scoreRenameCandidates(existingCandidates);
    if (rename.candidate !== undefined) {
      const autoFixable =
        rename.confidence >= MIN_RENAME_CONFIDENCE &&
        (await noteHasFrontmatterReference(notePath, warning.path));
      return {
        category: warning.status,
        noteId: warning.fromNoteId,
        noteTitle: warning.fromTitle,
        notePath,
        targetPath: warning.path,
        replacementPath: rename.candidate.newPath,
        suggestedFix: autoFixable
          ? `Rewrite structural frontmatter anchor from ${warning.path} to ${rename.candidate.newPath}.`
          : `Possible rename candidate ${rename.candidate.newPath} is below confidence threshold.`,
        confidence: rename.confidence,
        autoFixable,
      };
    }
  }

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

function collectFrontmatterPathRefs(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = value.split("#", 1)[0]?.replace(/^\.\/+/u, "") ?? "";
    return looksLikeCodePath(normalized) ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectFrontmatterPathRefs(entry));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap((entry) =>
      collectFrontmatterPathRefs(entry),
    );
  }
  return [];
}

async function collectFrontmatterWarnings(params: {
  notes: NoteMetadata[];
  projectRoot: string;
  repositoryPaths?: Iterable<string>;
  sectionEntries?: Map<string, CxSectionConfig>;
}): Promise<NoteCodePathWarning[]> {
  const repositoryPaths =
    params.repositoryPaths === undefined
      ? null
      : new Set(
          [...params.repositoryPaths].map((entry) =>
            entry.replaceAll("\\", "/"),
          ),
        );
  const warnings: NoteCodePathWarning[] = [];
  for (const note of params.notes) {
    const content = await fs.readFile(note.filePath, "utf8");
    const { frontmatter } = parseMarkdownFrontmatter(content);
    const refs = new Set(collectFrontmatterPathRefs(frontmatter.claims));
    for (const ref of refs) {
      const inRepository =
        repositoryPaths?.has(ref) ??
        (await pathExists(path.join(params.projectRoot, ref)));
      if (!inRepository) {
        warnings.push({
          fromNoteId: note.id,
          fromTitle: note.title,
          reference: ref,
          path: ref,
          status: "missing",
        });
      }
    }
  }
  return warnings;
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
  const renameDetector = options.renameDetector ?? detectGitFollowRenames;

  const warnings = await collectNoteCodePathWarnings(
    filteredNotes,
    projectRoot,
    options.repositoryPaths,
    options.sectionEntries,
  );
  warnings.push(
    ...(await collectFrontmatterWarnings({
      notes: filteredNotes,
      projectRoot,
      ...(options.repositoryPaths !== undefined
        ? { repositoryPaths: options.repositoryPaths }
        : {}),
      ...(options.sectionEntries !== undefined
        ? { sectionEntries: options.sectionEntries }
        : {}),
    })),
  );
  for (const warning of warnings) {
    findings.push(
      await toLintFinding(
        warning,
        notePathById.get(warning.fromNoteId) ?? "",
        projectRoot,
        renameDetector,
      ),
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
        suggestedFix:
          "Review updated_at manually; notes lint does not rewrite audit metadata.",
        confidence: 1,
        autoFixable: false,
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
        autoFixable: tags.length === 0,
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

function replaceStringRefs(value: unknown, from: string, to: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === "string" && entry === from
        ? to
        : replaceStringRefs(entry, from, to),
    );
  }
  if (typeof value === "object" && value !== null) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] =
        typeof entry === "string" && entry === from
          ? to
          : replaceStringRefs(entry, from, to);
    }
    return next;
  }
  return value;
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
    const mutationKinds = new Set<NotesLintMutationKind>();
    for (const finding of noteFindings) {
      if (
        finding.category === "missing" &&
        finding.targetPath !== undefined &&
        finding.replacementPath !== undefined
      ) {
        mutationKinds.add("frontmatter.structural_anchor");
        for (const key of ["claims", "code_refs", "test_refs", "doc_refs"]) {
          if (nextFrontmatter[key] !== undefined) {
            nextFrontmatter[key] = replaceStringRefs(
              nextFrontmatter[key],
              finding.targetPath,
              finding.replacementPath,
            );
          }
        }
      }
      if (finding.category === "stale_path_tags") {
        mutationKinds.add("frontmatter.path_tags");
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
        changeKind: [...mutationKinds].sort().join(","),
        beforeHash: sha256(before),
        afterHash: sha256(after),
      });
      applied += noteFindings.length;
    }
  }

  return { applied, skipped };
}
