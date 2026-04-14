/**
 * Template rendering engine for cx init scaffolding.
 *
 * Loads Handlebars templates from src/templates/init/{environment}/
 * and renders them with explicit project variables.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Handlebars from "handlebars";
import { ensureDir, pathExists, relativePosix } from "../shared/fs.js";
import { detectEnvironment, isEnvironmentSupported } from "./detect.js";
import type { EnvironmentKind, GeneratedFile, TemplateVariables } from "./types.js";

const TEMPLATES_DIR = path.join(
  fileURLToPath(new URL("./", import.meta.url)),
  "init",
);

async function loadTemplateSource(
  environment: EnvironmentKind,
  templateName: string,
): Promise<string> {
  const candidate = path.join(
    TEMPLATES_DIR,
    environment,
    `${templateName}.hbs`,
  );
  if (await pathExists(candidate)) {
    return fs.readFile(candidate, "utf8");
  }

  const fallback = path.join(TEMPLATES_DIR, "base", `${templateName}.hbs`);
  if (await pathExists(fallback)) {
    return fs.readFile(fallback, "utf8");
  }

  throw new Error(
    `Missing template: ${templateName} (environment=${environment})`,
  );
}

async function compileTemplate(
  environment: EnvironmentKind,
  templateName: string,
  variables: TemplateVariables,
): Promise<string> {
  const source = await loadTemplateSource(environment, templateName);
  const template = Handlebars.compile(source);
  return template(variables);
}

async function resolveEnvironment(
  projectRoot: string,
  requestedEnvironment?: string,
): Promise<EnvironmentKind> {
  if (requestedEnvironment) {
    if (!isEnvironmentSupported(requestedEnvironment)) {
      throw new Error(
        `Unknown template environment: ${requestedEnvironment}. Supported templates are: rust, go, typescript, elixir, julia, crystal, base.`,
      );
    }
    return requestedEnvironment;
  }
  return detectEnvironment(projectRoot);
}

export async function renderInitTemplate(
  projectRoot: string,
  templateName: string,
  variables: TemplateVariables,
  requestedEnvironment?: string,
): Promise<string> {
  const environment = await resolveEnvironment(projectRoot, requestedEnvironment);
  return compileTemplate(environment, templateName, variables);
}

export async function renderInitTemplateFile(
  projectRoot: string,
  destinationPath: string,
  templateName: string,
  variables: TemplateVariables,
  force: boolean,
  requestedEnvironment?: string,
): Promise<GeneratedFile> {
  const absoluteDestination = path.join(projectRoot, destinationPath);
  const exists = await pathExists(absoluteDestination);
  if (exists && !force) {
    return {
      path: destinationPath,
      content: "",
      created: false,
      updated: false,
    };
  }

  const content = await renderInitTemplate(
    projectRoot,
    templateName,
    variables,
    requestedEnvironment,
  );
  await ensureDir(path.dirname(absoluteDestination));
  await fs.writeFile(absoluteDestination, content, "utf8");

  return {
    path: relativePosix(projectRoot, absoluteDestination),
    content,
    created: !exists,
    updated: exists,
  };
}
