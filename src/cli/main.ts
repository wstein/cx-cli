import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { asError, CxError } from "../shared/errors.js";
import { runBundleCommand } from "./commands/bundle.js";
import { runExtractCommand } from "./commands/extract.js";
import { runInitCommand } from "./commands/init.js";
import { runInspectCommand } from "./commands/inspect.js";
import { runListCommand } from "./commands/list.js";
import { runValidateCommand } from "./commands/validate.js";
import { runVerifyCommand } from "./commands/verify.js";

export async function main(argv: string[]): Promise<number> {
  let exitCode = 0;

  await yargs(hideBin(["node", "cx", ...argv]))
    .scriptName("cx")
    .strict()
    .help()
    .exitProcess(false)
    .fail((message, error) => {
      throw error ?? new CxError(message || "Command failed.");
    })
    .command(
      "init",
      "Create a starter cx.toml.",
      (command) =>
        command
          .option("force", { type: "boolean", default: false })
          .option("interactive", { type: "boolean", default: false })
          .option("name", { type: "string" })
          .option("stdout", { type: "boolean", default: false })
          .option("style", {
            choices: ["xml", "markdown", "json", "plain"] as const,
          }),
      async (args) => {
        exitCode = await runInitCommand({
          force: args.force,
          interactive: args.interactive,
          name: args.name,
          stdout: args.stdout,
          style: args.style,
        });
      },
    )
    .command(
      "inspect",
      "Show the computed plan without writing files.",
      (command) =>
        command
          .option("config", { type: "string", default: "cx.toml" })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runInspectCommand({
          config: args.config,
          json: args.json,
        });
      },
    )
    .command(
      "bundle",
      "Create a bundle directory from a project.",
      (command) =>
        command.option("config", { type: "string", default: "cx.toml" }),
      async (args) => {
        exitCode = await runBundleCommand({ config: args.config });
      },
    )
    .command(
      "extract <bundleDir>",
      "Restore files from a bundle.",
      (command) =>
        command
          .positional("bundleDir", { type: "string", demandOption: true })
          .option("to", { type: "string", demandOption: true })
          .option("section", { type: "array", string: true })
          .option("file", { type: "array", string: true })
          .option("assets-only", { type: "boolean", default: false })
          .option("overwrite", { type: "boolean", default: false })
          .option("verify", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runExtractCommand({
          bundleDir: args.bundleDir,
          destinationDir: args.to,
          sections: args.section as string[] | undefined,
          files: args.file as string[] | undefined,
          assetsOnly: args["assets-only"],
          overwrite: args.overwrite,
          verify: args.verify,
        });
      },
    )
    .command(
      "list <bundleDir>",
      "List bundle contents.",
      (command) =>
        command
          .positional("bundleDir", { type: "string", demandOption: true })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runListCommand({
          bundleDir: args.bundleDir,
          json: args.json,
        });
      },
    )
    .command(
      "validate <bundleDir>",
      "Validate bundle structure and schema.",
      (command) =>
        command.positional("bundleDir", { type: "string", demandOption: true }),
      async (args) => {
        exitCode = await runValidateCommand({ bundleDir: args.bundleDir });
      },
    )
    .command(
      "verify <bundleDir>",
      "Verify bundle integrity.",
      (command) =>
        command
          .positional("bundleDir", { type: "string", demandOption: true })
          .option("against", { type: "string" }),
      async (args) => {
        exitCode = await runVerifyCommand({
          bundleDir: args.bundleDir,
          againstDir: args.against,
        });
      },
    )
    .demandCommand(1)
    .parseAsync();

  return exitCode;
}

if (import.meta.main) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const resolved = asError(error);
      process.stderr.write(`${resolved.message}\n`);
      process.exitCode = resolved instanceof CxError ? resolved.exitCode : 1;
    });
}
