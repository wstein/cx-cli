import fs from "node:fs/promises";
import path from "node:path";

import {
  buildNoteGraph,
  getBacklinks,
  getCodeReferences,
  getOutgoingLinks,
} from "../../notes/graph.js";
import { validateNotes } from "../../notes/validate.js";
import { CxError } from "../../shared/errors.js";
import { printError, printInfo, printSuccess } from "../../shared/format.js";
import { ensureDir, pathExists } from "../../shared/fs.js";
import { writeJson } from "../../shared/output.js";

export interface NotesArgs {
  subcommand?: string | undefined;
  title?: string | undefined;
  tags?: string[] | undefined;
  id?: string | undefined;
  json?: boolean | undefined;
}

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
  title: string,
  tags: string[] = [],
): string {
  const tagsList = tags.length > 0 ? tags.map((t) => `'${t}'`).join(", ") : "";
  const frontmatter = `---
id: ${id}
aliases: []
tags: [${tagsList}]
---

Write your note here. Keep it atomic and focused on one idea.

## Links

`;

  return frontmatter;
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

  // Ensure notes directory exists
  await ensureDir(notesPath);

  // Generate new ID
  const id = generateNoteId();

  // Create filename from title headline preserving a human-readable title.
  const baseName = fileNameFromTitle(title);
  let fileName = `${baseName}.md`;
  let filePath = path.join(notesPath, fileName);

  if (await pathExists(filePath)) {
    fileName = `${baseName} - ${id}.md`;
    filePath = path.join(notesPath, fileName);
  }

  // Render and write the new note
  const content = renderNewNote(id, title, options?.tags);
  await fs.writeFile(filePath, content, "utf-8");

  return { id, filePath };
}

/**
 * List all notes in the notes directory.
 */
export async function listNotes(
  notesDir: string = "notes",
): Promise<
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

export async function runNotesCommand(args: NotesArgs): Promise<number> {
  const subcommand = args.subcommand ?? "list";

  if (subcommand === "new") {
    if (!args.title) {
      throw new CxError("--title is required for 'cx notes new'", 2);
    }

    const { id, filePath } = await createNewNote(args.title, {
      tags: args.tags ?? undefined,
    });

    if (args.json ?? false) {
      writeJson({
        command: "notes new",
        id,
        title: args.title,
        filePath,
        tags: args.tags ?? [],
      });
    } else {
      printSuccess(`Created note: ${id}`);
      printInfo(`  File: ${filePath}`);
      printInfo(`  Title: ${args.title}`);
      if (args.tags && args.tags.length > 0) {
        printInfo(`  Tags: ${args.tags.join(", ")}`);
      }
    }

    return 0;
  }

  if (subcommand === "list") {
    const notes = await listNotes("notes");

    if (args.json ?? false) {
      writeJson({
        command: "notes list",
        count: notes.length,
        notes,
      });
    } else {
      if (notes.length === 0) {
        printInfo("No notes found in notes/ directory");
        return 0;
      }

      printInfo(`Found ${notes.length} note(s):\n`);
      for (const note of notes) {
        printInfo(`  [${note.id}] ${note.title}`);
        if (note.tags.length > 0) {
          printInfo(`      Tags: ${note.tags.join(", ")}`);
        }
      }
    }

    return 0;
  }

  if (subcommand === "backlinks") {
    if (!args.id) {
      throw new CxError("--id is required for 'cx notes backlinks'", 2);
    }

    const graph = await buildNoteGraph("notes", process.cwd());
    const note = graph.notes.get(args.id);

    if (!note) {
      throw new CxError(`Note not found: ${args.id}`, 2);
    }

    const backlinks = getBacklinks(graph, args.id);

    if (args.json ?? false) {
      writeJson({
        command: "notes backlinks",
        noteId: args.id,
        noteTitle: note.title,
        count: backlinks.length,
        backlinks,
      });
    } else {
      printInfo(`Backlinks to "${note.title}" (${args.id}):\n`);
      if (backlinks.length === 0) {
        printInfo("  (no backlinks)");
      } else {
        for (const link of backlinks) {
          printInfo(`  ← [${link.fromNoteId}] ${link.title}`);
        }
      }
    }

    return 0;
  }

  if (subcommand === "orphans") {
    const graph = await buildNoteGraph("notes", process.cwd());
    const orphans = graph.orphans.map((id) => {
      const note = graph.notes.get(id);
      return {
        id,
        title: note?.title ?? "Unknown",
      };
    });

    if (args.json ?? false) {
      writeJson({
        command: "notes orphans",
        count: orphans.length,
        orphans,
      });
    } else {
      printInfo(`Orphan notes (no incoming or outgoing links):\n`);
      if (orphans.length === 0) {
        printInfo("  (no orphans)");
      } else {
        for (const orphan of orphans) {
          printInfo(`  [${orphan.id}] ${orphan.title}`);
        }
      }
    }

    return 0;
  }

  if (subcommand === "code-links") {
    if (!args.id) {
      throw new CxError("--id is required for 'cx notes code-links'", 2);
    }

    const graph = await buildNoteGraph("notes", process.cwd());
    const note = graph.notes.get(args.id);

    if (!note) {
      throw new CxError(`Note not found: ${args.id}`, 2);
    }

    const codeFiles = getCodeReferences(graph, args.id);

    if (args.json ?? false) {
      writeJson({
        command: "notes code-links",
        noteId: args.id,
        noteTitle: note.title,
        count: codeFiles.length,
        codeFiles,
      });
    } else {
      printInfo(`Code references to "${note.title}" (${args.id}):\n`);
      if (codeFiles.length === 0) {
        printInfo("  (no code references)");
      } else {
        for (const file of codeFiles) {
          printInfo(`  📄 ${file}`);
        }
      }
    }

    return 0;
  }

  throw new CxError(
    `Unknown notes subcommand: ${subcommand}. Use 'new', 'list', 'backlinks', 'orphans', or 'code-links'.`,
    2,
  );
}
