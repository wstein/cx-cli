import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { setOracleAdapterPath } from "../adapter/capabilities.js";
import { setCLIOverrides } from "../config/env.js";
import { asError, CxError, formatErrorRemediation } from "../shared/errors.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeStderr,
  writeStdout,
} from "../shared/output.js";
import { CX_DISPLAY_VERSION } from "../shared/version.js";
import { runAdapterCommand } from "./commands/adapter.js";
import { runAuditCommand } from "./commands/audit.js";
import { runBundleCommand } from "./commands/bundle.js";
import { runConfigCommand } from "./commands/config.js";
import { runDocsCommand } from "./commands/docs.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runExtractCommand } from "./commands/extract.js";
import { runInitCommand } from "./commands/init.js";
import { runInspectCommand } from "./commands/inspect.js";
import { runListCommand } from "./commands/list.js";
import { runMcpCatalogCommand, runMcpCommand } from "./commands/mcp.js";
import { runNotesCommand } from "./commands/notes.js";
import { runRenderCommand } from "./commands/render.js";
import { runValidateCommand } from "./commands/validate.js";
import { runVerifyCommand } from "./commands/verify.js";
import { renderCompletionScript } from "./completion.js";

type ShellKind = "bash" | "zsh" | "fish";

function getInstallTarget(shell: ShellKind) {
  const home = homedir();
  switch (shell) {
    case "bash":
      return {
        path: join(home, ".bashrc"),
        snippet:
          "\n# cx shell completion\nsource <(cx completion --shell=bash)\n",
      };
    case "zsh":
      return {
        path: join(home, ".zshrc"),
        snippet:
          "\n# cx shell completion\nsource <(cx completion --shell=zsh)\n",
      };
    case "fish":
      return {
        path: join(home, ".config/fish/config.fish"),
        snippet:
          "\n# cx shell completion\ncx completion --shell=fish | source\n",
      };
  }
}

function normalizeArrayArg(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  return [String(value)];
}

function resolveCliPath(
  value: string | undefined,
  cwd: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return resolvePath(cwd, value);
}

function writeStdoutSafe(
  data: string,
  io: Partial<CommandIo> = {},
): Promise<void> {
  const resolvedIo = resolveCommandIo(io);
  if (resolvedIo.stdout !== process.stdout) {
    resolvedIo.stdout.write(data);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === "EPIPE") {
        resolve();
      } else {
        reject(error);
      }
    };

    process.stdout.once("error", onError);
    const callback = (err?: Error | null) => {
      process.stdout.off("error", onError);
      if (err) {
        const errWithCode = err as NodeJS.ErrnoException;
        if (errWithCode.code === "EPIPE") {
          resolve();
        } else {
          reject(err);
        }
      } else {
        resolve();
      }
    };

    const writeResult = process.stdout.write(data, callback);
    if (!writeResult) {
      process.stdout.once("drain", () => {
        /* allow buffer to clear */
      });
    }
  });
}

