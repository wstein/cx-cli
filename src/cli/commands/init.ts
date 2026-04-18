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
  type EnvironmentKind,
  type GeneratedFile,
  getSupportedTemplateDescriptors,
  getSupportedTemplates,
  getTemplateDescriptorByName,
  renderInitTemplate,
  renderInitTemplateFile,
  type TemplateDescriptor,
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

async function resolveInitTemplateDescriptor(
  projectRoot: string,
  requestedEnvironment?: string,
): Promise<TemplateDescriptor> {
  if (requestedEnvironment !== undefined) {
    return getTemplateDescriptorByName(requestedEnvironment as EnvironmentKind);
  }

  const descriptors = getSupportedTemplateDescriptors();
  const { detectEnvironment } = await import("../../templates/detect.js");
  const environment = await detectEnvironment(projectRoot);
  return (
    descriptors.find((descriptor) => descriptor.name === environment) ??
    getTemplateDescriptorByName("base")
  );
}

function mapGeneratedFilesByPath(
  files: readonly GeneratedFile[],
): Map<string, GeneratedFile> {
  return new Map(files.map((file) => [file.path, file]));
}

function getRequiredGeneratedFile(
  generatedByPath: Map<string, GeneratedFile>,
  destinationPath: string,
): GeneratedFile {
  const file = generatedByPath.get(destinationPath);
  if (!file) {
    throw new CxError(
      `Init template contract violation: missing generated file record for ${destinationPath}.`,
      1,
    );
  }
  return file;
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
  const templateDescriptor = await resolveInitTemplateDescriptor(
    projectRoot,
    args.template,
  );

  const output = await renderInitTemplate(
    projectRoot,
    "cx.toml",
    templateVariables,
    templateDescriptor.name,
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

  const generatedFiles = await Promise.all(
    [
      ...templateDescriptor.requiredGeneratedFiles,
      ...templateDescriptor.optionalGeneratedFiles,
    ].map((file) =>
      renderProjectTemplate(
        projectRoot,
        file.templateName,
        file.destinationPath,
        templateVariables,
        args.force,
        templateDescriptor.name,
      ),
    ),
  );
  const generatedByPath = mapGeneratedFilesByPath(generatedFiles);
  const configResult = getRequiredGeneratedFile(generatedByPath, "cx.toml");
  const editorconfigResult = getRequiredGeneratedFile(
    generatedByPath,
    ".editorconfig",
  );
  const makefileResult = getRequiredGeneratedFile(generatedByPath, "Makefile");
  const mcpResult = getRequiredGeneratedFile(generatedByPath, "cx-mcp.toml");
  const buildMcpResult = generatedByPath.get("cx-mcp-build.toml") ?? {
    path: "cx-mcp-build.toml",
    content: "",
    created: false,
    updated: false,
  };
  const mcpJsonResult = getRequiredGeneratedFile(generatedByPath, ".mcp.json");
  const vscodeMcpResult = getRequiredGeneratedFile(
    generatedByPath,
    ".vscode/mcp.json",
  );
  const claudeSettingsResult = getRequiredGeneratedFile(
    generatedByPath,
    ".claude/settings.json",
  );
  const codexSettingsResult = getRequiredGeneratedFile(
    generatedByPath,
    ".codex/settings.json",
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
    if (buildMcpResult.created) {
      printInfo("Created cx-mcp-build.toml", io);
    } else if (buildMcpResult.updated) {
      printInfo("Updated cx-mcp-build.toml", io);
    } else if (
      templateDescriptor.optionalGeneratedFiles.some(
        (file) => file.destinationPath === "cx-mcp-build.toml",
      )
    ) {
      printInfo(
        "Skipped existing cx-mcp-build.toml (use --force to overwrite)",
        io,
      );
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
        buildMcpCreated: buildMcpResult.created,
        buildMcpUpdated: buildMcpResult.updated,
      },
      io,
    );
  }
  return 0;
}
