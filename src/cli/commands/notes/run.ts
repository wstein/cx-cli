import {
  checkNoteCoverage,
  checkNotesConsistency,
} from "../../../notes/consistency.js";
import {
  createNewNote,
  deleteNote,
  listNotes,
  readNote,
  renameNote,
  updateNote,
} from "../../../notes/crud.js";
import {
  buildNoteGraph,
  getBacklinks,
  getBrokenLinks,
  getCodeReferences,
  getOutgoingLinks,
  getReachableNotes,
} from "../../../notes/graph.js";
import { CxError } from "../../../shared/errors.js";
import {
  printInfo as basePrintInfo,
  printSuccess as basePrintSuccess,
  printWarning as basePrintWarning,
} from "../../../shared/format.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeJson,
  writeStdout,
} from "../../../shared/output.js";

export interface NotesArgs {
  subcommand?: string | undefined;
  body?: string | undefined;
  title?: string | undefined;
  tags?: string[] | undefined;
  id?: string | undefined;
  depth?: number | undefined;
  json?: boolean | undefined;
}
export async function runNotesCommand(
  args: NotesArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const printInfo = (message: string) => basePrintInfo(message, io);
  const printSuccess = (message: string) => basePrintSuccess(message, io);
  const printWarning = (message: string) => basePrintWarning(message, io);
  const writeJsonOutput = (value: unknown) => writeJson(value, io);
  const subcommand = args.subcommand ?? "list";

  if (subcommand === "new") {
    if (!args.title) {
      throw new CxError("--title is required for 'cx notes new'", 2);
    }

    const { id, filePath } = await createNewNote(args.title, {
      body: args.body,
      tags: args.tags ?? undefined,
    });

    if (args.json ?? false) {
      writeJsonOutput({
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

  if (subcommand === "read") {
    if (!args.id) {
      throw new CxError("--id is required for 'cx notes read'", 2);
    }

    const note = await readNote(args.id);

    if (args.json ?? false) {
      writeJsonOutput({
        command: "notes read",
        ...note,
      });
    } else {
      printSuccess(`Read note: ${note.id}`);
      printInfo(`  File: ${note.filePath}`);
      printInfo(`  Title: ${note.title}`);
      if (note.aliases.length > 0) {
        printInfo(`  Aliases: ${note.aliases.join(", ")}`);
      }
      if (note.tags.length > 0) {
        printInfo(`  Tags: ${note.tags.join(", ")}`);
      }
      printInfo(`  Summary: ${note.summary}`);
      printInfo("");
      writeStdout(`${note.body.trimEnd()}\n`, io);
    }

    return 0;
  }

  if (subcommand === "update") {
    if (!args.id) {
      throw new CxError("--id is required for 'cx notes update'", 2);
    }
    if (
      args.title === undefined &&
      args.body === undefined &&
      args.tags === undefined
    ) {
      throw new CxError(
        "At least one of --title, --body, or --tags is required for 'cx notes update'",
        2,
      );
    }

    const note = await updateNote(args.id, {
      body: args.body,
      tags: args.tags,
      title: args.title,
    });

    if (args.json ?? false) {
      writeJsonOutput({
        command: "notes update",
        id: note.id,
        title: note.title,
        filePath: note.filePath,
        tags: note.tags,
      });
    } else {
      printSuccess(`Updated note: ${note.id}`);
      printInfo(`  File: ${note.filePath}`);
      printInfo(`  Title: ${note.title}`);
      if (note.tags.length > 0) {
        printInfo(`  Tags: ${note.tags.join(", ")}`);
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
      writeJsonOutput({
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
      writeJsonOutput({
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
      writeJsonOutput({
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
      writeJsonOutput({
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
      writeJsonOutput({
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
      writeJsonOutput({
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
        writeJsonOutput({
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

        printInfo("  Broken links:");
        if (broken.length === 0) {
          printInfo("    (no broken links)");
        } else {
          for (const issue of broken) {
            const label =
              issue.reason === "anchor-not-found"
                ? "anchor not found"
                : "unresolved";
            printInfo(`    ${issue.reference} (${issue.source}: ${label})`);
          }
        }
      }

      return 0;
    }

    const broken = getBrokenLinks(graph);

    if (args.json ?? false) {
      writeJsonOutput({
        command: "notes links",
        count: broken.length,
        brokenLinks: broken,
      });
    } else {
      if (broken.length === 0) {
        printInfo("No broken links found in notes/");
      } else {
        printInfo("Broken links:\n");
        for (const issue of broken) {
          const label =
            issue.reason === "anchor-not-found"
              ? "anchor not found"
              : "unresolved";
          printInfo(
            `  [${issue.fromNoteId}] ${issue.fromTitle} -> ${issue.reference} (${label})`,
          );
        }
      }
    }

    return 0;
  }

  if (subcommand === "check") {
    const report = await checkNotesConsistency("notes", process.cwd());

    if (args.json ?? false) {
      writeJsonOutput({
        command: "notes check",
        ...report,
      });
    } else {
      printInfo("Notes consistency check:\n");
      printInfo(`  Total notes: ${report.totalNotes}`);

      if (report.duplicateIds.length > 0) {
        printWarning(`  Duplicate IDs: ${report.duplicateIds.length}`);
        for (const dup of report.duplicateIds) {
          printInfo(`    ${dup.id}:`);
          for (const file of dup.files) {
            printInfo(`      - ${file}`);
          }
        }
      }

      if (report.brokenLinks.length > 0) {
        printWarning(`  Broken links: ${report.brokenLinks.length}`);
        for (const issue of report.brokenLinks) {
          printInfo(
            `    [${issue.fromNoteId}] ${issue.fromTitle} -> ${issue.reference}`,
          );
        }
      }

      if (report.orphans.length > 0) {
        printWarning(`  Orphan notes: ${report.orphans.length}`);
        for (const orphan of report.orphans) {
          printInfo(`    [${orphan.id}] ${orphan.title}`);
        }
      }

      if (report.codePathWarnings.length > 0) {
        printWarning(
          `  Code path drift warnings: ${report.codePathWarnings.length}`,
        );
        for (const warning of report.codePathWarnings) {
          const detail =
            warning.status === "missing"
              ? "missing from repository"
              : "present on disk but outside the VCS master list";
          printInfo(
            `    [${warning.fromNoteId}] ${warning.fromTitle} -> ${warning.path} (${detail})`,
          );
        }
      }

      if (report.valid) {
        printSuccess("  ✓ All checks passed");
      } else {
        printInfo("");
        return 1;
      }
    }

    return report.valid ? 0 : 1;
  }

  if (subcommand === "coverage") {
    const coverage = await checkNoteCoverage("notes", process.cwd());

    if (args.json ?? false) {
      writeJsonOutput({
        command: "notes coverage",
        ...coverage,
      });
    } else {
      printInfo("Notes tool documentation coverage:\n");
      printInfo(
        `  ${coverage.documentedTools}/${coverage.totalTools} tools (${coverage.percentage}%)`,
      );

      if (coverage.undocumentedTools.length > 0) {
        printWarning("  Undocumented tools:");
        for (const tool of coverage.undocumentedTools) {
          printInfo(`    - ${tool}`);
        }
      } else {
        printSuccess("  ✓ All tools documented");
      }
    }

    return 0;
  }

  if (subcommand === "graph") {
    if (!args.id) {
      throw new CxError("--id is required for 'cx notes graph'", 2);
    }

    const depth =
      typeof args.depth === "number" && args.depth > 0 ? args.depth : 2;
    const graph = await buildNoteGraph("notes", process.cwd(), false);
    const note = graph.notes.get(args.id);

    if (!note) {
      throw new CxError(`Note not found: ${args.id}`, 2);
    }

    const reachable = getReachableNotes(graph, args.id, depth);

    if (args.json ?? false) {
      writeJsonOutput({
        command: "notes graph",
        id: args.id,
        title: note.title,
        depth,
        reachableCount: reachable.length,
        reachable,
      });
    } else {
      printInfo(
        `Reachable notes from "${note.title}" within ${depth} hop${depth === 1 ? "" : "s"}:\n`,
      );
      if (reachable.length === 0) {
        printInfo("  (no reachable notes)");
      } else {
        for (const item of reachable) {
          printInfo(`  hop ${item.depth}: [${item.noteId}] ${item.title}`);
        }
      }
    }

    return 0;
  }

  throw new CxError(
    `Unknown notes subcommand: ${subcommand}. Use 'new', 'rename', 'delete', 'list', 'backlinks', 'orphans', 'code-links', 'links', 'graph', 'check', or 'coverage'.`,
    2,
  );
}
