import fs from "node:fs/promises";
import path from "node:path";
import { CxError } from "../shared/errors.js";
import { ensureDir, pathExists } from "../shared/fs.js";
import { parseMarkdownFrontmatter } from "./parser.js";
import type { NoteTarget } from "./validate.js";
import { validateNoteDocuments, validateNotes } from "./validate.js";

function noteTargetPriority(target: NoteTarget): number {
  return target === "current" ? 0 : 1;
}

export function describeNoteTarget(target: NoteTarget): string {
  return target === "current" ? "current target" : `target: ${target}`;
}

/**
 * Generate a note ID in YYYYMMDDHHMMSS format from the current time.
 */
let lastGeneratedNoteTimestamp = "";

function getCurrentTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}${second}`;
}

async function generateNoteId(): Promise<string> {
  let timestamp = getCurrentTimestamp();
  while (timestamp === lastGeneratedNoteTimestamp) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    timestamp = getCurrentTimestamp();
  }

  lastGeneratedNoteTimestamp = timestamp;
  return timestamp;
}

/**
 * Render a new note with the given parameters.
 */
function renderNewNote(
  id: string,
  title: string,
  tags: string[] = [],
  body?: string | undefined,
  target: NoteTarget = "current",
): string {
  const tagsList = tags.length > 0 ? tags.map((t) => `'${t}'`).join(", ") : "";
  const noteBody =
    body === undefined
      ? [
          `This note captures durable context about ${title} for later review and routing.`,
          "",
          "## What",
          "",
          `Describe the durable fact, mechanism, decision, or failure mode for ${title}.`,
          "",
          "## Why",
          "",
          `Explain why ${title} matters in this repository and which invariant it protects.`,
          "",
          "## How",
          "",
          `Describe how an operator, reviewer, or later agent should apply ${title}.`,
        ].join("\n")
      : body.trimEnd();
  const renderedBody = noteBody.length > 0 ? `${noteBody}\n` : "";
  return `---
id: ${id}
aliases: []
tags: [${tagsList}]
target: ${target}
---

${renderedBody}## Links

`;
}

function renderUpdatedNote(params: {
  id: string;
  target: NoteTarget;
  aliases: string[];
  tags: string[];
  title?: string | undefined;
  body: string;
  linksSection: string;
}): string {
  const frontmatterTitle =
    params.title !== undefined && params.title.trim().length > 0
      ? `\ntitle: ${JSON.stringify(params.title.trim())}`
      : "";
  const tagsList =
    params.tags.length > 0
      ? params.tags.map((tag) => `'${tag}'`).join(", ")
      : "";
  const body = params.body.trimEnd();
  const bodySection = body.length > 0 ? `${body}\n\n` : "";
  const linksSection = params.linksSection.trimEnd();
  const renderedLinks =
    linksSection.length > 0 ? `${linksSection}\n` : "## Links\n\n";

  return `---
id: ${params.id}${frontmatterTitle}
aliases: [${params.aliases.join(", ")}]
tags: [${tagsList}]
target: ${params.target}
---

