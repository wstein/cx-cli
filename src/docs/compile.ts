import fs from "node:fs/promises";
import path from "node:path";
import {
  compileNotesExtractBundle,
  type NotesExtractBundle,
  parseNotesExtractBundleContent,
} from "../notes/extract.js";
import { CxError } from "../shared/errors.js";
import { ensureDir } from "../shared/fs.js";

export interface CompileDocsFromBundleOptions {
  workspaceRoot: string;
  bundlePath?: string;
  profileName?: string;
  format?: "markdown" | "xml" | "plain";
  configPath?: string;
  outputPaths?: string[];
}

export interface CompileDocsFromBundleResult {
  bundlePath: string;
  bundle: NotesExtractBundle;
  writtenFiles: string[];
}

function titleFromDocumentKind(bundle: NotesExtractBundle): string {
  switch (bundle.profile.name) {
    case "arc42":
      return "CX Architecture";
    case "onboarding":
      return "CX Onboarding Guide";
    case "manual":
      return "CX Operator Manual";
    default:
      return bundle.authoringContract.documentKind
        .split(/\s+/)
        .map((part) =>
          part.length === 0
            ? part
            : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`,
        )
        .join(" ");
  }
}

function renderAsciidoc(bundle: NotesExtractBundle): string {
  const title = titleFromDocumentKind(bundle);
  const lines: string[] = [
    `= ${title}`,
    `:generated-by: cx docs compile`,
    `:notes-profile: ${bundle.profile.name}`,
    `:document-kind: ${bundle.authoringContract.documentKind}`,
    "",
    "// Generated from a cx notes extract bundle.",
    "// Canonical truth remains in notes/.",
    "",
    "[IMPORTANT]",
    "====",
    "This document was compiled from canonical notes.",
    "The notes graph remains the source of truth.",
    `Bundle profile: \`${bundle.profile.name}\``,
    `Generation command: \`${bundle.provenance.generationCommand}\``,
    "====",
    "",
  ];

  for (const section of bundle.sections) {
    lines.push(`== ${section.title}`);
    lines.push("");
    const sectionNotes = bundle.notes.filter(
      (note) => note.assignedSection === section.id,
    );

    if (sectionNotes.length === 0) {
      lines.push(
        "No canonical notes matched this section for the selected profile.",
      );
      lines.push("");
      continue;
    }

    lines.push("This section compiles the following canonical notes:");
    lines.push("");
    for (const note of sectionNotes) {
      lines.push(`* ${note.title}`);
    }
    lines.push("");
    lines.push("Canonical note summaries:");
    lines.push("");
    for (const note of sectionNotes) {
      lines.push(`${note.title}:: ${note.summary}`);
    }
    lines.push("");

    for (const note of sectionNotes) {
      lines.push(`=== ${note.title}`);
      lines.push("");
      lines.push(`NOTE ID: \`${note.id}\``);
      lines.push("");
      lines.push(`Path: \`${note.path}\``);
      lines.push("");
      lines.push(note.summary);
      lines.push("");

      for (const noteSection of note.sections) {
        lines.push(`==== ${noteSection.title}`);
        lines.push("");
        lines.push(noteSection.content);
        lines.push("");
      }

      if (note.noteLinks.length > 0 || note.codeLinks.length > 0) {
        lines.push("==== Provenance");
        lines.push("");
        if (note.noteLinks.length > 0) {
          lines.push("Related notes:");
          lines.push("");
          for (const noteLink of note.noteLinks) {
            lines.push(`* ${noteLink}`);
          }
          lines.push("");
        }
        if (note.codeLinks.length > 0) {
          lines.push("Code links:");
          lines.push("");
          for (const codeLink of note.codeLinks) {
            lines.push(`* \`${codeLink}\``);
          }
          lines.push("");
        }
      }
    }
  }

  lines.push("[appendix]");
  lines.push("== Compilation Provenance");
  lines.push("");
  lines.push(`* Canonical source: \`${bundle.provenance.canonicalSource}\``);
  lines.push(`* Source glob: \`${bundle.provenance.sourceGlob}\``);
  lines.push(`* Profile: \`${bundle.profile.name}\``);
  lines.push(
    `* Target paths: ${bundle.profile.targetPaths
      .map((entry) => `\`${entry}\``)
      .join(", ")}`,
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderMarkdown(bundle: NotesExtractBundle): string {
  const title = titleFromDocumentKind(bundle);
  const lines: string[] = [
    `# ${title}`,
    "",
    "> Generated from a `cx notes extract` bundle.",
    "> Canonical truth remains in `notes/`.",
    "",
    `- Profile: ${bundle.profile.name}`,
    `- Document kind: ${bundle.authoringContract.documentKind}`,
    `- Generation command: ${bundle.provenance.generationCommand}`,
    "",
  ];

  for (const section of bundle.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    const sectionNotes = bundle.notes.filter(
      (note) => note.assignedSection === section.id,
    );
    if (sectionNotes.length === 0) {
      lines.push("No canonical notes matched this section.");
      lines.push("");
      continue;
    }

    for (const note of sectionNotes) {
      lines.push(`### ${note.title}`);
      lines.push("");
      lines.push(`- Note ID: ${note.id}`);
      lines.push(`- Path: ${note.path}`);
      lines.push(`- Tags: ${note.tags.join(", ") || "(none)"}`);
      lines.push("");
      lines.push(note.summary);
      lines.push("");
      for (const noteSection of note.sections) {
        lines.push(`#### ${noteSection.title}`);
        lines.push("");
        lines.push(noteSection.content);
        lines.push("");
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderPlain(bundle: NotesExtractBundle): string {
  const title = titleFromDocumentKind(bundle);
  const lines: string[] = [
    title,
    `PROFILE ${bundle.profile.name}`,
    `DOCUMENT KIND ${bundle.authoringContract.documentKind}`,
    `GENERATION COMMAND ${bundle.provenance.generationCommand}`,
    "",
  ];

  for (const section of bundle.sections) {
    lines.push(section.title.toUpperCase());
    const sectionNotes = bundle.notes.filter(
      (note) => note.assignedSection === section.id,
    );
    for (const note of sectionNotes) {
      lines.push(`- ${note.title}`);
      lines.push(`  ${note.summary}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderCompiledDoc(bundle: NotesExtractBundle): string {
  switch (bundle.authoringContract.targetFormat) {
    case "asciidoc":
      return renderAsciidoc(bundle);
    case "markdown":
      return renderMarkdown(bundle);
    case "plain":
      return renderPlain(bundle);
  }
}

async function resolveBundleInput(
  options: CompileDocsFromBundleOptions,
): Promise<{ bundle: NotesExtractBundle; bundlePath: string }> {
  const workspaceRoot = path.resolve(options.workspaceRoot);

  if (options.bundlePath !== undefined) {
    const bundlePath = path.resolve(workspaceRoot, options.bundlePath);
    const content = await fs.readFile(bundlePath, "utf8");
    return {
      bundle: parseNotesExtractBundleContent(content, bundlePath),
      bundlePath,
    };
  }

  if (!options.profileName) {
    throw new CxError(
      "Either --bundle or --profile is required for 'cx docs compile'.",
      2,
    );
  }

  const compiledBundle = await compileNotesExtractBundle({
    workspaceRoot,
    profileName: options.profileName,
    ...(options.format !== undefined ? { format: options.format } : {}),
    ...(options.configPath !== undefined
      ? { configPath: options.configPath }
      : {}),
  });

  return {
    bundle: parseNotesExtractBundleContent(
      compiledBundle.content,
      compiledBundle.outputPath,
    ),
    bundlePath: compiledBundle.outputPath,
  };
}

export async function compileDocsFromBundle(
  options: CompileDocsFromBundleOptions,
): Promise<CompileDocsFromBundleResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const { bundle, bundlePath } = await resolveBundleInput(options);
  const rendered = renderCompiledDoc(bundle);
  const targetPaths =
    options.outputPaths !== undefined && options.outputPaths.length > 0
      ? options.outputPaths.map((entry) => path.resolve(workspaceRoot, entry))
      : bundle.profile.targetPaths.map((entry) =>
          path.resolve(workspaceRoot, entry),
        );

  const writtenFiles: string[] = [];
  for (const targetPath of targetPaths) {
    await ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, rendered, "utf8");
    writtenFiles.push(targetPath);
  }

  return {
    bundlePath,
    bundle,
    writtenFiles,
  };
}