export async function main(
  argv: string[],
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  let exitCode = 0;

  const cli = yargs(hideBin(["node", "cx", ...argv]))
    .scriptName("cx")
    .usage("$0 <command> [options]")
    .option("adapter-path", {
      type: "string",
      description:
        "Path to a custom adapter oracle module (overrides the default repomix reference oracle when installed).",
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
        setOracleAdapterPath(args["adapter-path"]);
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
    .version(CX_DISPLAY_VERSION)
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
        command
          .option("shell", {
            choices: ["bash", "zsh", "fish"] as const,
            default: "zsh",
          })
          .option("install", {
            type: "boolean",
            default: false,
            description:
              "Install a dynamic loader into the shell config instead of printing the script.",
          }),
      async (args) => {
        const shell = args.shell as ShellKind;
        if (args.install === true) {
          const target = getInstallTarget(shell);
          const dir = dirname(target.path);
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }

          const current = existsSync(target.path)
            ? readFileSync(target.path, "utf8")
            : "";
          if (current.includes(target.snippet.trim())) {
            await writeStdoutSafe(
              `cx completion is already installed in ${target.path}\n`,
              io,
            );
          } else {
            appendFileSync(target.path, target.snippet);
            await writeStdoutSafe(
              `Installed cx completion dynamic loader in ${target.path}\n`,
              io,
            );
          }
          exitCode = 0;
        } else {
          await writeStdoutSafe(renderCompletionScript(shell), io);
          exitCode = 0;
        }
      },
    )
    .command(
      "audit [subcommand]",
      "Summarize recent MCP audit trends without reading raw JSONL.",
      (command) =>
        command
          .example(
            "$0 audit summary --json",
            "Show recent trace IDs, policy trends, and capability totals.",
          )
          .positional("subcommand", {
            type: "string",
            choices: ["summary"],
            default: "summary",
          })
          .option("config", {
            type: "string",
            default: "cx.toml",
            description:
              "Resolve the workspace root from this config before reading .cx/audit.log.",
          })
          .option("workspace-root", {
            type: "string",
            description:
              "Override the workspace root directly instead of resolving it from cx.toml.",
          })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        exitCode = await runAuditCommand(
          {
            subcommand: args.subcommand as "summary",
            config: resolveCliPath(args.config, io.cwd) ?? "cx.toml",
            workspaceRoot: resolveCliPath(args["workspace-root"], io.cwd),
            json: args.json,
          },
          io,
        );
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
          })
          .option("template", {
            type: "string",
            description:
              "Explicit init template name to use, e.g. base, rust, go, typescript, python, java, elixir, julia, crystal.",
          })
          .option("template-list", {
            type: "boolean",
            default: false,
            description: "Show supported init templates and exit.",
          }),
      async (args) => {
        exitCode = await runInitCommand(
          {
            force: args.force,
            interactive: args.interactive,
            json: args.json,
            name: args.name,
            stdout: args.stdout,
            style: args.style,
            template: args.template,
            templateList: args["template-list"],
          },
          io,
        );
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
          config: resolveCliPath(args.config, io.cwd) ?? "cx.toml",
          json: args.json,
          tokenBreakdown: args["token-breakdown"],
          layout: args.layout,
        });
      },
    )
    .command(
      "bundle",
      "Create an immutable bundle snapshot from a project.",
      (command) =>
        command
          .example(
            "$0 bundle --config cx.toml",
            "Build a verified snapshot from the configured project.",
          )
          .example(
            "$0 bundle --config cx.toml --update",
            "Apply a differential update and prune orphaned bundle artifacts.",
          )
          .example(
            "$0 bundle --config cx.toml --force",
            "Bundle even when tracked files have uncommitted changes (records forced_dirty in the manifest).",
          )
          .example(
            "$0 bundle --config cx.toml --ci",
            "Pipeline mode: bypass unsafe-dirty check and record ci_dirty in the manifest.",
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
              "Override the unsafe-dirty safety check for local development. Records forced_dirty in the manifest.",
          })
          .option("ci", {
            type: "boolean",
            default: false,
            description:
              "CI/automation mode: bypass the unsafe-dirty check and record ci_dirty in the manifest. Use instead of --force in automated pipelines.",
          })
          .option("layout", {
            choices: ["flat", "deep"] as const,
            description:
              'Override assets.layout for this run ("flat" or "deep"). Takes precedence over CX_ASSETS_LAYOUT and cx.toml.',
          }),
      async (args) => {
        exitCode = await runBundleCommand(
          {
            config: resolveCliPath(args.config, io.cwd) ?? "cx.toml",
            json: args.json,
            layout: args.layout,
            update: args.update,
            force: args.force,
            ci: args.ci,
          },
          io,
        );
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
        exitCode = await runExtractCommand(
          {
            bundleDir: resolveCliPath(args.bundleDir, io.cwd) ?? args.bundleDir,
            destinationDir: resolveCliPath(args.to, io.cwd) ?? args.to,
            sections: normalizeArrayArg(args.section),
            files: normalizeArrayArg(args.file),
            assetsOnly: args["assets-only"],
            allowDegraded: args["allow-degraded"],
            json: args.json,
            overwrite: args.overwrite,
            verify: args.verify,
          },
          io,
        );
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
        exitCode = await runListCommand(
          {
            bundleDir: resolveCliPath(args.bundleDir, io.cwd) ?? args.bundleDir,
            files: normalizeArrayArg(args.file),
            json: args.json,
            sections: normalizeArrayArg(args.section),
          },
          io,
        );
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
        exitCode = await runValidateCommand(
          {
            bundleDir: resolveCliPath(args.bundleDir, io.cwd) ?? args.bundleDir,
            json: args.json,
          },
          io,
        );
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
        exitCode = await runVerifyCommand(
          {
            bundleDir: resolveCliPath(args.bundleDir, io.cwd) ?? args.bundleDir,
            againstDir: resolveCliPath(args.against, io.cwd),
            files: normalizeArrayArg(args.file),
            json: args.json,
            sections: normalizeArrayArg(args.section),
            config: resolveCliPath(args.config, io.cwd),
          },
          io,
        );
      },
    )
    .command(
      "doctor [subcommand]",
      "Diagnose overlaps, MCP inheritance, note drift, and secret hygiene.",
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
            "$0 doctor notes --config cx.toml",
            "Audit note-to-code references against the planning master list.",
          )
          .example(
            "$0 doctor secrets --config cx.toml",
            "Scan the master list for suspicious secrets.",
          )
          .example(
            "$0 doctor --all --config cx.toml",
            "Run overlaps, MCP inheritance, note drift, and secret diagnostics in order.",
          )
          .example(
            "$0 doctor workflow --task 'review and update linked notes'",
            "Recommend an ordered workflow path for a task.",
          )
          .positional("subcommand", {
            type: "string",
            choices: [
              "overlaps",
              "fix-overlaps",
              "mcp",
              "notes",
              "secrets",
              "workflow",
            ],
            demandOption: false,
          })
          .option("config", { type: "string", default: "cx.toml" })
          .option("all", {
            type: "boolean",
            default: false,
            description:
              "Run overlaps, MCP inheritance, note drift, and secret diagnostics in sequence.",
          })
          .option("dry-run", { type: "boolean", default: false })
          .option("interactive", { type: "boolean", default: false })
          .option("task", {
            type: "string",
            description:
              "Task description used by doctor workflow to recommend inspect, bundle, or MCP steps.",
          })
          .option("json", { type: "boolean", default: false }),
      async (args) => {
        const doctorArgs = {
          config: args.config,
          all: args.all,
          dryRun: args["dry-run"],
          interactive: args.interactive,
          task: args.task,
          json: args.json,
          ...(args.subcommand !== undefined
            ? {
                subcommand: args.subcommand as
                  | "overlaps"
                  | "fix-overlaps"
                  | "mcp"
                  | "notes"
                  | "secrets"
                  | "workflow",
              }
            : {}),
        };
        exitCode = await runDoctorCommand(doctorArgs, io);
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
        exitCode = await runRenderCommand(
          {
            config: resolveCliPath(args.config, io.cwd) ?? "cx.toml",
            sections: normalizeArrayArg(args.section),
            files: normalizeArrayArg(args.file),
            allSections: args["all-sections"],
            style: args.style,
            stdout: args.stdout,
            outputDir: args["output-dir"],
            json: args.json,
          },
          io,
        );
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
        exitCode = await runConfigCommand(
          {
            config: resolveCliPath(args.config, io.cwd) ?? "cx.toml",
            json: args.json,
          },
          io,
        );
      },
    )
    .command(
      "adapter <subcommand>",
      "Expert oracle diagnostics for parity, capability inspection, and migration checks.",
      (command) =>
        command
          .example(
            "$0 adapter capabilities",
            "Show expert oracle and reference adapter diagnostic info.",
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
        exitCode = await runAdapterCommand(
          {
            config: resolveCliPath(args.config, io.cwd) ?? "cx.toml",
            subcommand: args.subcommand as
              | "capabilities"
              | "inspect"
              | "doctor",
            sections: normalizeArrayArg(args.section),
            json: args.json,
          },
          io,
        );
      },
    )
    .command(
      "notes [subcommand]",
      "Manage repository notes.",
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
            "$0 notes read --id 20250113143015",
            "Read a note with parsed metadata and body content.",
          )
          .example(
            "$0 notes update --id 20250113143015 --body 'Revised body.'",
            "Update an existing note in place.",
          )
          .example(
            "$0 notes rename --id 20250113143015 --title 'Revised Topic'",
            "Rename an existing note in place.",
          )
          .example(
            "$0 notes delete --id 20250113143015",
            "Delete a note from the notes/ directory.",
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
          .example(
            "$0 notes check",
            "Check notes for duplicates, broken links, and orphans.",
          )
          .example(
            "$0 notes coverage",
            "Report tool documentation coverage in notes.",
          )
          .example(
            "$0 notes extract --profile arc42 --format xml",
            "Compile canonical notes into a profile-scoped LLM bundle.",
          )
          .positional("subcommand", {
            type: "string",
            choices: [
              "new",
              "read",
              "update",
              "rename",
              "delete",
              "list",
              "backlinks",
              "orphans",
              "code-links",
              "links",
              "graph",
              "check",
              "coverage",
              "extract",
            ],
            default: "list",
          })
          .option("title", {
            type: "string",
            description:
              "Title for the new or renamed note (required for 'new', 'rename', and 'update' when changing the title).",
          })
          .option("body", {
            type: "string",
            description: "Body text for the note (used by 'new' and 'update').",
          })
          .option("tags", {
            type: "array",
            string: true,
            description: "Tags to assign to the note or update in place.",
          })
          .option("id", {
            type: "string",
            description:
              "Note ID (required for 'read', 'update', 'rename', 'delete', 'backlinks', 'code-links', 'links', and 'graph' subcommands).",
          })
          .option("depth", {
            type: "number",
            description:
              "Maximum traversal depth for 'graph' subcommand (default: 2).",
          })
          .option("json", { type: "boolean", default: false })
          .option("profile", {
            type: "string",
            description:
              "Notes extraction profile name for 'extract' (for example: arc42, onboarding, manual).",
          })
          .option("format", {
            choices: ["markdown", "xml", "plain"] as const,
            description:
              "Bundle serialization format for 'extract'. Defaults to the selected profile's output_format.",
          })
          .option("output", {
            type: "string",
            description:
              "Write the extracted LLM bundle to this path. Defaults to dist/notes-<profile>.llm.<ext>.",
          })
          .option("config", {
            type: "string",
            default: "cx.toml",
            description:
              "Configuration file that may define notes extraction profiles.",
          }),
      async (args) => {
        exitCode = await runNotesCommand(
          {
            subcommand: args.subcommand as string | undefined,
            body: args.body as string | undefined,
            title: args.title as string | undefined,
            tags: normalizeArrayArg(args.tags),
            id: args.id as string | undefined,
            depth: args.depth as number | undefined,
            json: args.json,
            workspaceRoot: io.cwd,
            profile: args.profile as string | undefined,
            format: args.format as "markdown" | "xml" | "plain" | undefined,
            output: args.output as string | undefined,
            config: args.config as string | undefined,
          },
          io,
        );
      },
    );

  cli.command(
    "docs [subcommand]",
    "Compile extracted notes bundles into final docs.",
    (command) =>
      command
        .example(
          "$0 docs compile --profile arc42",
          "Compile canonical notes into the arc42 target document paths.",
        )
        .example(
          "$0 docs compile --bundle dist/notes-manual.llm.md",
          "Compile docs from an existing extracted bundle.",
        )
        .positional("subcommand", {
          type: "string",
          choices: ["compile"],
          default: "compile",
        })
        .option("profile", {
          type: "string",
          description:
            "Notes extraction profile to compile directly when no bundle path is supplied.",
        })
        .option("bundle", {
          type: "string",
          description:
            "Existing notes extract bundle to compile into final docs.",
        })
        .option("format", {
          choices: ["markdown", "xml", "plain"] as const,
          description:
            "Bundle format to use when compiling directly from --profile.",
        })
        .option("output", {
          type: "array",
          string: true,
          description:
            "Override the output paths written by docs compile. Defaults to the selected bundle target paths.",
        })
        .option("config", {
          type: "string",
          default: "cx.toml",
          description:
            "Configuration file that may define notes extraction profiles.",
        })
        .option("json", { type: "boolean", default: false }),
    async (args) => {
      exitCode = await runDocsCommand(
        {
          subcommand: args.subcommand as string | undefined,
          workspaceRoot: io.cwd,
          profile: args.profile as string | undefined,
          bundle: args.bundle as string | undefined,
          format: args.format as "markdown" | "xml" | "plain" | undefined,
          output: normalizeArrayArg(args.output),
          config: args.config as string | undefined,
          json: args.json,
        },
        io,
      );
    },
  );

  cli.command(
    "mcp [subcommand]",
    "[EXPERIMENTAL] Start the CX MCP server or inspect the machine-readable MCP tool catalog.",
    (command) =>
      command
        .example(
          "$0 mcp",
          "Start the live MCP server using cx-mcp.toml when available, otherwise cx.toml.",
        )
        .example(
          "$0 mcp catalog --json",
          "Print the machine-readable MCP tool catalog for automation.",
        )
        .positional("subcommand", {
          type: "string",
          choices: ["catalog"],
          demandOption: false,
        })
        .option("json", { type: "boolean", default: false }),
    async (args) => {
      if (args.subcommand === "catalog") {
        exitCode = await runMcpCatalogCommand({ json: args.json }, io);
        return;
      }

      exitCode = await runMcpCommand({ cwd: io.cwd });
    },
  );

  if (
    argv.length === 0 ||
    (argv.length === 1 && (argv[0] === "-h" || argv[0] === "--help"))
  ) {
    writeStdout(`${await cli.getHelp()}\n`, io);
    return 0;
  }

  if (argv.length === 1 && (argv[0] === "-v" || argv[0] === "--version")) {
    writeStdout(`${CX_DISPLAY_VERSION}\n`, io);
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
      writeStderr(`${resolved.message}\n`);
      if (resolved instanceof CxError) {
        for (const line of formatErrorRemediation(resolved.remediation)) {
          writeStderr(`${line}\n`);
        }
      }
      process.exitCode = resolved instanceof CxError ? resolved.exitCode : 1;
    });
}
