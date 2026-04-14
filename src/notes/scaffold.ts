import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir, pathExists, relativePosix } from "../shared/fs.js";

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
const NOTES_TEMPLATE_FILE = "template-new-zettel.md";

export function renderNotesGuide(): string {
  return `# Repository Notes Guide

This directory is a permanent knowledge layer for the codebase. It captures architectural intent, durable concepts, constraints, and decisions that should outlive any single sprint, ticket, or contributor.

## Why This Directory Exists

This directory exists to keep durable repository knowledge queryable.

Bundle manifests now store short note summaries so downstream AI tools can inspect the note graph without reparsing raw Markdown.

This is not a project-management folder.

- Project trackers are hierarchical and temporary.
- Repository notes are durable and linkable.
- The goal is not task execution. The goal is preserving reusable understanding.

## Before And After For Agents

Before manifest-side summaries:

- an agent sees \`notes/\` and has to open raw Markdown files one by one
- token spend rises before the agent even knows which note matters
- latency rises because every run repeats the same broad scan

After manifest-side summaries:

- the agent reads \`manifest.notes[]\` first
- it filters by stable timestamp id, title, alias, or summary text
- it opens only the note files that are actually relevant
- token spend and latency drop because the first pass is already serialized into manifest metadata

Example prompt shift:

- before: "Read every note and figure out how dirty-state enforcement works"
- after: "Read manifest note summaries, find the notes about dirty-state enforcement, then open only those note ids"

That is the practical value of this directory in an AI workflow.

## The Core Rules

### 1. Atomicity

Each note must contain one discrete thought.

Good atomic notes describe exactly one:

- architectural decision
- invariant
- mechanism
- concept
- failure mode
- tradeoff

If a note contains multiple unrelated ideas, split it.

### 2. Write In Your Own Words

Do not paste raw code or external text and call it knowledge.

A note is only useful when it explains the idea in your own words and makes the relation to this repository explicit.

### 3. Connect Notes Radially

Every note should link outward.

Add links to:

- related notes
- code components
- adjacent constraints or decisions

The value of the system comes from the graph, not from isolated pages.

### 4. Keep IDs Stable

Every note uses a time-based frontmatter id in the form \`YYYYMMDDHHMMSS\`.

The id is for machines, search, routing, and stable reference. The filename is the canonical note title. Do not put the numeric id in the visible title.

Stable ids matter because downstream automation can reference notes without depending on filenames that may drift over time.

## Recommended Workflow

1. Start from \`template-new-zettel.md\`.
2. Assign a fresh \`id\` using local time in \`YYYYMMDDHHMMSS\` format.
3. Give the note a clear searchable title.
4. Write one thought in your own words.
5. Add explicit links to related notes and code paths.
6. Save the file with a human-readable filename that matches the note title.

Suggested filename style: \`Clear Searchable Title.md\`.

## Minimum Anatomy

Every note must contain:

- YAML frontmatter with \`id\`, \`aliases\`, and \`tags\`
- one atomic body
- one links section with explicit connections to notes, code, or both

## What Does Not Belong Here

Do not use this directory for:

- sprint planning
- transient checklists
- copied code dumps
- meeting notes with no synthesis
- backlog management

If the content will be obsolete as soon as the ticket closes, it probably belongs somewhere else.
`;
}

export function renderNewZettelTemplate(): string {
  return `---
id: YYYYMMDDHHMMSS
aliases: []
tags: []
---
Write one discrete architectural thought in your own words. Keep it atomic: one concept, one mechanism, one decision, one constraint, or one failure mode.

## Links

- [[Related note title]] - Explain the relationship.
- src/path/to/component.ts - Point to the relevant code component.
`;
}

async function writeScaffoldFile(
  absolutePath: string,
  content: string,
  options: ScaffoldNotesOptions,
  result: ScaffoldNotesResult,
  projectRoot: string,
): Promise<void> {
  const exists = await pathExists(absolutePath);
  if (exists && !options.force) {
    return;
  }

  await fs.writeFile(absolutePath, content, "utf8");

  const relativePath = relativePosix(projectRoot, absolutePath);
  if (exists) {
    result.updatedPaths.push(relativePath);
  } else {
    result.createdPaths.push(relativePath);
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

  await writeScaffoldFile(
    path.join(notesDir, NOTES_GUIDE_FILE),
    renderNotesGuide(),
    options,
    result,
    projectRoot,
  );
  await writeScaffoldFile(
    path.join(notesDir, NOTES_TEMPLATE_FILE),
    renderNewZettelTemplate(),
    options,
    result,
    projectRoot,
  );

  return result;
}