${bodySection}${renderedLinks}`;
}

function splitBodyAndLinks(body: string): {
  bodySection: string;
  linksSection: string;
} {
  const linksIndex = body.search(/^\s*##\s+Links\s*$/m);

  return {
    bodySection:
      linksIndex >= 0 ? body.slice(0, linksIndex).trimEnd() : body.trimEnd(),
    linksSection:
      linksIndex >= 0 ? body.slice(linksIndex).trimEnd() : "## Links\n\n",
  };
}

function createTextMatcher(params: {
  query: string;
  regex?: boolean | undefined;
  caseSensitive?: boolean | undefined;
}): (value: string) => boolean {
  if (params.regex === true) {
    let matcher: RegExp;
    try {
      matcher = new RegExp(
        params.query,
        params.caseSensitive === true ? "" : "i",
      );
    } catch (error) {
      throw new CxError(
        `Invalid regular expression for note search: ${error instanceof Error ? error.message : String(error)}`,
        2,
      );
    }

    return (value: string) => matcher.test(value);
  }

  if (params.caseSensitive === true) {
    return (value: string) => value.includes(params.query);
  }

  const needle = params.query.toLowerCase();
  return (value: string) => value.toLowerCase().includes(needle);
}

function buildBodySnippet(
  body: string,
  matcher: (value: string) => boolean,
): string {
  const lines = body.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    if (matcher(line)) {
      return line.length > 160 ? `${line.slice(0, 157)}...` : line;
    }
  }

  return body.trim().slice(0, 160);
}

function matchesTags(
  noteTags: string[],
  queryTags: string[] | undefined,
): boolean {
  if (!queryTags || queryTags.length === 0) {
    return true;
  }

  const normalized = new Set(noteTags.map((tag) => tag.toLowerCase()));
  return queryTags.every((tag) => normalized.has(tag.toLowerCase()));
}

export interface ReadNoteResult {
  id: string;
  target: NoteTarget;
  title: string;
  filePath: string;
  fileName: string;
  aliases: string[];
  tags: string[];
  summary: string;
  codeLinks: string[];
  frontmatter: Record<string, unknown>;
  body: string;
  content: string;
}

export interface SearchNoteResult {
  id: string;
  target: NoteTarget;
  title: string;
  filePath: string;
  fileName: string;
  aliases: string[];
  tags: string[];
  summary: string;
  codeLinks: string[];
  matchedFields: string[];
  snippet: string;
}

export interface WriteNoteResult {
  id: string;
  filePath: string;
  title: string;
  tags: string[];
  target: NoteTarget;
}

interface NoteWorkspaceOptions {
  notesDir?: string | undefined;
  workspaceRoot?: string | undefined;
}

function fileNameFromTitle(title: string): string {
  const cleaned = title
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[\\/]+/g, " ")
    .replace(/[:?<>|*"`]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .replace(/[.\s]+$/, "");

  return cleaned || "untitled";
}

function assertRenderedNoteValid(filePath: string, content: string): void {
  const validation = validateNoteDocuments([{ filePath, content }]);
  if (validation.valid) {
    return;
  }

  const issue = validation.errors[0]?.error ?? "Unknown note validation error";
  throw new CxError(
    `Refusing to write invalid note content for ${path.basename(filePath)}: ${issue}`,
    10,
    {
      remediation: {
        docsRef:
          "docs/modules/ROOT/pages/repository/docs/governance.adoc#notes-governance",
        whyThisProtectsYou:
          "The notes graph is the repository cognition layer. Rejecting invalid note writes keeps low-signal or malformed memory from becoming durable project context.",
        nextSteps: [
          "Revise the note so the opening paragraph forms a stand-alone summary.",
          "Keep the note atomic and within the documented size limits before writing it again.",
        ],
      },
    },
  );
}

/**
 * Create a new note in the notes directory.
 */
export async function createNewNote(
  title: string,
  options?: {
    body?: string | undefined;
    tags?: string[] | undefined;
    target?: NoteTarget | undefined;
    notesDir?: string | undefined;
    workspaceRoot?: string | undefined;
  },
): Promise<WriteNoteResult> {
  const notesDir = options?.notesDir ?? "notes";
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const notesPath = path.resolve(workspaceRoot, notesDir);

  await ensureDir(notesPath);

  const id = await generateNoteId();
  const baseName = fileNameFromTitle(title);
  let fileName = `${baseName}.md`;
  let filePath = path.join(notesPath, fileName);

  if (await pathExists(filePath)) {
    fileName = `${baseName} - ${id}.md`;
    filePath = path.join(notesPath, fileName);
  }

  const content = renderNewNote(
    id,
    title,
    options?.tags,
    options?.body,
    options?.target ?? "current",
  );
  assertRenderedNoteValid(filePath, content);
  await fs.writeFile(filePath, content, "utf-8");

  return {
    id,
    filePath,
    title,
    tags: options?.tags ?? [],
    target: options?.target ?? "current",
  };
}

