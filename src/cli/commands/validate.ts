import path from "node:path";
import { getAdapterCapabilities } from "../../adapter/capabilities.js";
import {
  loadManifestFromBundle,
  validateBundle,
} from "../../bundle/validate.js";
import { validateNotes } from "../../notes/validate.js";
import { CxError } from "../../shared/errors.js";
import { printError, printInfo, printWarning } from "../../shared/format.js";
import { summarizeManifest } from "../../shared/manifestSummary.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeValidatedJson,
} from "../../shared/output.js";
import { ValidateCommandJsonSchema } from "../jsonContracts.js";

export interface ValidateArgs {
  bundleDir: string;
  json?: boolean | undefined;
}

export async function runValidateCommand(
  args: ValidateArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const bundleDir = path.resolve(io.cwd, args.bundleDir);
  const { manifestName } = await validateBundle(bundleDir);

  // Validate notes in the source directory
  const sourceRoot = path.dirname(bundleDir);
  const notesResult = await validateNotes("notes", sourceRoot);

  if (!notesResult.valid) {
    if (notesResult.errors.length > 0) {
      printWarning("Note validation errors:", io);
      for (const error of notesResult.errors) {
        printError(`  ${error.filePath}: ${error.error}`, io);
      }
    }

    if (notesResult.duplicateIds.length > 0) {
      printWarning("Duplicate note IDs detected:", io);
      for (const { id, files } of notesResult.duplicateIds) {
        printError(`  ID ${id}: ${files.join(", ")}`, io);
      }
    }

    throw new CxError("Note validation failed", 10, {
      remediation: {
        docsRef: "docs/NOTES_MODULE_SPEC.md",
        whyThisProtectsYou:
          "The notes graph is the repository cognition layer. Validation stops when durable knowledge loses summary quality, atomicity, or identifier integrity.",
        nextSteps: [
          "Fix the reported note validation errors or duplicate IDs.",
          "Run `cx notes check` so the full governance report is visible before validating again.",
        ],
      },
    });
  }

  if (args.json ?? false) {
    const { manifest } = await loadManifestFromBundle(bundleDir);
    writeValidatedJson(
      ValidateCommandJsonSchema,
      {
        bundleDir,
        summary: summarizeManifest(manifestName, manifest),
        checksumFile: manifest.checksumFile,
        sourceRoot: manifest.sourceRoot,
        bundleVersion: manifest.bundleVersion,
        schemaVersion: manifest.schemaVersion,
        repomix: await getAdapterCapabilities(),
        valid: true,
        notes: {
          count: notesResult.notes.length,
          valid: notesResult.valid,
        },
      },
      io,
    );
  } else if (notesResult.notes.length > 0) {
    printInfo(
      `Note validation passed: ${notesResult.notes.length} notes found`,
      io,
    );
  }

  return 0;
}
