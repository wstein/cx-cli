import path from "node:path";
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
import { compileNotesExtractBundle } from "../../../notes/extract.js";
import {
  buildNoteGraph,
  buildUnifiedNoteGraph,
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
  writeValidatedJson,
} from "../../../shared/output.js";
import { NotesExtractCommandJsonSchema } from "../../jsonContracts.js";

export interface NotesArgs {
  subcommand?: string | undefined;
  query?: string | undefined;
  body?: string | undefined;
  title?: string | undefined;
  tags?: string[] | undefined;
  id?: string | undefined;
  depth?: number | undefined;
  json?: boolean | undefined;
  workspaceRoot?: string | undefined;
  profile?: string | undefined;
  format?: "markdown" | "xml" | "json" | "plain" | undefined;
  output?: string | undefined;
  config?: string | undefined;
}
export async function runNotesCommand(
  args: NotesArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const workspaceRoot = args.workspaceRoot ?? io.cwd;
  const notesDir = path.join(workspaceRoot, "notes");
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
      notesDir,
      workspaceRoot,
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

    const note = await readNote(args.id, {
      notesDir,
      workspaceRoot,
    });

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

  if (subcommand === "extract") {
    if (!args.profile) {
      throw new CxError("--profile is required for 'cx notes extract'", 2);
    }

    const result = await compileNotesExtractBundle({
      workspaceRoot,
      profileName: args.profile,
      ...(args.format !== undefined ? { format: args.format } : {}),
      ...(args.output !== undefined ? { outputPath: args.output } : {}),
      ...(args.config !== undefined ? { configPath: args.config } : {}),
    });

    if (args.json ?? false) {
      writeValidatedJson(
        NotesExtractCommandJsonSchema,
        {
          profile: result.bundle.profile.name,
          description: result.bundle.profile.description,
          format: result.format,
          outputPath: result.outputPath,
          targetPaths: result.bundle.profile.targetPaths,
          selectedNoteCount: result.bundle.notes.length,
          sectionCount: result.bundle.sections.length,
          sections: result.bundle.sections.map((section) => ({
            id: section.id,
            title: section.title,
            noteCount: section.noteCount,
          })),
        },
        io,
      );
    } else {
      if (result.outputPath === null) {
        writeStdout(result.content, io);
      } else {
        printSuccess(`Extracted notes bundle: ${result.outputPath}`);
        printInfo(`  Profile: ${result.bundle.profile.name}`);
        printInfo(`  Format: ${result.format}`);
        printInfo(`  Selected notes: ${result.bundle.notes.length}`);
        printInfo(`  Required sections: ${result.bundle.sections.length}`);
        printInfo(
          `  Target paths: ${result.bundle.profile.targetPaths.join(", ")}`,
        );
      }
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
      notesDir,
      workspaceRoot,
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

    const note = await renameNote(args.id, args.title, {
      notesDir,
      workspaceRoot,
    });

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

    const note = await deleteNote(args.id, {
      notesDir,
      workspaceRoot,
    });

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
    const notes = await listNotes(notesDir, { workspaceRoot });

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

    const graph = await buildNoteGraph(notesDir, workspaceRoot);
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
    const graph = await buildNoteGraph(notesDir, workspaceRoot);
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

    const graph = await buildNoteGraph(notesDir, workspaceRoot);
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
    const graph = await buildNoteGraph(notesDir, workspaceRoot);

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
    const report = await checkNotesConsistency(notesDir, workspaceRoot);

    if (args.json ?? false) {
      writeJsonOutput({
        command: "notes check",
        ...report,
      });
    } else {
      printInfo("Notes consistency check:\n");
      printInfo(`  Total notes: ${report.totalNotes}`);
      printInfo(
        `  Cognition score: avg ${report.cognition.averageScore} (high-signal ${report.cognition.highSignalCount}, review ${report.cognition.reviewCount}, low-signal ${report.cognition.lowSignalCount})`,
      );
      printInfo(
        `  Trust model: source=${report.trustModel.sourceTree}, notes=${report.trustModel.notes}, agent=${report.trustModel.agentOutput}, bundle=${report.trustModel.bundle}`,
      );
      printInfo(
        `  Staleness: avg-age ${report.staleness.averageAgeDays}d (fresh ${report.staleness.freshCount}, aging ${report.staleness.agingCount}, stale ${report.staleness.staleCount}, drift-pressured ${report.staleness.driftPressuredCount})`,
      );
      printInfo(
        `  Contradictions: ${report.contradictions.count} (code-state ${report.contradictions.codeStateConflictCount}, sibling ${report.contradictions.siblingConflictCount})`,
      );

      if (report.validationErrors.length > 0) {
        printWarning(`  Validation errors: ${report.validationErrors.length}`);
        for (const issue of report.validationErrors) {
          printInfo(`    ${issue.filePath}: ${issue.error}`);
        }
      }

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

      if (report.lowSignalNotes.length > 0) {
        printWarning(`  Low-signal notes: ${report.lowSignalNotes.length}`);
        for (const note of report.lowSignalNotes) {
          printInfo(
            `    [${note.id}] ${note.title} (score ${note.score}, ${note.label}, trust ${note.trustLevel}, age ${note.ageDays}d, ${note.stalenessLabel}, drift warnings ${note.driftWarningCount}, contradictions ${note.contradictionCount})`,
          );
        }
      }

      if (report.contradictionIssues.length > 0) {
        printWarning(
          `  Contradiction issues: ${report.contradictionIssues.length}`,
        );
        for (const issue of report.contradictionIssues) {
          const counterpart =
            issue.conflictingNoteId === undefined
              ? ""
              : ` vs [${issue.conflictingNoteId}] ${issue.conflictingNoteTitle ?? "Unknown"}`;
          printInfo(
            `    [${issue.noteId}] ${issue.noteTitle} -> ${issue.subject} (${issue.kind})${counterpart}`,
          );
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

      if (report.currentFeatureWarnings.length > 0) {
        printWarning(
          `  Current-note feature warnings: ${report.currentFeatureWarnings.length}`,
        );
        for (const warning of report.currentFeatureWarnings) {
          printInfo(
            `    [${warning.noteId}] ${warning.noteTitle} -> ${warning.reference} (${warning.reason})`,
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

  if (subcommand === "drift") {
    const report = await checkNotesConsistency(notesDir, workspaceRoot);
    const drift = {
      command: "notes drift",
      valid:
        report.validationErrors.length === 0 &&
        report.codePathWarnings.length === 0 &&
        report.currentFeatureWarnings.length === 0,
      validationErrors: report.validationErrors,
      codePathWarnings: report.codePathWarnings,
      currentFeatureWarnings: report.currentFeatureWarnings,
      evaluatedNotes: report.evaluatedNotes.filter(
        (note) => note.driftWarningCount > 0,
      ),
    };

    if (args.json ?? args.format === "json") {
      writeJsonOutput(drift);
    } else {
      printInfo("Notes drift check:\n");
      printInfo(`  Validation errors: ${drift.validationErrors.length}`);
      printInfo(`  Code path warnings: ${drift.codePathWarnings.length}`);
      printInfo(
        `  Current-note warnings: ${drift.currentFeatureWarnings.length}`,
      );
      if (drift.valid) {
        printSuccess("  ✓ No note drift detected");
      }
    }

    return drift.valid ? 0 : 1;
  }

  if (subcommand === "coverage") {
    const coverage = await checkNoteCoverage(notesDir, workspaceRoot);

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
    if (args.format === "json" && !args.id) {
      const graph = await buildUnifiedNoteGraph(notesDir, workspaceRoot, true);
      writeJsonOutput({
        command: "notes graph",
        format: "json",
        ...graph,
      });
      return 0;
    }

    if (!args.id) {
      throw new CxError(
        "--id is required for 'cx notes graph' unless --format json is used",
        2,
      );
    }

    const depth =
      typeof args.depth === "number" && args.depth > 0 ? args.depth : 2;
    const graph = await buildNoteGraph(notesDir, workspaceRoot, false);
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

  if (subcommand === "trace") {
    const requestedId = args.id ?? args.query;
    if (!requestedId) {
      throw new CxError("--id is required for 'cx notes trace'", 2);
    }

    const graph = await buildNoteGraph(notesDir, workspaceRoot, true);
    const note = graph.notes.get(requestedId);
    if (!note) {
      throw new CxError(`Note not found: ${requestedId}`, 2);
    }

    const outgoing = getOutgoingLinks(graph, requestedId);
    const backlinks = getBacklinks(graph, requestedId);
    const codeFiles = getCodeReferences(graph, requestedId);
    const claims = note.claims ?? [];
    const specRefs = claims
      .flatMap((claim) => (claim.specRef === undefined ? [] : [claim.specRef]))
      .sort((left, right) => left.localeCompare(right, "en"));
    const claimCodeRefs = claims
      .flatMap((claim) => claim.codeRefs)
      .sort((left, right) => left.localeCompare(right, "en"));
    const testRefs = claims
      .flatMap((claim) => claim.testRefs)
      .sort((left, right) => left.localeCompare(right, "en"));
    const docRefs = claims
      .flatMap((claim) => claim.docRefs)
      .sort((left, right) => left.localeCompare(right, "en"));

    const payload = {
      command: "notes trace",
      note: {
        id: note.id,
        title: note.title,
        target: note.target,
        kind: note.kind,
        path: path
          .relative(workspaceRoot, note.filePath)
          .replaceAll(path.sep, "/"),
        summary: note.summary,
        tags: note.tags,
        aliases: note.aliases,
        supersedes: note.supersedes ?? [],
        claims,
      },
      linkedNotes: outgoing,
      linkedSpecSections: specRefs,
      linkedCodeFiles: [...new Set([...codeFiles, ...claimCodeRefs])],
      linkedTests: [...new Set(testRefs)],
      linkedDocs: [...new Set(docRefs)],
      reverseBacklinks: backlinks,
      unresolvedRefs: getBrokenLinks(graph, requestedId),
    };

    if (args.json ?? args.format === "json") {
      writeJsonOutput(payload);
    } else {
      printInfo(`Trace for "${note.title}" (${note.id}):\n`);
      printInfo(`  Path: ${payload.note.path}`);
      printInfo(`  Target: ${note.target}`);
      if (note.kind !== undefined) {
        printInfo(`  Kind: ${note.kind}`);
      }
      printInfo(`  Summary: ${note.summary}`);
      printInfo(`  Linked notes: ${outgoing.length}`);
      for (const link of outgoing)
        printInfo(`    [${link.toNoteId}] ${link.title}`);
      printInfo(`  Specs: ${specRefs.length}`);
      for (const ref of specRefs) printInfo(`    ${ref}`);
      printInfo(`  Code files: ${payload.linkedCodeFiles.length}`);
      for (const ref of payload.linkedCodeFiles) printInfo(`    ${ref}`);
      printInfo(`  Tests: ${payload.linkedTests.length}`);
      for (const ref of payload.linkedTests) printInfo(`    ${ref}`);
      printInfo(`  Docs: ${payload.linkedDocs.length}`);
      for (const ref of payload.linkedDocs) printInfo(`    ${ref}`);
      printInfo(`  Backlinks: ${backlinks.length}`);
      for (const link of backlinks)
        printInfo(`    [${link.fromNoteId}] ${link.title}`);
    }

    return 0;
  }

  if (subcommand === "ask") {
    const question = args.query ?? args.body;
    if (!question) {
      throw new CxError(
        "Question is required for 'cx notes ask \"<question>\"'",
        2,
      );
    }

    const graph = await buildNoteGraph(notesDir, workspaceRoot, true);
    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9-]+/u)
      .filter((term) => term.length >= 3);
    const matches = [...graph.notes.values()]
      .map((note) => {
        const haystack =
          `${note.title} ${note.summary} ${(note.tags ?? []).join(" ")}`.toLowerCase();
        const score = terms.reduce(
          (sum, term) => sum + (haystack.includes(term) ? 1 : 0),
          0,
        );
        return { note, score };
      })
      .filter((entry) => entry.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.note.title.localeCompare(right.note.title, "en"),
      )
      .slice(0, 10);

    const matchedNotes = matches.map(({ note, score }) => ({
      id: note.id,
      title: note.title,
      path: path
        .relative(workspaceRoot, note.filePath)
        .replaceAll(path.sep, "/"),
      summary: note.summary,
      score,
    }));
    const matchedCode = [
      ...new Set(
        matches.flatMap(({ note }) => getCodeReferences(graph, note.id)),
      ),
    ].sort((left, right) => left.localeCompare(right, "en"));
    const confidence =
      matchedNotes.length === 0
        ? "low"
        : matchedNotes.length < 3
          ? "medium"
          : "high";
    const payload = {
      command: "notes ask",
      question,
      matchedNotes,
      matchedSpecs: [],
      matchedCode,
      matchedTests: [],
      matchedDocs: [],
      confidence,
      unresolvedGaps:
        matchedNotes.length === 0
          ? ["No note summaries or tags matched the question."]
          : [],
      answerScaffold:
        matchedNotes.length === 0
          ? "No answer scaffold is available without note evidence."
          : "Use the matched notes as intent evidence, then verify linked code/tests/docs before writing a final answer.",
    };

    if (args.json ?? args.format === "json") {
      writeJsonOutput(payload);
    } else {
      printInfo(`# Evidence for: ${question}\n`);
      printInfo(`Confidence: ${confidence}`);
      printInfo("Matched notes:");
      for (const note of matchedNotes) {
        printInfo(`  [${note.id}] ${note.title} (${note.path})`);
      }
      printInfo("Matched code/tests/docs:");
      for (const codeFile of matchedCode) printInfo(`  code: ${codeFile}`);
      if (payload.unresolvedGaps.length > 0) {
        printWarning("Unresolved gaps:");
        for (const gap of payload.unresolvedGaps) printInfo(`  - ${gap}`);
      }
      printInfo("");
      printInfo(payload.answerScaffold);
    }

    return 0;
  }

  throw new CxError(
    `Unknown notes subcommand: ${subcommand}. Use 'new', 'rename', 'delete', 'list', 'backlinks', 'orphans', 'code-links', 'links', 'graph', 'trace', 'ask', 'check', 'drift', 'coverage', or 'extract'.`,
    2,
  );
}