export async function updateNote(
  noteId: string,
  options?: {
    body?: string | undefined;
    tags?: string[] | undefined;
    target?: NoteTarget | undefined;
    title?: string | undefined;
    notesDir?: string | undefined;
    workspaceRoot?: string | undefined;
  },
): Promise<WriteNoteResult> {
  const notesDir = options?.notesDir ?? "notes";
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const result = await validateNotes(notesDir, workspaceRoot);
  const note = result.notes.find((entry) => entry.id === noteId);

  if (!note) {
    throw new CxError(`Note not found: ${noteId}`, 2);
  }

  const filePath = note.filePath;
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseMarkdownFrontmatter(content);
  const aliases = Array.isArray(parsed.frontmatter.aliases)
    ? parsed.frontmatter.aliases.filter(
        (alias): alias is string =>
          typeof alias === "string" && alias.trim().length > 0,
      )
    : [];
  const existingTags = Array.isArray(parsed.frontmatter.tags)
    ? parsed.frontmatter.tags.filter(
        (tag): tag is string =>
          typeof tag === "string" && tag.trim().length > 0,
      )
    : [];
  const body = options?.body ?? parsed.body;
  const { bodySection, linksSection } = splitBodyAndLinks(body);
  const rendered = renderUpdatedNote({
    id: note.id,
    target: options?.target ?? note.target,
    aliases,
    tags: options?.tags ?? existingTags,
    title:
      options?.title ??
      (typeof parsed.frontmatter.title === "string"
        ? parsed.frontmatter.title
        : undefined),
    body: bodySection,
    linksSection,
  });

  assertRenderedNoteValid(filePath, rendered);
  await fs.writeFile(filePath, rendered, "utf8");

  return {
    id: note.id,
    filePath,
    title: options?.title ?? note.title,
    tags: options?.tags ?? existingTags,
    target: options?.target ?? note.target,
  };
}

export async function renameNote(
  noteId: string,
  title: string,
  options?: {
    notesDir?: string | undefined;
    workspaceRoot?: string | undefined;
  },
): Promise<WriteNoteResult & { previousFilePath: string }> {
  const notesDir = options?.notesDir ?? "notes";
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const result = await validateNotes(notesDir, workspaceRoot);
  const note = result.notes.find((entry) => entry.id === noteId);

  if (!note) {
    throw new CxError(`Note not found: ${noteId}`, 2);
  }

  const currentPath = note.filePath;
  const content = await fs.readFile(currentPath, "utf8");
  const parsed = parseMarkdownFrontmatter(content);
  const aliases = Array.isArray(parsed.frontmatter.aliases)
    ? parsed.frontmatter.aliases.filter(
        (alias): alias is string =>
          typeof alias === "string" && alias.trim().length > 0,
      )
    : [];
  const tags = Array.isArray(parsed.frontmatter.tags)
    ? parsed.frontmatter.tags.filter(
        (tag): tag is string =>
          typeof tag === "string" && tag.trim().length > 0,
      )
    : [];
  const { bodySection, linksSection } = splitBodyAndLinks(parsed.body);
  const rendered = renderUpdatedNote({
    id: note.id,
    target: note.target,
    aliases,
    tags,
    title,
    body: bodySection,
    linksSection,
  });

  const baseName = fileNameFromTitle(title);
  const notesPath = path.resolve(workspaceRoot, notesDir);
  const desiredPath = path.join(notesPath, `${baseName}.md`);
  let finalPath = desiredPath;
  if (path.resolve(desiredPath) !== path.resolve(currentPath)) {
    if (await pathExists(desiredPath)) {
      finalPath = path.join(notesPath, `${baseName} - ${note.id}.md`);
    }
    if (path.resolve(finalPath) !== path.resolve(currentPath)) {
      await fs.rename(currentPath, finalPath);
    }
  }

  assertRenderedNoteValid(finalPath, rendered);
  await fs.writeFile(finalPath, rendered, "utf8");

  return {
    id: note.id,
    filePath: finalPath,
    previousFilePath: currentPath,
    title,
    tags,
    target: note.target,
  };
}

export async function deleteNote(
  noteId: string,
  options?: {
    notesDir?: string | undefined;
    workspaceRoot?: string | undefined;
  },
): Promise<{
  id: string;
  filePath: string;
  title: string;
  target: NoteTarget;
}> {
  const notesDir = options?.notesDir ?? "notes";
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const result = await validateNotes(notesDir, workspaceRoot);
  const note = result.notes.find((entry) => entry.id === noteId);

  if (!note) {
    throw new CxError(`Note not found: ${noteId}`, 2);
  }

  await fs.rm(note.filePath, { force: true });

  return {
    id: note.id,
    filePath: note.filePath,
    title: note.title,
    target: note.target,
  };
}

