import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { setCLIOverrides } from "../config/env.js";
import { setAdapterPath } from "../repomix/capabilities.js";
import { asError, CxError } from "../shared/errors.js";
import { CX_VERSION } from "../shared/version.js";
import { runAdapterCommand } from "./commands/adapter.js";
import { runBundleCommand } from "./commands/bundle.js";
import { runConfigCommand } from "./commands/config.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runExtractCommand } from "./commands/extract.js";
import { runInitCommand } from "./commands/init.js";
import { runInspectCommand } from "./commands/inspect.js";
import { runListCommand } from "./commands/list.js";
import { runMcpCommand } from "./commands/mcp.js";
import { runNotesCommand } from "./commands/notes.js";
import { runRenderCommand } from "./commands/render.js";
import { runValidateCommand } from "./commands/validate.js";
import { runVerifyCommand } from "./commands/verify.js";

type ShellKind = "bash" | "zsh" | "fish";

function renderCompletionScript(shell: ShellKind): string {
  switch (shell) {
    case "bash":
      return `###-begin-cx-completions-###
#
# cx command completion script (bash)
#
_cx_yargs_completions() {
  local cur prev words cword
  _init_completion || return
  COMPREPLY=( $(COMP_CWORD="$cword" COMP_LINE="$COMP_LINE" COMP_POINT="$COMP_POINT" cx --get-yargs-completions "\${words[@]}") )
}
complete -o default -F _cx_yargs_completions cx
###-end-cx-completions-###
`;
    case "zsh":
      return `#compdef cx
###-begin-cx-completions-###
#
# cx command completion script (zsh)
#
_cx_yargs_completions() {
  local reply
  local si=$IFS
  IFS=$'\n' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" cx --get-yargs-completions "\${words[@]}"))
  IFS=$si
  if [[ \${#reply} -gt 0 ]]; then
    _describe 'values' reply
  else
    _default
  fi
}
compdef _cx_yargs_completions cx
###-end-cx-completions-###
`;
    case "fish":
      return `###-begin-cx-completions-###
#
# cx command completion script (fish)
#
function __fish_cx_complete
  set -lx COMP_LINE (commandline -cp)
  set -lx COMP_POINT (string length -- $COMP_LINE)
  set -lx COMP_CWORD (count (commandline -poc))
  cx --get-yargs-completions (commandline -poc)
end
complete -c cx -f -a '(__fish_cx_complete)'
###-end-cx-completions-###
`;
  }
}

