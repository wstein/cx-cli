import fs from "node:fs/promises";
import path from "node:path";

import { parseMarkdownFrontmatter } from "../../../notes/parser.js";
import { validateNotes } from "../../../notes/validate.js";
import { ensureDir, pathExists } from "../../../shared/fs.js";

/**
 * Generate a note ID in YYYYMMDDHHMMSS format from the current time.
 */
function generateNoteId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}${second}`;
}

/**
 * Render a new note with the given parameters.
 */
function renderNewNote(
  id: string,
  tags: string[] = [],
  body?: string | undefined,
): string {
  const tagsList = tags.length > 0 ? tags.map((t) => `'${t}'`).join(", ") : "";
  const noteBody =
    body === undefined
      ? "Write your note here. Keep it atomic and focused on one idea."
      : body.trimEnd();
  const renderedBody = noteBody.length > 0 ? `${noteBody}\n` : "";
  return `---
id: ${id}
aliases: []
tags: [${tagsList}]
---

${renderedBody}## Links

`;
}

function renderUpdatedNote(params: {
  id: string;
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
    params.tags.length > 0 ? params.tags.map((tag) => `'${tag}'`).join(", ") : "";
  const body = params.body.trimEnd();
  const bodySection = body.length > 0 ? `${body}\n\n` : "";
  const linksSection = params.linksSection.trimEnd();
  const renderedLinks =
    linksSection.length > 0 ? `${linksSection}\n` : "## Links\n\n";

  return `---
id: ${params.id}${frontmatterTitle}
aliases: [${params.aliases.join(", ")}]
tags: [${tagsList}]
---

${bodySection}${renderedLinks}`;
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

/**
 * Create a new note in the notes directory.
 */
export async function createNewNote(
  title: string,
  options?: {
    body?: string | undefined;
    tags?: string[] | undefined;
    notesDir?: string | undefined;
  },
): Promise<{ id: string; filePath: string }> {
  const notesDir = options?.notesDir ?? "notes";
  const notesPath = path.resolve(notesDir);

  await ensureDir(notesPath);

  const id = generateNoteId();
  const baseName = fileNameFromTitle(title);
  let fileName = `${baseName}.md`;
  let filePath = path.join(notesPath, fileName);

  if (await pathExists(filePath)) {
    fileName = `${baseName} - ${id}.md`;
    filePath = path.join(notesPath, fileName);
  }

  const content = renderNewNote(id, options?.tags, options?.body);
  await fs.writeFile(filePath, content, "utf-8");

  return { id, filePath };
}

export async function updateNote(
  noteId: string,
  options?: {
    body?: string | undefined;
    tags?: string[] | undefined;
    title?: string | undefined;
    notesDir?: string | undefined;
  },
): Promise<{ id: string; filePath: string; title: string; tags: string[] }> {
  const notesDir = options?.notesDir ?? "notes";
  const result = await validateNotes(notesDir, process.cwd());
  const note = result.notes.find((entry) => entry.id === noteId);

  if (!note) {
    throw new Error(`Note not found: ${noteId}`);
  }

  const filePath = note.filePath;
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseMarkdownFrontmatter(content);
  const aliases = Array.isArray(parsed.frontmatter.aliases)
    ? parsed.frontmatter.aliases.filter(
        (alias): alias is string => typeof alias === "string" && alias.trim().length > 0,
      )
    : [];
  const existingTags = Array.isArray(parsed.frontmatter.tags)
    ? parsed.frontmatter.tags.filter(
        (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
      )
    : [];
  const body = options?.body ?? parsed.body;
  const linksIndex = body.search(/^\s*##\s+Links\s*$/m);
  const bodySection =
    linksIndex >= 0 ? body.slice(0, linksIndex).trimEnd() : body.trimEnd();
  const linksSection =
    linksIndex >= 0 ? body.slice(linksIndex).trimEnd() : "## Links\n\n";
  const rendered = renderUpdatedNote({
    id: note.id,
    aliases,
    tags: options?.tags ?? existingTags,
    title: options?.title ?? (typeof parsed.frontmatter.title === "string" ? parsed.frontmatter.title : undefined),
    body: bodySection,
    linksSection,
  });

  await fs.writeFile(filePath, rendered, "utf8");

  return {
    id: note.id,
    filePath,
    title: options?.title ?? note.title,
    tags: options?.tags ?? existingTags,
  };
}

/**
 * List all notes in the notes directory.
 */
export async function listNotes(notesDir: string = "notes"): Promise<
  Array<{
    id: string;
    title: string;
    fileName: string;
    tags: string[];
  }>
> {
  const result = await validateNotes(notesDir, process.cwd());

  return result.notes.map((note) => ({
    id: note.id,
    title: note.title,
    fileName: note.fileName,
    tags: note.tags ?? [],
  }));
}