export async function readNote(
  noteId: string,
  options?: {
    notesDir?: string | undefined;
    workspaceRoot?: string | undefined;
  },
): Promise<ReadNoteResult> {
  const notesDir = options?.notesDir ?? "notes";
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const result = await validateNotes(notesDir, workspaceRoot);
  const note = result.notes.find((entry) => entry.id === noteId);

  if (!note) {
    throw new CxError(`Note not found: ${noteId}`, 2);
  }

  const content = await fs.readFile(note.filePath, "utf8");
  const parsed = parseMarkdownFrontmatter(content);

  return {
    id: note.id,
    target: note.target,
    title: note.title,
    filePath: note.filePath,
    fileName: note.fileName,
    aliases: note.aliases ?? [],
    tags: note.tags ?? [],
    summary: note.summary,
    codeLinks: note.codeLinks,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    content,
  };
}

export async function searchNotes(
  query: string,
  options?: {
    caseSensitive?: boolean | undefined;
    limit?: number | undefined;
    notesDir?: string | undefined;
    regex?: boolean | undefined;
    tags?: string[] | undefined;
    workspaceRoot?: string | undefined;
  },
): Promise<{
  query: string;
  count: number;
  notes: SearchNoteResult[];
}> {
  const notesDir = options?.notesDir ?? "notes";
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const result = await validateNotes(notesDir, workspaceRoot);
  const matcher = createTextMatcher({
    query,
    regex: options?.regex,
    caseSensitive: options?.caseSensitive,
  });
  const limit =
    options?.limit !== undefined
      ? Math.max(1, Math.min(options.limit, 100))
      : 20;
  const results: SearchNoteResult[] = [];

  const sortedNotes = [...result.notes].sort(
    (left, right) =>
      noteTargetPriority(left.target) - noteTargetPriority(right.target) ||
      left.title.localeCompare(right.title, "en"),
  );

  for (const note of sortedNotes) {
    if (!matchesTags(note.tags ?? [], options?.tags)) {
      continue;
    }

    const parsed = parseMarkdownFrontmatter(
      await fs.readFile(note.filePath, "utf8"),
    );
    const aliasMatches = (note.aliases ?? []).filter((alias) => matcher(alias));
    const tagMatches = (note.tags ?? []).filter((tag) => matcher(tag));
    const matchedFields = new Set<string>();

    if (matcher(note.title)) {
      matchedFields.add("title");
    }
    if (matcher(note.summary)) {
      matchedFields.add("summary");
    }
    if (aliasMatches.length > 0) {
      matchedFields.add("aliases");
    }
    if (tagMatches.length > 0) {
      matchedFields.add("tags");
    }
    if (matcher(parsed.body)) {
      matchedFields.add("body");
    }

    if (matchedFields.size === 0) {
      continue;
    }

    let snippet = buildBodySnippet(parsed.body, matcher);
    if (aliasMatches[0] !== undefined) {
      snippet = aliasMatches[0];
    } else if (tagMatches[0] !== undefined) {
      snippet = tagMatches[0];
    } else if (matchedFields.has("title")) {
      snippet = note.title;
    } else if (matchedFields.has("summary")) {
      snippet = note.summary;
    }

    results.push({
      id: note.id,
      target: note.target,
      title: note.title,
      filePath: note.filePath,
      fileName: note.fileName,
      aliases: note.aliases ?? [],
      tags: note.tags ?? [],
      summary: note.summary,
      codeLinks: note.codeLinks,
      matchedFields: [...matchedFields],
      snippet,
    });

    if (results.length >= limit) {
      break;
    }
  }

  return {
    query,
    count: results.length,
    notes: results,
  };
}

/**
 * List all notes in the notes directory.
 */
export async function listNotes(
  notesDir: string = "notes",
  options?: NoteWorkspaceOptions,
): Promise<
  Array<{
    id: string;
    target: NoteTarget;
    title: string;
    fileName: string;
    tags: string[];
  }>
> {
  const workspaceRoot = path.resolve(options?.workspaceRoot ?? process.cwd());
  const result = await validateNotes(notesDir, workspaceRoot);

  return [...result.notes]
    .sort(
      (left, right) =>
        noteTargetPriority(left.target) - noteTargetPriority(right.target) ||
        left.title.localeCompare(right.title, "en"),
    )
    .map((note) => ({
      id: note.id,
      target: note.target,
      title: note.title,
      fileName: note.fileName,
      tags: note.tags ?? [],
    }));
}
