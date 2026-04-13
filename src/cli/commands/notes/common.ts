import fs from "node:fs/promises";
import path from "node:path";

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
function renderNewNote(id: string, tags: string[] = []): string {
  const tagsList = tags.length > 0 ? tags.map((t) => `'${t}'`).join(", ") : "";
  return `---
id: ${id}
aliases: []
tags: [${tagsList}]
---

Write your note here. Keep it atomic and focused on one idea.

## Links

`;
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

  const content = renderNewNote(id, options?.tags);
  await fs.writeFile(filePath, content, "utf-8");

  return { id, filePath };
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
