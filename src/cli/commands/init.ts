import { assertSafeProjectName } from "../../config/projectName.js";
import { scaffoldNotesModule } from "../../notes/scaffold.js";
import { CxError } from "../../shared/errors.js";
import { writeJson } from "../../shared/output.js";
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
): Promise<{ name: string | undefined; style: InitArgs["style"] }> {
  if (!args.interactive) {
    return { name: args.name, style: args.style };
  }

  printWizardHeader("Initialize new cx project");
  printWizardStep(1, 3, "Project name");

  const name =
    args.name ??
    (await wizardInput("Project name", {
      default: "myproject",
      description:
        "  Alphanumeric, dots, hyphens, underscores. Must start with letter or number.",
    }));

  printWizardStep(2, 3, "Output style");

  const style =
    args.style ??
    (await wizardSelect<InitArgs["style"]>("Repomix output style", [
      { name: "XML (recommended for LLMs)", value: "xml" },
      { name: "JSON (structured data)", value: "json" },
      { name: "Markdown (human-readable)", value: "markdown" },
      { name: "Plain text (simple)", value: "plain" },
    ]));

  printWizardStep(3, 3, "Confirmation");

  const confirmed = await wizardConfirm(
    `Create cx.toml with project "${name}" and style "${style}"?`,
    {
      default: true,
      description:
        "  This will create a configuration file in the current directory.",
    },
  );

  if (!confirmed) {
    throw new CxError("Init cancelled by user.", 1);
  }

  printWizardComplete("Configuration setup");

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

export async function runInitCommand(args: InitArgs): Promise<number> {
  if (args.templateList) {
    const templates = getSupportedTemplates();
    process.stdout.write(
      `${templates
        .map(
          (template: { name: string; description: string }) =>
            `${template.name}: ${template.description}`,
        )
        .join("\n")}\n`,
    );
    return 0;
  }

  const resolved = await resolveInteractiveValues(args);
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
    process.cwd(),
    "cx.toml",
    templateVariables,
    args.template,
  );

  if (args.stdout) {
    if (args.json ?? false) {
      writeJson({
        config: output,
        projectName: resolved.name ?? "myproject",
        style: resolved.style ?? "xml",
        path: null,
      });
    } else {
      process.stdout.write(output);
    }
    return 0;
  }

  const configResult = await renderProjectTemplate(
    process.cwd(),
    "cx.toml",
    "cx.toml",
    templateVariables,
    args.force,
    args.template,
  );
  const makefileResult = await renderProjectTemplate(
    process.cwd(),
    "Makefile",
    "Makefile",
    templateVariables,
    args.force,
    args.template,
  );
  const mcpResult = await renderProjectTemplate(
    process.cwd(),
    "cx-mcp.toml",
    "cx-mcp.toml",
    templateVariables,
    args.force,
    args.template,
  );
  const mcpJsonResult = await renderProjectTemplate(
    process.cwd(),
    ".mcp.json",
    ".mcp.json",
    templateVariables,
    args.force,
    args.template,
  );
  const vscodeMcpResult = await renderProjectTemplate(
    process.cwd(),
    ".vscode/mcp.json",
    ".vscode/mcp.json",
    templateVariables,
    args.force,
    args.template,
  );
  const claudeSettingsResult = await renderProjectTemplate(
    process.cwd(),
    ".claude/settings.json",
    ".claude/settings.json",
    templateVariables,
    args.force,
    args.template,
  );
  const codexSettingsResult = await renderProjectTemplate(
    process.cwd(),
    ".codex/settings.json",
    ".codex/settings.json",
    templateVariables,
    args.force,
    args.template,
  );
  const notesScaffold = await scaffoldNotesModule(process.cwd(), {
    force: args.force,
  });

  if (!(args.json ?? false)) {
    const { printSuccess, printInfo } = await import("../../shared/format.js");
    if (configResult.created) {
      printSuccess("Created cx.toml");
    } else if (configResult.updated) {
      printInfo("Updated cx.toml");
    } else {
      printInfo("Skipped existing cx.toml (use --force to overwrite)");
    }
    if (makefileResult.created) {
      printInfo("Created Makefile");
    } else if (makefileResult.updated) {
      printInfo("Updated Makefile");
    } else {
      printInfo("Skipped existing Makefile (use --force to overwrite)");
    }
    if (mcpResult.created) {
      printInfo("Created cx-mcp.toml");
    } else if (mcpResult.updated) {
      printInfo("Updated cx-mcp.toml");
    } else {
      printInfo("Skipped existing cx-mcp.toml (use --force to overwrite)");
    }
    if (mcpJsonResult.created) {
      printInfo("Created .mcp.json");
    } else if (mcpJsonResult.updated) {
      printInfo("Updated .mcp.json");
    } else {
      printInfo("Skipped existing .mcp.json (use --force to overwrite)");
    }
    if (vscodeMcpResult.created) {
      printInfo("Created .vscode/mcp.json");
    } else if (vscodeMcpResult.updated) {
      printInfo("Updated .vscode/mcp.json");
    } else {
      printInfo("Skipped existing .vscode/mcp.json (use --force to overwrite)");
    }
    if (claudeSettingsResult.created) {
      printInfo("Created .claude/settings.json");
    } else if (claudeSettingsResult.updated) {
      printInfo("Updated .claude/settings.json");
    } else {
      printInfo("Skipped existing .claude/settings.json (use --force to overwrite)");
    }
    if (codexSettingsResult.created) {
      printInfo("Created .codex/settings.json");
    } else if (codexSettingsResult.updated) {
      printInfo("Updated .codex/settings.json");
    } else {
      printInfo("Skipped existing .codex/settings.json (use --force to overwrite)");
    }
    printInfo(`Project name: ${resolved.name ?? "myproject"}`);
    printInfo(`Output style: ${resolved.style ?? "xml"}`);
    printInfo(`Notes directory: ${notesScaffold.notesDir}`);
    if (notesScaffold.createdPaths.length > 0) {
      printInfo(`Notes scaffolded: ${notesScaffold.createdPaths.join(", ")}`);
    }
    if (notesScaffold.updatedPaths.length > 0) {
      printInfo(`Notes refreshed: ${notesScaffold.updatedPaths.join(", ")}`);
    }
  }

  if (args.json ?? false) {
    writeJson({
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
    });
  }
  return 0;
}
