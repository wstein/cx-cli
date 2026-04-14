import {
  buildNoteGraph,
  getBacklinks,
  getBrokenLinks,
  getCodeReferences,
  getOutgoingLinks,
} from "../../../notes/graph.js";
import { CxError } from "../../../shared/errors.js";
import { printInfo, printSuccess } from "../../../shared/format.js";
import { writeJson } from "../../../shared/output.js";
import {
  createNewNote,
  deleteNote,
  listNotes,
  renameNote,
} from "./common.js";

export interface NotesArgs {
  subcommand?: string | undefined;
  title?: string | undefined;
  tags?: string[] | undefined;
  id?: string | undefined;
  json?: boolean | undefined;
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

  if (subcommand === "rename") {
    if (!args.id) {
      throw new CxError("--id is required for 'cx notes rename'", 2);
    }
    if (!args.title) {
      throw new CxError("--title is required for 'cx notes rename'", 2);
    }

    const note = await renameNote(args.id, args.title);

    if (args.json ?? false) {
      writeJson({
        command: "notes rename",
        id: note.id,
        title: note.title,
        filePath: note.filePath,
        previousFilePath: note.previousFilePath,
        tags: note.tags,
      });
    } else {
      printSuccess(`Renamed note: ${note.id}`);
      printInfo(`  File: ${note.filePath}`);
      printInfo(`  Previous file: ${note.previousFilePath}`);
      printInfo(`  Title: ${note.title}`);
      if (note.tags.length > 0) {
        printInfo(`  Tags: ${note.tags.join(", ")}`);
      }
    }

    return 0;
  }

  if (subcommand === "delete") {
    if (!args.id) {
      throw new CxError("--id is required for 'cx notes delete'", 2);
    }

    const note = await deleteNote(args.id);

    if (args.json ?? false) {
      writeJson({
        command: "notes delete",
        id: note.id,
        title: note.title,
        filePath: note.filePath,
      });
    } else {
      printSuccess(`Deleted note: ${note.id}`);
      printInfo(`  File: ${note.filePath}`);
      printInfo(`  Title: ${note.title}`);
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
          printInfo(`  [${link.fromNoteId}] ${link.title}`);
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
      if (orphans.length === 0) {
        printInfo("No orphan notes found");
        return 0;
      }

      printInfo(`Orphan notes (no incoming or outgoing links):\n`);
      for (const orphan of orphans) {
        printInfo(`  [${orphan.id}] ${orphan.title}`);
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

  if (subcommand === "links") {
    const graph = await buildNoteGraph("notes", process.cwd());

    if (args.id) {
      const note = graph.notes.get(args.id);
      if (!note) {
        throw new CxError(`Note not found: ${args.id}`, 2);
      }

      const outgoing = getOutgoingLinks(graph, args.id);
      const broken = getBrokenLinks(graph, args.id);

      if (args.json ?? false) {
        writeJson({
          command: "notes links",
          noteId: args.id,
          noteTitle: note.title,
          outgoing,
          outgoingCount: outgoing.length,
          brokenLinks: broken,
          brokenCount: broken.length,
        });
      } else {
        printInfo(`Links for "${note.title}" (${args.id}):\n`);
        printInfo("  Outgoing:");
        if (outgoing.length === 0) {
          printInfo("    (no outgoing links)");
        } else {
          for (const link of outgoing) {
            printInfo(`    [${link.toNoteId}] ${link.title}`);
          }
        }

        printInfo("  Unresolved:");
        if (broken.length === 0) {
          printInfo("    (no unresolved links)");
        } else {
          for (const issue of broken) {
            printInfo(`    ${issue.reference} (${issue.source})`);
          }
        }
      }

      return 0;
    }

    const broken = getBrokenLinks(graph);

    if (args.json ?? false) {
      writeJson({
        command: "notes links",
        count: broken.length,
        brokenLinks: broken,
      });
    } else {
      if (broken.length === 0) {
        printInfo("No unresolved links found in notes/");
      } else {
        printInfo("Unresolved links:\n");
        for (const issue of broken) {
          printInfo(
            `  [${issue.fromNoteId}] ${issue.fromTitle} -> ${issue.reference}`,
          );
        }
      }
    }

    return 0;
  }

  throw new CxError(
    `Unknown notes subcommand: ${subcommand}. Use 'new', 'rename', 'delete', 'list', 'backlinks', 'orphans', 'code-links', or 'links'.`,
    2,
  );
}
