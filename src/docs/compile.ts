import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { validateNotes } from "../notes/validate.js";
import { CxError } from "../shared/errors.js";
import { ensureDir, pathExists } from "../shared/fs.js";

export type DocsCompileProfile = "architecture" | "manual" | "onboarding";

export interface DocsCompileResult {
  command: "docs compile";
  profile: DocsCompileProfile;
  outputPath: string;
  sourceNoteIds: string[];
  sourceSpecRefs: string[];
  sha256: string;
  changed: boolean;
}

export interface DocsDriftResult {
  command: "docs drift";
  valid: boolean;
  profiles: DocsCompileProfile[];
  staleGeneratedDocs: Array<{
    profile: DocsCompileProfile;
    outputPath: string;
    expectedSha256: string;
    actualSha256: string | null;
    reason: "missing" | "stale";
  }>;
}

const PROFILE_OUTPUTS: Record<DocsCompileProfile, string> = {
  architecture: "docs/modules/architecture/pages/generated-notes.adoc",
  manual: "docs/modules/manual/pages/generated-notes.adoc",
  onboarding: "docs/modules/onboarding/pages/generated-notes.adoc",
};

const PROFILE_TAGS: Record<DocsCompileProfile, string[]> = {
  architecture: ["architecture", "decision", "invariant", "mechanism"],
  manual: ["manual", "workflow", "operator", "process"],
  onboarding: ["onboarding", "workflow", "glossary", "architecture"],
};

interface DocsSourceNote {
  id: string;
  title: string;
  path: string;
  tags: string[];
  summary: string;
  codeLinks: string[];
}

export function normalizeDocsCompileProfile(value: string): DocsCompileProfile {
  if (
    value === "architecture" ||
    value === "manual" ||
    value === "onboarding"
  ) {
    return value;
  }
  throw new CxError(
    `Unknown docs profile: ${value}. Available profiles: architecture, manual, onboarding`,
    2,
  );
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function collectSourceSpecRefs(notes: DocsSourceNote[]): string[] {
  return [
    ...new Set(
      notes.flatMap((note) =>
        [...note.summary.matchAll(/\bspecs\/[^\s)`\]]+/gu)].map(
          (match) => match[0] ?? "",
        ),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right, "en"));
}

function renderGeneratedDocsPage(params: {
  notes: DocsSourceNote[];
  profile: DocsCompileProfile;
}): string {
  const sourceNoteIds = params.notes.map((note) => note.id);
  const specRefs = collectSourceSpecRefs(params.notes);
  const bodyLines: string[] = [
    `// cx-docs-generated:start profile=${params.profile}`,
    `// source-note-ids: ${sourceNoteIds.join(", ") || "(none)"}`,
    `// source-spec-refs: ${specRefs.join(", ") || "(none)"}`,
    "// generated-by: cx docs compile",
    "= Generated Notes Index",
    ":page-role: cx-generated",
    "",
    "This page is generated from the repository notes graph. Edit the source notes instead of this generated block.",
    "",
  ];

  if (params.notes.length > 0) {
    bodyLines.push("== Source Notes");
    bodyLines.push("");
    for (const note of params.notes) {
      bodyLines.push(`=== ${note.title}`);
      bodyLines.push("");
      bodyLines.push(`* Note ID: \`${note.id}\``);
      bodyLines.push(`* Source: \`${note.path}\``);
      if (note.codeLinks.length > 0) {
        bodyLines.push(
          `* Code refs: ${note.codeLinks.map((ref) => `\`${ref}\``).join(", ")}`,
        );
      }
      bodyLines.push("");
      bodyLines.push(note.summary);
      bodyLines.push("");
    }
  }

  bodyLines.push("// cx-docs-generated:end");
  bodyLines.push("");
  const withoutHash = bodyLines.join("\n");
  const hash = hashContent(withoutHash);
  return withoutHash.replace(
    "// generated-by: cx docs compile",
    `// generated-by: cx docs compile\n// content-sha256: ${hash}`,
  );
}

async function expectedPage(params: {
  workspaceRoot: string;
  profile: DocsCompileProfile;
  configPath?: string | undefined;
}): Promise<{
  content: string;
  notes: DocsSourceNote[];
  outputPath: string;
}> {
  const validation = await validateNotes("notes", params.workspaceRoot);
  if (!validation.valid) {
    throw new CxError("Cannot compile docs while notes validation fails.", 10);
  }
  const selectedTags = new Set(PROFILE_TAGS[params.profile]);
  const notes = validation.notes
    .filter((note) =>
      (note.tags ?? []).some((tag) => selectedTags.has(tag.toLowerCase())),
    )
    .sort((left, right) => left.title.localeCompare(right.title, "en"))
    .map(
      (note): DocsSourceNote => ({
        id: note.id,
        title: note.title,
        path: path.relative(params.workspaceRoot, note.filePath),
        tags: note.tags ?? [],
        summary: note.summary,
        codeLinks: note.codeLinks,
      }),
    );
  const content = renderGeneratedDocsPage({
    notes,
    profile: params.profile,
  });
  return {
    content,
    notes,
    outputPath: path.resolve(
      params.workspaceRoot,
      PROFILE_OUTPUTS[params.profile],
    ),
  };
}

export async function compileDocsFromNotes(params: {
  workspaceRoot: string;
  profile: DocsCompileProfile;
  configPath?: string | undefined;
}): Promise<DocsCompileResult> {
  const expected = await expectedPage(params);
  const previous = (await pathExists(expected.outputPath))
    ? await fs.readFile(expected.outputPath, "utf8")
    : null;
  await ensureDir(path.dirname(expected.outputPath));
  await fs.writeFile(expected.outputPath, expected.content, "utf8");
  const sourceSpecRefs = collectSourceSpecRefs(expected.notes);
  return {
    command: "docs compile",
    profile: params.profile,
    outputPath: expected.outputPath,
    sourceNoteIds: expected.notes.map((note) => note.id),
    sourceSpecRefs,
    sha256: hashContent(expected.content),
    changed: previous !== expected.content,
  };
}

export async function checkDocsDrift(params: {
  workspaceRoot: string;
  profiles?: DocsCompileProfile[] | undefined;
  configPath?: string | undefined;
}): Promise<DocsDriftResult> {
  const profiles = params.profiles ?? ["architecture", "manual", "onboarding"];
  const staleGeneratedDocs: DocsDriftResult["staleGeneratedDocs"] = [];

  for (const profile of profiles) {
    const expected = await expectedPage({
      workspaceRoot: params.workspaceRoot,
      profile,
      ...(params.configPath !== undefined && { configPath: params.configPath }),
    });
    if (!(await pathExists(expected.outputPath))) {
      staleGeneratedDocs.push({
        profile,
        outputPath: expected.outputPath,
        expectedSha256: hashContent(expected.content),
        actualSha256: null,
        reason: "missing",
      });
      continue;
    }
    const actual = await fs.readFile(expected.outputPath, "utf8");
    if (actual !== expected.content) {
      staleGeneratedDocs.push({
        profile,
        outputPath: expected.outputPath,
        expectedSha256: hashContent(expected.content),
        actualSha256: hashContent(actual),
        reason: "stale",
      });
    }
  }

  return {
    command: "docs drift",
    valid: staleGeneratedDocs.length === 0,
    profiles,
    staleGeneratedDocs,
  };
}