export async function main(argv: string[]): Promise<number> {
  let exitCode = 0;

  const cli = yargs(hideBin(["node", "cx", ...argv]))
    .scriptName("cx")
    .usage("$0 <command> [options]")
    .option("adapter-path", {
      type: "string",
      description:
        "Path to a custom Repomix adapter module (overrides the default @wsmy/repomix-cx-fork).",
      global: true,
    })
    .option("strict", {
      type: "boolean",
      description:
        "Force all Category B behavioral settings to 'fail'. Overrides CX_* env vars and cx.toml values. Equivalent to CX_STRICT=true.",
      global: true,
      conflicts: "lenient",
    })
    .option("lenient", {
      type: "boolean",
      description:
        "Set all Category B behavioral settings to 'warn'. Overrides CX_* env vars and cx.toml values.",
      global: true,
      conflicts: "strict",
    })
    .middleware((args) => {
      if (typeof args["adapter-path"] === "string") {
        setAdapterPath(args["adapter-path"]);
      }

      if (args.strict === true) {
        setCLIOverrides({
          dedupMode: "fail",
          repomixMissingExtension: "fail",
          configDuplicateEntry: "fail",
        });
      } else if (args.lenient === true) {
        setCLIOverrides({
          dedupMode: "warn",
          repomixMissingExtension: "warn",
          configDuplicateEntry: "warn",
        });
      }
    })
    .strict()
    .strictCommands()
    .strictOptions()
    .help("help")
    .alias("help", "h")
    .version(CX_VERSION)
    .alias("version", "v")
    .showHelpOnFail(false)
    .recommendCommands()
    .wrap(null)
    .example("$0 init --stdout", "Print a starter cx.toml to stdout.")
    .example(
      "$0 bundle --config cx.toml",
      "Create a bundle from the current project.",
    )
    .example(
      "$0 extract dist/myproject-bundle --file src/index.ts --to /tmp/restore",
      "Restore one file from a bundle.",
    )
    .exitProcess(false)
    .fail((message, error) => {
      throw error ?? new CxError(message || "Command failed.");
    })
    .command(
      "completion",
      "Generate a shell completion script for bash, zsh, or fish.",
      (command) =>
        command.option("shell", {
          choices: ["bash", "zsh", "fish"] as const,
          default: "zsh",
        }),
      async (args) => {
        const shell = args.shell as ShellKind;
        process.stdout.write(renderCompletionScript(shell));
        exitCode = 0;
      },
    )
    .command(
      "init",
      "Create a starter cx.toml and scaffold repository notes.",
      (command) =>
        command
          .example(
            "$0 init --stdout",
            "Print a starter config without writing a file.",
          )
          .example(
            "$0 init --name demo --style json",
            "Customize the starter config and notes scaffolding.",
          )
          .option("force", { type: "boolean", default: false })
          .option("interactive", { type: "boolean", default: false })
          .option("json", { type: "boolean", default: false })
          .option("name", { type: "string" })
          .option("stdout", { type: "boolean", default: false })
          .option("style", {
            choices: ["xml", "markdown", "json", "plain"] as const,
          }),
      async (args) => {
        exitCode = await runInitCommand({
          force: args.force,
          interactive: args.interactive,
          json: args.json,
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
          .example(
            "$0 inspect --config cx.toml",
            "Show the current bundle plan.",
          )
          .option("config", { type: "string", default: "cx.toml" })
          .option("json", { type: "boolean", default: false })
          .option("token-breakdown", {
            type: "boolean",
            default: false,
            description: "Show per-section token distribution as a bar chart.",
          })
          .option("layout", {
            choices: ["flat", "deep"] as const,
            description:
              'Override assets.layout for this run ("flat" or "deep"). Takes precedence over CX_ASSETS_LAYOUT and cx.toml.',
          }),
      async (args) => {
        exitCode = await runInspectCommand({
          config: args.config,
          json: args.json,
          tokenBreakdown: args["token-breakdown"],
          layout: args.layout,
        });
      },
    )
    .command(
      "bundle",
      "Create a bundle directory from a project.",
      (command) =>
        command
          .example("$0 bundle --config cx.toml", "Build the configured bundle.")
          .example(
            "$0 bundle --config cx.toml --update",
            "Apply a differential update and prune orphaned bundle artifacts.",
          )
          .example(
            "$0 bundle --config cx.toml --force",
            "Bundle even when tracked files have uncommitted changes (records forced_dirty in the manifest).",
          )
          .option("config", { type: "string", default: "cx.toml" })
          .option("json", { type: "boolean", default: false })
          .option("update", {
            type: "boolean",
            default: false,
            description:
              "Build in a temporary staging directory, sync changed files, and prune orphaned artifacts safely.",
          })
          .option("force", {
            type: "boolean",
            default: false,
            description:
              "Override the unsafe-dirty safety check. Bundles tracked files with uncommitted changes and records the dirty state in the manifest.",
          })
          .option("layout", {
            choices: ["flat", "deep"] as const,
            description:
              'Override assets.layout for this run ("flat" or "deep"). Takes precedence over CX_ASSETS_LAYOUT and cx.toml.',
          }),
      async (args) => {
        exitCode = await runBundleCommand({
          config: args.config,
          json: args.json,
          layout: args.layout,
          update: args.update,
          force: args.force,
        });
      },
    )
    .command(
      "extract <bundleDir>",
      "Restore files from a bundle.",
      (command) =>
        command
          .example(
            "$0 extract dist/demo-bundle --file src/index.ts --to /tmp/restore",
            "Restore one file from a bundle.",
          )
          .positional("bundleDir", { type: "string", demandOption: true })
          .option("to", { type: "string", demandOption: true })
          .option("section", { type: "array", string: true })
          .option("file", { type: "array", string: true })
          .option("assets-only", { type: "boolean", default: false })
          .option("allow-degraded", { type: "boolean", default: false })
          .option("json", { type: "boolean", default: false })
          .option("overwrite", { type: "boolean", default: false })
          .option("verify", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runExtractCommand({
          bundleDir: args.bundleDir,
          destinationDir: args.to,
          sections: args.section as string[] | undefined,
          files: args.file as string[] | undefined,
          assetsOnly: args["assets-only"],
          allowDegraded: args["allow-degraded"],
          json: args.json,
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
          .example(
            "$0 list dist/demo-bundle",
            "List bundle contents grouped by section.",
          )
          .positional("bundleDir", { type: "string", demandOption: true })
          .option("section", { type: "array", string: true })
          .option("file", { type: "array", string: true })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runListCommand({
          bundleDir: args.bundleDir,
          files: args.file as string[] | undefined,
          json: args.json,
          sections: args.section as string[] | undefined,
        });
      },
    )
    .command(
      "validate <bundleDir>",
      "Validate bundle structure and schema.",
      (command) =>
        command
          .example(
            "$0 validate dist/demo-bundle",
            "Validate a bundle directory.",
          )
          .positional("bundleDir", { type: "string", demandOption: true })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runValidateCommand({
          bundleDir: args.bundleDir,
          json: args.json,
        });
      },
    )
    .command(
      "verify <bundleDir>",
      "Verify bundle integrity.",
      (command) =>
        command
          .example(
            "$0 verify dist/demo-bundle --against .",
            "Verify a bundle against its source tree.",
          )
          .positional("bundleDir", { type: "string", demandOption: true })
          .option("json", { type: "boolean", default: false })
          .option("section", { type: "array", string: true })
          .option("file", { type: "array", string: true })
          .option("against", { type: "string" })
          .option("config", {
            type: "string",
            default: "cx.toml",
            description: "Path to cx.toml for lock drift comparison.",
          }),
      async (args) => {
        exitCode = await runVerifyCommand({
          bundleDir: args.bundleDir,
          againstDir: args.against,
          files: args.file as string[] | undefined,
          json: args.json,
          sections: args.section as string[] | undefined,
          config: args.config,
        });
      },
    )
    .command(
      "doctor [subcommand]",
      "Diagnose overlaps, MCP inheritance, and secret hygiene.",
      (command) =>
        command
          .example(
            "$0 doctor overlaps --config cx.toml",
            "Show section overlap diagnostics.",
          )
          .example(
            "$0 doctor fix-overlaps --dry-run",
            "Preview exact exclude updates without writing cx.toml.",
          )
          .example(
            "$0 doctor mcp --config cx.toml",
            "Show the effective MCP profile and inherited file scopes.",
          )
          .example(
            "$0 doctor secrets --config cx.toml",
            "Scan the master list for suspicious secrets.",
          )
          .example(
            "$0 doctor --all --config cx.toml",
            "Run overlaps, MCP inheritance, and secret diagnostics in order.",
          )
          .positional("subcommand", {
            type: "string",
            choices: ["overlaps", "fix-overlaps", "mcp", "secrets"],
            demandOption: false,
          })
          .option("config", { type: "string", default: "cx.toml" })
          .option("all", {
            type: "boolean",
            default: false,
            description:
              "Run overlaps, MCP inheritance, and secret diagnostics in sequence.",
          })
          .option("dry-run", { type: "boolean", default: false })
          .option("interactive", { type: "boolean", default: false })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runDoctorCommand({
          config: args.config,
          subcommand: args.subcommand as
            | "overlaps"
            | "fix-overlaps"
            | "mcp"
            | "secrets"
            | undefined,
          all: args.all,
          dryRun: args["dry-run"],
          interactive: args.interactive,
          json: args.json,
        });
      },
    )
    .command(
      "render",
      "Render planned sections as standard Repomix output.",
      (command) =>
        command
          .example(
            "$0 render --section src --stdout",
            "Render one section to stdout.",
          )
          .option("config", { type: "string", default: "cx.toml" })
          .option("section", { type: "array", string: true })
          .option("file", { type: "array", string: true })
          .option("all-sections", { type: "boolean", default: false })
          .option("style", {
            choices: ["xml", "markdown", "json", "plain"] as const,
          })
          .option("stdout", { type: "boolean", default: false })
          .option("output-dir", { type: "string" })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runRenderCommand({
          config: args.config,
          sections: args.section as string[] | undefined,
          files: args.file as string[] | undefined,
          allSections: args["all-sections"],
          style: args.style,
          stdout: args.stdout,
          outputDir: args["output-dir"],
          json: args.json,
        });
      },
    )
    .command(
      "config <subcommand>",
      "Inspect effective configuration.",
      (command) =>
        command
          .example(
            "$0 config show-effective",
            "Show all Category B behavioral settings with their resolved values and sources.",
          )
          .example(
            "$0 config show-effective --json",
            "Output effective settings as JSON.",
          )
          .positional("subcommand", {
            type: "string",
            choices: ["show-effective"] as const,
            demandOption: true,
          })
          .option("config", { type: "string", default: "cx.toml" })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runConfigCommand({
          config: args.config,
          json: args.json,
        });
      },
    )
    .command(
      "adapter <subcommand>",
      "Inspect Repomix adapter capabilities and runtime state.",
      (command) =>
        command
          .example(
            "$0 adapter capabilities",
            "Show adapter and Repomix runtime info.",
          )
          .positional("subcommand", {
            type: "string",
            choices: ["capabilities", "inspect", "doctor"],
            demandOption: true,
          })
          .option("config", { type: "string", default: "cx.toml" })
          .option("section", { type: "array", string: true })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runAdapterCommand({
          config: args.config,
          subcommand: args.subcommand as "capabilities" | "inspect" | "doctor",
          sections: args.section as string[] | undefined,
          json: args.json,
        });
      },
    )
    .command(
      "notes [subcommand]",
      "Manage Zettelkasten notes.",
      (command) =>
        command
          .example("$0 notes list", "List all notes in the notes/ directory.")
          .example(
            "$0 notes new --title 'My Topic'",
            "Create a new note with an auto-generated ID.",
          )
          .example(
            "$0 notes new --title 'My Topic' --tags design --tags architecture",
            "Create a note with tags.",
          )
          .example(
            "$0 notes backlinks --id 20250113143015",
            "Show all notes that link to the given note.",
          )
          .example(
            "$0 notes orphans",
            "List notes with no incoming or outgoing links.",
          )
          .example(
            "$0 notes code-links --id 20250113143015",
            "Show code files that reference the given note.",
          )
          .example(
            "$0 notes links",
            "Audit unresolved note and code references across the notes graph.",
          )
          .positional("subcommand", {
            type: "string",
            choices: [
              "new",
              "list",
              "backlinks",
              "orphans",
              "code-links",
              "links",
            ],
            default: "list",
          })
          .option("title", {
            type: "string",
            description:
              "Title for the new note (required for 'new' subcommand).",
          })
          .option("tags", {
            type: "array",
            string: true,
            description: "Tags to assign to the note.",
          })
          .option("id", {
            type: "string",
            description:
              "Note ID (required for 'backlinks', 'code-links', and 'links' subcommands).",
          })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runNotesCommand({
          subcommand: args.subcommand as string | undefined,
          title: args.title as string | undefined,
          tags: args.tags as string[] | undefined,
          id: args.id as string | undefined,
          json: args.json,
        });
      },
    );

  cli.command(
    "mcp",
    "Start the CX MCP server.",
    (command) =>
      command.example(
        "$0 mcp",
        "Start the MCP server using cx-mcp.toml when available, otherwise cx.toml.",
      ),
    async () => {
      exitCode = await runMcpCommand();
    },
  );

  if (
    argv.length === 0 ||
    (argv.length === 1 && (argv[0] === "-h" || argv[0] === "--help"))
  ) {
    process.stdout.write(`${await cli.getHelp()}\n`);
    return 0;
  }

  if (argv.length === 1 && (argv[0] === "-v" || argv[0] === "--version")) {
    process.stdout.write(`${CX_VERSION}\n`);
    return 0;
  }

  await cli.parseAsync();

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
