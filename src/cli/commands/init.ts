import { assertSafeProjectName } from "../../config/projectName.js";
import { scaffoldNotesModule } from "../../notes/scaffold.js";
import { CxError } from "../../shared/errors.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeStdout,
  writeValidatedJson,
} from "../../shared/output.js";
import {
  printWizardComplete,
  printWizardHeader,
  printWizardStep,
  wizardConfirm,
  wizardInput,
  wizardSelect,
} from "../../shared/wizard.js";
import {
  getSupportedTemplates,
  renderInitTemplate,
  renderInitTemplateFile,
  type TemplateVariables,
} from "../../templates/index.js";
import {
  InitCommandJsonSchema,
  InitStdoutJsonSchema,
} from "../jsonContracts.js";

export interface InitArgs {
  force: boolean;
  interactive: boolean;
  json?: boolean | undefined;
  name: string | undefined;
  stdout: boolean;
  style: "xml" | "markdown" | "json" | "plain" | undefined;
  template?: string | undefined;
  templateList: boolean;
}

async function resolveInteractiveValues(
  args: InitArgs,
  io: Partial<CommandIo> = {},
): Promise<{ name: string | undefined; style: InitArgs["style"] }> {
  if (!args.interactive) {
    return { name: args.name, style: args.style };
  }

  printWizardHeader("Initialize new cx project", io);
  printWizardStep(1, 3, "Project name", io);

  const name =
    args.name ??
    (await wizardInput(
      "Project name",
      {
        default: "myproject",
        description:
          "  Alphanumeric, dots, hyphens, underscores. Must start with letter or number.",
      },
      io,
    ));

  printWizardStep(2, 3, "Output style", io);

  const style =
    args.style ??
    (await wizardSelect<InitArgs["style"]>(
      "Repomix output style",
      [
        { name: "XML (recommended for LLMs)", value: "xml" },
        { name: "JSON (structured data)", value: "json" },
        { name: "Markdown (human-readable)", value: "markdown" },
        { name: "Plain text (simple)", value: "plain" },
      ],
      {},
      io,
    ));

  printWizardStep(3, 3, "Confirmation", io);

  const confirmed = await wizardConfirm(
    `Create cx.toml with project "${name}" and style "${style}"?`,
    {
      default: true,
      description:
        "  This will create a configuration file in the current directory.",
    },
    io,
  );

  if (!confirmed) {
    throw new CxError("Init cancelled by user.", 1);
  }

  printWizardComplete("Configuration setup", io);

  return { name, style };
}

async function renderProjectTemplate(
  projectRoot: string,
  templateName: string,
  destinationPath: string,
  variables: TemplateVariables,
  force: boolean,
  requestedEnvironment?: string,
) {
  return renderInitTemplateFile(
    projectRoot,
    destinationPath,
    templateName,
    variables,
    force,
    requestedEnvironment,
  );
}

