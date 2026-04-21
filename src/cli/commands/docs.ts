import {
  type CompileDocsFromBundleResult,
  compileDocsFromBundle,
} from "../../docs/compile.js";
import { CxError } from "../../shared/errors.js";
import {
  printInfo as basePrintInfo,
  printSuccess as basePrintSuccess,
} from "../../shared/format.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeValidatedJson,
} from "../../shared/output.js";
import { DocsCompileCommandJsonSchema } from "../jsonContracts.js";

export interface DocsArgs {
  subcommand?: string | undefined;
  workspaceRoot?: string | undefined;
  profile?: string | undefined;
  bundle?: string | undefined;
  format?: "markdown" | "xml" | "plain" | undefined;
  output?: string[] | undefined;
  config?: string | undefined;
  json?: boolean | undefined;
}

function validateCompileInputs(args: DocsArgs): void {
  if (args.profile === undefined && args.bundle === undefined) {
    throw new CxError(
      "Either --profile or --bundle is required for 'cx docs compile'.",
      2,
    );
  }

  if (args.profile !== undefined && args.bundle !== undefined) {
    throw new CxError(
      "Use either --profile or --bundle for 'cx docs compile', not both.",
      2,
    );
  }
}

function writeCompileJson(
  result: CompileDocsFromBundleResult,
  io: Partial<CommandIo>,
): void {
  writeValidatedJson(
    DocsCompileCommandJsonSchema,
    {
      command: "docs compile",
      profile: result.bundle.profile.name,
      bundlePath: result.bundlePath,
      documentKind: result.bundle.authoringContract.documentKind,
      targetPaths: result.bundle.profile.targetPaths,
      writtenFiles: result.writtenFiles,
      noteCount: result.bundle.notes.length,
      sectionCount: result.bundle.sections.length,
    },
    io,
  );
}

export async function runDocsCommand(
  args: DocsArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const printInfo = (message: string) => basePrintInfo(message, io);
  const printSuccess = (message: string) => basePrintSuccess(message, io);
  const workspaceRoot = args.workspaceRoot ?? io.cwd;
  const subcommand = args.subcommand ?? "compile";

  if (subcommand !== "compile") {
    throw new CxError(
      `Unsupported docs subcommand: ${subcommand}. Supported subcommands: compile.`,
      2,
    );
  }

  validateCompileInputs(args);

  const result = await compileDocsFromBundle({
    workspaceRoot,
    ...(args.bundle !== undefined ? { bundlePath: args.bundle } : {}),
    ...(args.profile !== undefined ? { profileName: args.profile } : {}),
    ...(args.format !== undefined ? { format: args.format } : {}),
    ...(args.output !== undefined ? { outputPaths: args.output } : {}),
    ...(args.config !== undefined ? { configPath: args.config } : {}),
  });

  if (args.json ?? false) {
    writeCompileJson(result, io);
    return 0;
  }

  printSuccess(`Compiled docs from bundle: ${result.bundlePath}`);
  printInfo(`  Profile: ${result.bundle.profile.name}`);
  printInfo(`  Document kind: ${result.bundle.authoringContract.documentKind}`);
  printInfo(`  Selected notes: ${result.bundle.notes.length}`);
  printInfo(`  Written files: ${result.writtenFiles.join(", ")}`);
  return 0;
}
