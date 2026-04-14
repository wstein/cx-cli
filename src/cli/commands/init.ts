import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_CONFIG_TEMPLATE } from "../../config/defaults.js";
import { assertSafeProjectName } from "../../config/projectName.js";
import { scaffoldNotesModule } from "../../notes/scaffold.js";
import { CxError } from "../../shared/errors.js";
import { pathExists } from "../../shared/fs.js";
import { writeJson } from "../../shared/output.js";
import {
  printWizardComplete,
  printWizardHeader,
  printWizardStep,
  wizardConfirm,
  wizardInput,
  wizardSelect,
} from "../../shared/wizard.js";

export interface InitArgs {
  force: boolean;
  interactive: boolean;
  json?: boolean | undefined;
  name: string | undefined;
  stdout: boolean;
  style: "xml" | "markdown" | "json" | "plain" | undefined;
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

function renderMakefile(): string {
  return `# Generic Makefile for cx projects.
#
# This Makefile is intentionally minimal and AI-friendly.
# It defines common sandboxed tasks for building, inspecting,
# validating, and cleaning cx-generated output.
#
# Usage:
#   make          # build the default bundle
#   make bundle   # run cx bundle
#   make validate # validate project configuration
#   make inspect  # inspect the bundle plan
#   make clean    # remove generated artifacts
#
CX_CONFIG ?= cx.toml
CLEAN_DIR ?= dist

.PHONY: all bundle validate inspect clean notes help
all: bundle

bundle: ## Build a bundle from the cx configuration.
	cx bundle --config "$(CX_CONFIG)"

inspect: ## Show the computed bundle plan.
	cx inspect --config "$(CX_CONFIG)"

validate: ## Validate the current project configuration.
	cx validate --config "$(CX_CONFIG)"

clean: ## Remove generated output files.
	rm -rf "$(CLEAN_DIR)"

notes: ## Print the notes directory path.
	@printf "Notes directory: notes\n"

help: ## Describe available targets.
	@printf "Available targets:\n  bundle validate inspect clean notes\n"
`;
}

async function writeProjectMakefile(
  force: boolean,
): Promise<{ created: boolean; updated: boolean }> {
  const makefilePath = path.join(process.cwd(), "Makefile");
  const exists = await pathExists(makefilePath);
  if (exists && !force) {
    return { created: false, updated: false };
  }

  await fs.writeFile(makefilePath, renderMakefile(), "utf8");
  return { created: !exists, updated: exists };
}

export async function runInitCommand(args: InitArgs): Promise<number> {
  const resolved = await resolveInteractiveValues(args);
  let output = DEFAULT_CONFIG_TEMPLATE;

  if (resolved.name) {
    assertSafeProjectName(resolved.name);
    output = output.replace(
      'project_name = "myproject"',
      `project_name = "${resolved.name}"`,
    );
    output = output.replace(
      'output_dir = "dist/myproject-bundle"',
      `output_dir = "dist/${resolved.name}-bundle"`,
    );
  }

  if (resolved.style) {
    output = output.replace('style = "xml"', `style = "${resolved.style}"`);
  }

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

  if (!args.force && (await pathExists("cx.toml"))) {
    throw new CxError(
      "cx.toml already exists. Use --force to overwrite it.",
      3,
    );
  }

  await fs.writeFile("cx.toml", output, "utf8");
  const makefileResult = await writeProjectMakefile(args.force);
  const notesScaffold = await scaffoldNotesModule(process.cwd(), {
    force: args.force,
  });

  if (!(args.json ?? false)) {
    const { printSuccess, printInfo } = await import("../../shared/format.js");
    printSuccess("Created cx.toml");
    if (makefileResult.created) {
      printInfo("Created Makefile");
    } else if (makefileResult.updated) {
      printInfo("Updated Makefile");
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
    });
  }
  return 0;
}
