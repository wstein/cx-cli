import path from "node:path";
import {
  loadManifestFromBundle,
  validateBundle,
} from "../../bundle/validate.js";
import { validateNotes } from "../../notes/validate.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
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
  const bundleDir = path.resolve(args.bundleDir);
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

    throw new CxError("Note validation failed", 10);
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
        repomix: await getRepomixCapabilities(),
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