export async function runInitCommand(
  args: InitArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const projectRoot = io.cwd;
  if (args.templateList) {
    const templates = getSupportedTemplates();
    writeStdout(
      `${templates
        .map(
          (template: { name: string; description: string }) =>
            `${template.name}: ${template.description}`,
        )
        .join("\n")}\n`,
      io,
    );
    return 0;
  }

  const resolved = await resolveInteractiveValues(args, io);
  const projectName = resolved.name ?? "myproject";

  // Validate the project name
  try {
    assertSafeProjectName(projectName);
  } catch (error) {
    throw new CxError(
      `Invalid project name "${projectName}": ${error instanceof Error ? error.message : String(error)}`,
      1,
    );
  }

  const templateVariables: TemplateVariables = {
    projectName,
    style: resolved.style ?? "xml",
  };

  const output = await renderInitTemplate(
    projectRoot,
    "cx.toml",
    templateVariables,
    args.template,
  );

  if (args.stdout) {
    if (args.json ?? false) {
      writeValidatedJson(
        InitStdoutJsonSchema,
        {
          config: output,
          projectName: resolved.name ?? "myproject",
          style: resolved.style ?? "xml",
          path: null,
        },
        io,
      );
    } else {
      writeStdout(output, io);
    }
    return 0;
  }

  const configResult = await renderProjectTemplate(
    projectRoot,
    "cx.toml",
    "cx.toml",
    templateVariables,
    args.force,
    args.template,
  );
  const editorconfigResult = await renderProjectTemplate(
    projectRoot,
    ".editorconfig",
    ".editorconfig",
    templateVariables,
    args.force,
    args.template,
  );
  const makefileResult = await renderProjectTemplate(
    projectRoot,
    "Makefile",
    "Makefile",
    templateVariables,
    args.force,
    args.template,
  );
  const mcpResult = await renderProjectTemplate(
    projectRoot,
    "cx-mcp.toml",
    "cx-mcp.toml",
    templateVariables,
    args.force,
    args.template,
  );
  const mcpJsonResult = await renderProjectTemplate(
    projectRoot,
    ".mcp.json",
    ".mcp.json",
    templateVariables,
    args.force,
    args.template,
  );
  const vscodeMcpResult = await renderProjectTemplate(
    projectRoot,
    ".vscode/mcp.json",
    ".vscode/mcp.json",
    templateVariables,
    args.force,
    args.template,
  );
  const claudeSettingsResult = await renderProjectTemplate(
    projectRoot,
    ".claude/settings.json",
    ".claude/settings.json",
    templateVariables,
    args.force,
    args.template,
  );
  const codexSettingsResult = await renderProjectTemplate(
    projectRoot,
    ".codex/settings.json",
    ".codex/settings.json",
    templateVariables,
    args.force,
    args.template,
  );
  const notesScaffold = await scaffoldNotesModule(projectRoot, {
    force: args.force,
  });

  if (!(args.json ?? false)) {
    const { printSuccess, printInfo } = await import("../../shared/format.js");
    if (configResult.created) {
      printSuccess("Created cx.toml", io);
    } else if (configResult.updated) {
      printInfo("Updated cx.toml", io);
    } else {
      printInfo("Skipped existing cx.toml (use --force to overwrite)", io);
    }
    if (editorconfigResult.created) {
      printInfo("Created .editorconfig", io);
    } else if (editorconfigResult.updated) {
      printInfo("Updated .editorconfig", io);
    } else {
      printInfo(
        "Skipped existing .editorconfig (use --force to overwrite)",
        io,
      );
    }
    if (makefileResult.created) {
      printInfo("Created Makefile", io);
    } else if (makefileResult.updated) {
      printInfo("Updated Makefile", io);
    } else {
      printInfo("Skipped existing Makefile (use --force to overwrite)", io);
    }
    if (mcpResult.created) {
      printInfo("Created cx-mcp.toml", io);
    } else if (mcpResult.updated) {
      printInfo("Updated cx-mcp.toml", io);
    } else {
      printInfo("Skipped existing cx-mcp.toml (use --force to overwrite)", io);
    }
    if (mcpJsonResult.created) {
      printInfo("Created .mcp.json", io);
    } else if (mcpJsonResult.updated) {
      printInfo("Updated .mcp.json", io);
    } else {
      printInfo("Skipped existing .mcp.json (use --force to overwrite)", io);
    }
    if (vscodeMcpResult.created) {
      printInfo("Created .vscode/mcp.json", io);
    } else if (vscodeMcpResult.updated) {
      printInfo("Updated .vscode/mcp.json", io);
    } else {
      printInfo(
        "Skipped existing .vscode/mcp.json (use --force to overwrite)",
        io,
      );
    }
    if (claudeSettingsResult.created) {
      printInfo("Created .claude/settings.json", io);
    } else if (claudeSettingsResult.updated) {
      printInfo("Updated .claude/settings.json", io);
    } else {
      printInfo(
        "Skipped existing .claude/settings.json (use --force to overwrite)",
        io,
      );
    }
    if (codexSettingsResult.created) {
      printInfo("Created .codex/settings.json", io);
    } else if (codexSettingsResult.updated) {
      printInfo("Updated .codex/settings.json", io);
    } else {
      printInfo(
        "Skipped existing .codex/settings.json (use --force to overwrite)",
        io,
      );
    }
    printInfo(`Project name: ${resolved.name ?? "myproject"}`, io);
    printInfo(`Output style: ${resolved.style ?? "xml"}`, io);
    printInfo(`Notes directory: ${notesScaffold.notesDir}`, io);
    if (notesScaffold.createdPaths.length > 0) {
      printInfo(
        `Notes scaffolded: ${notesScaffold.createdPaths.join(", ")}`,
        io,
      );
    }
    if (notesScaffold.updatedPaths.length > 0) {
      printInfo(
        `Notes refreshed: ${notesScaffold.updatedPaths.join(", ")}`,
        io,
      );
    }
  }

  if (args.json ?? false) {
    writeValidatedJson(
      InitCommandJsonSchema,
      {
        projectName: resolved.name ?? "myproject",
        style: resolved.style ?? "xml",
        path: "cx.toml",
        notesDir: notesScaffold.notesDir,
        notesCreated: notesScaffold.createdPaths,
        notesUpdated: notesScaffold.updatedPaths,
        makefileCreated: makefileResult.created,
        makefileUpdated: makefileResult.updated,
        mcpCreated: mcpResult.created,
        mcpUpdated: mcpResult.updated,
      },
      io,
    );
  }
  return 0;
}
