import path from "node:path";

import { ensureDir, relativePosix } from "../shared/fs.js";
import {
  renderInitTemplateFile,
  type TemplateVariables,
} from "../templates/index.js";

export interface ScaffoldNotesOptions {
  force: boolean;
}

export interface ScaffoldNotesResult {
  createdPaths: string[];
  updatedPaths: string[];
  notesDir: string;
}

const NOTES_DIR_NAME = "notes";
const NOTES_GUIDE_FILE = "README.md";
const NOTES_TEMPLATE_FILE = "template-new-note.md";

async function writeScaffoldFile(
  absolutePath: string,
  templateName: string,
  options: ScaffoldNotesOptions,
  result: ScaffoldNotesResult,
  projectRoot: string,
  variables: TemplateVariables,
): Promise<void> {
  const relativeDestination = relativePosix(projectRoot, absolutePath);
  const generated = await renderInitTemplateFile(
    projectRoot,
    relativeDestination,
    templateName,
    variables,
    options.force,
  );

  if (generated.created) {
    result.createdPaths.push(relativeDestination);
  } else if (generated.updated) {
    result.updatedPaths.push(relativeDestination);
  }
}

export async function scaffoldNotesModule(
  projectRoot: string,
  options: ScaffoldNotesOptions,
): Promise<ScaffoldNotesResult> {
  const notesDir = path.join(projectRoot, NOTES_DIR_NAME);
  await ensureDir(notesDir);

  const result: ScaffoldNotesResult = {
    createdPaths: [],
    updatedPaths: [],
    notesDir: relativePosix(projectRoot, notesDir),
  };

  const variables: TemplateVariables = {
    projectName: path.basename(projectRoot),
    style: "xml",
  };

  await writeScaffoldFile(
    path.join(notesDir, NOTES_GUIDE_FILE),
    "notes/README.md",
    options,
    result,
    projectRoot,
    variables,
  );
  await writeScaffoldFile(
    path.join(notesDir, NOTES_TEMPLATE_FILE),
    "notes/template-new-note.md",
    options,
    result,
    projectRoot,
    variables,
  );

  return result;
}
