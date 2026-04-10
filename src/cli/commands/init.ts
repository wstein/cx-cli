import fs from "node:fs/promises";

import { input, select } from "@inquirer/prompts";

import { DEFAULT_CONFIG_TEMPLATE } from "../../config/defaults.js";
import { CxError } from "../../shared/errors.js";
import { pathExists } from "../../shared/fs.js";

export interface InitArgs {
  force: boolean;
  interactive: boolean;
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

  const name =
    args.name ??
    (await input({
      message: "Project name",
      default: "myproject",
    }));
  const style =
    args.style ??
    (await select<InitArgs["style"]>({
      message: "Repomix output style",
      choices: [
        { name: "XML", value: "xml" },
        { name: "JSON", value: "json" },
        { name: "Markdown", value: "markdown" },
        { name: "Plain", value: "plain" },
      ],
      default: "xml",
    }));

  return { name, style };
}

export async function runInitCommand(args: InitArgs): Promise<number> {
  const resolved = await resolveInteractiveValues(args);
  let output = DEFAULT_CONFIG_TEMPLATE;

  if (resolved.name) {
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
    process.stdout.write(output);
    return 0;
  }

  if (!args.force && (await pathExists("cx.toml"))) {
    throw new CxError(
      "cx.toml already exists. Use --force to overwrite it.",
      3,
    );
  }

  await fs.writeFile("cx.toml", output, "utf8");
  return 0;
}
