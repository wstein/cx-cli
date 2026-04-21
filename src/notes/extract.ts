import fs from "node:fs/promises";
import path from "node:path";
import { loadCxConfig } from "../config/load.js";
import type {
  CxNotesExtractFormat,
  CxNotesExtractLlmConfig,
  CxNotesExtractProfileConfig,
} from "../config/types.js";
import { CxError } from "../shared/errors.js";
import { ensureDir, pathExists } from "../shared/fs.js";
import { readNote } from "./crud.js";
import {
  extractCodePathReferences,
  extractWikilinkReferences,
} from "./linking.js";
import { type NoteTarget, validateNotes } from "./validate.js";

export interface NotesExtractNoteSection {
  key: string;
  title: string;
  content: string;
}

export interface NotesExtractNote {
  id: string;
  title: string;
  path: string;
  target: NoteTarget;
  aliases: string[];
  tags: string[];
  summary: string;
  codeLinks: string[];
  noteLinks: string[];
  sections: NotesExtractNoteSection[];
  body: string;
  assignedSection: string;
  assignedSectionTitle: string;
}

export interface NotesExtractBundleSection {
  id: string;
  title: string;
  noteCount: number;
  noteIds: string[];
}

export interface NotesExtractBundle {
  version: "1";
  profile: {
    name: string;
    description: string;
    outputFormat: CxNotesExtractFormat;
    targetPaths: string[];
    includeTargets: NoteTarget[];
    includeTags: string[];
    excludeTags: string[];
    requiredNotes: string[];
    requiredSections: string[];
  };
  authoringContract: CxNotesExtractLlmConfig;
  provenance: {
    canonicalSource: "notes";
    sourceGlob: "notes/**/*.md";
    workspaceRoot: string;
    generationCommand: string;
  };
  sections: NotesExtractBundleSection[];
  notes: NotesExtractNote[];
}

export interface CompileNotesExtractBundleResult {
  bundle: NotesExtractBundle;
  content: string;
  outputPath: string;
  format: CxNotesExtractFormat;
}

export interface CompileNotesExtractBundleOptions {
  workspaceRoot: string;
  profileName: string;
  format?: CxNotesExtractFormat;
  outputPath?: string;
  configPath?: string;
}

const MARKDOWN_PAYLOAD_START = "<!-- cx-notes-bundle-payload:start -->";
const MARKDOWN_PAYLOAD_END = "<!-- cx-notes-bundle-payload:end -->";
const PLAIN_PAYLOAD_START = "CX NOTES MACHINE PAYLOAD START";
const PLAIN_PAYLOAD_END = "CX NOTES MACHINE PAYLOAD END";

const TARGET_PRIORITY: Record<NoteTarget, number> = {
  current: 0,
  "v0.4": 1,
  backlog: 2,
};

const SECTION_TITLE_ALIASES: Record<string, string> = {
  "introduction-and-goals": "Introduction and Goals",
  constraints: "Constraints",
  "solution-strategy": "Solution Strategy",
  "building-block-view": "Building Block View",
  "runtime-view": "Runtime View",
  "cross-cutting-concepts": "Cross-cutting Concepts",
  "quality-scenarios": "Quality Scenarios",
  "risks-and-technical-debt": "Risks and Technical Debt",
  "mental-models": "Mental Models",
  "core-workflows": "Core Workflows",
  "core-architecture": "Core Architecture",
  "quality-and-guardrails": "Quality and Guardrails",
  "commands-and-behavior": "Commands and Behavior",
  "validation-and-troubleshooting": "Validation and Troubleshooting",
  "release-and-integrity": "Release and Integrity",
  "reference-notes": "Reference Notes",
};

function toTitleCase(value: string): string {
  return value
    .split("-")
    .map((part) =>
      part.length === 0
        ? part
        : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`,
    )
    .join(" ");
}

function renderSectionTitle(sectionId: string): string {
  return SECTION_TITLE_ALIASES[sectionId] ?? toTitleCase(sectionId);
}

function normalizeTagSet(tags: string[]): Set<string> {
  return new Set(tags.map((tag) => tag.toLowerCase()));
}

function selectionTagsForProfile(
  profile: CxNotesExtractProfileConfig,
): Set<string> {
  return new Set([
    ...profile.includeTags,
    ...Object.values(profile.sectionTags).flat(),
  ]);
}

function profileHasSelectionSurface(
  profile: CxNotesExtractProfileConfig,
): boolean {
  return (
    selectionTagsForProfile(profile).size > 0 ||
    profile.requiredNotes.length > 0
  );
}

function splitSections(body: string): NotesExtractNoteSection[] {
  const normalizedBody = body.trim();
  if (normalizedBody.length === 0) {
    return [];
  }

  const matches = [...normalizedBody.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [
      {
        key: "body",
        title: "Body",
        content: normalizedBody,
      },
    ];
  }

  const sections: NotesExtractNoteSection[] = [];
  const firstMatch = matches[0];
  const prelude = normalizedBody.slice(0, firstMatch?.index ?? 0).trim();
  if (prelude.length > 0) {
    sections.push({
      key: "summary",
      title: "Summary",
      content: prelude,
    });
  }

  for (const [index, match] of matches.entries()) {
    const title = (match[1] ?? "").trim();
    const sectionStart = (match.index ?? 0) + match[0].length;
    const nextMatch = matches[index + 1];
    const sectionEnd = nextMatch?.index ?? normalizedBody.length;
    const content = normalizedBody.slice(sectionStart, sectionEnd).trim();
    const key = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    sections.push({
      key: key.length > 0 ? key : `section-${index + 1}`,
      title,
      content,
    });
  }

  return sections.filter((section) => section.content.length > 0);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function renderMarkdownList(values: string[], fallback: string): string[] {
  if (values.length === 0) {
    return [`- ${fallback}`];
  }

  return values.map((value) => `- ${value}`);
}

function normalizeProfile(
  profileName: string,
  profile: CxNotesExtractProfileConfig,
): CxNotesExtractProfileConfig {
  const requiredSectionIds = [...profile.sectionOrder];
  if (!requiredSectionIds.includes("reference-notes")) {
    requiredSectionIds.push("reference-notes");
  }

  const sectionTags = Object.fromEntries(
    Object.entries(profile.sectionTags).map(([sectionId, tags]) => [
      sectionId,
      [...new Set(tags.map((tag) => tag.toLowerCase()))],
    ]),
  );

  const normalizedProfile = {
    ...profile,
    sectionOrder: requiredSectionIds,
    includeTags: [
      ...new Set(profile.includeTags.map((tag) => tag.toLowerCase())),
    ],
    excludeTags: [
      ...new Set(profile.excludeTags.map((tag) => tag.toLowerCase())),
    ],
    requiredNotes: [...new Set(profile.requiredNotes)],
    sectionTags,
    llm: {
      ...profile.llm,
      instructions: profile.llm.instructions.trim(),
      systemRole: profile.llm.systemRole.trim(),
      documentKind: profile.llm.documentKind.trim(),
      audience: profile.llm.audience.trim(),
      tone: profile.llm.tone.trim(),
    },
    description: profile.description.trim(),
    targetPaths: [...new Set(profile.targetPaths)],
  };

  if (!profileHasSelectionSurface(normalizedProfile)) {
    throw new CxError(
      `notes extract profile '${profileName}' must define at least one note-selection surface via include_tags, section_tags, or required_notes.`,
      2,
    );
  }

  return normalizedProfile;
}

export function getBuiltinNotesExtractProfiles(): Record<
  string,
  CxNotesExtractProfileConfig
> {
  return {
    arc42: normalizeProfile("arc42", {
      description:
        "Compile canonical notes into an arc42-oriented LLM bundle for architecture documentation.",
      outputFormat: "markdown",
      targetPaths: ["docs/modules/ROOT/pages/architecture/index.adoc"],
      includeTags: [],
      excludeTags: [],
      requiredNotes: ["Render Kernel Constitution"],
      includeTargets: ["current", "v0.4"],
      sectionOrder: [
        "introduction-and-goals",
        "constraints",
        "solution-strategy",
        "building-block-view",
        "runtime-view",
        "cross-cutting-concepts",
        "quality-scenarios",
        "risks-and-technical-debt",
      ],
      sectionTags: {
        "introduction-and-goals": ["docs", "onboarding", "architecture"],
        constraints: ["governance", "trust", "boundaries", "contract"],
        "solution-strategy": ["architecture", "kernel", "render", "notes"],
        "building-block-view": ["bundle", "manifest", "extract", "scanner"],
        "runtime-view": ["workflow", "mcp", "operator", "release"],
        "cross-cutting-concepts": [
          "determinism",
          "provenance",
          "hash",
          "oracle",
        ],
        "quality-scenarios": ["testing", "ci", "coverage", "release"],
        "risks-and-technical-debt": [
          "backlog",
          "risk",
          "migration",
          "decommission",
        ],
      },
      llm: {
        systemRole: "You are a senior software architect and technical writer.",
        instructions:
          "Write arc42-style architecture documentation in AsciiDoc. Use notes as canonical truth. Do not invent new invariants. Surface conflicts explicitly. Prefer explanation over note concatenation.",
        targetFormat: "asciidoc",
        documentKind: "arc42 architecture",
        audience: "architects-and-maintainers",
        tone: "formal-technical",
        mustCiteNoteTitles: true,
        mustPreserveUncertainty: true,
        mustNotInventFacts: true,
        mustIncludeProvenance: true,
        mustSurfaceConflicts: true,
      },
    }),
    onboarding: normalizeProfile("onboarding", {
      description:
        "Compile canonical notes into an onboarding-oriented LLM bundle for new contributors.",
      outputFormat: "markdown",
      targetPaths: ["docs/modules/ROOT/pages/start-here/docs-index.adoc"],
      includeTags: [],
      excludeTags: ["release", "decommission"],
      requiredNotes: ["Agent Operating Model"],
      includeTargets: ["current", "v0.4"],
      sectionOrder: [
        "mental-models",
        "core-workflows",
        "core-architecture",
        "quality-and-guardrails",
      ],
      sectionTags: {
        "mental-models": [
          "onboarding",
          "mental-model",
          "architecture",
          "notes",
        ],
        "core-workflows": ["workflow", "operator", "manual", "mcp"],
        "core-architecture": ["bundle", "render", "kernel", "scanner"],
        "quality-and-guardrails": [
          "testing",
          "governance",
          "release",
          "contract",
        ],
      },
      llm: {
        systemRole:
          "You are an onboarding-focused maintainer and technical writer.",
        instructions:
          "Write onboarding documentation in AsciiDoc. Define core concepts before details. Explain why the project is built this way. Keep notes canonical and point readers back to durable reference where precision matters.",
        targetFormat: "asciidoc",
        documentKind: "onboarding guide",
        audience: "new-contributors",
        tone: "clear-supportive",
        mustCiteNoteTitles: true,
        mustPreserveUncertainty: true,
        mustNotInventFacts: true,
        mustIncludeProvenance: true,
        mustSurfaceConflicts: true,
      },
    }),
    manual: normalizeProfile("manual", {
      description:
        "Compile canonical notes into an operator manual LLM bundle for task-oriented documentation.",
      outputFormat: "markdown",
      targetPaths: ["docs/modules/ROOT/pages/manual/operator-manual.adoc"],
      includeTags: [],
      excludeTags: [],
      requiredNotes: ["Friday To Monday Workflow Contract"],
      includeTargets: ["current", "v0.4"],
      sectionOrder: [
        "core-workflows",
        "commands-and-behavior",
        "validation-and-troubleshooting",
        "release-and-integrity",
      ],
      sectionTags: {
        "core-workflows": ["workflow", "manual", "operator", "mcp"],
        "commands-and-behavior": ["cli", "bundle", "extract", "scanner"],
        "validation-and-troubleshooting": [
          "validate",
          "verify",
          "testing",
          "troubleshooting",
        ],
        "release-and-integrity": ["release", "ci", "governance", "contract"],
      },
      llm: {
        systemRole: "You are a maintainer writing an operator manual.",
        instructions:
          "Write task-oriented manual content in AsciiDoc. Prefer workflows and commands. Explain inputs, outputs, validation checks, and failure modes. Keep canonical facts anchored to the supplied notes and preserve uncertainty.",
        targetFormat: "asciidoc",
        documentKind: "operator manual",
        audience: "operators-and-maintainers",
        tone: "task-oriented-technical",
        mustCiteNoteTitles: true,
        mustPreserveUncertainty: true,
        mustNotInventFacts: true,
        mustIncludeProvenance: true,
        mustSurfaceConflicts: true,
      },
    }),
  };
}

async function loadNotesConfigProfiles(
  workspaceRoot: string,
  configPath: string | undefined,
): Promise<Record<string, CxNotesExtractProfileConfig>> {
  const resolvedConfigPath = path.resolve(
    workspaceRoot,
    configPath ?? "cx.toml",
  );
  if (!(await pathExists(resolvedConfigPath))) {
    return {};
  }

  const config = await loadCxConfig(
    resolvedConfigPath,
    {},
    {},
    {
      emitBehaviorLogs: false,
    },
  );
  return config.notes.profiles;
}

function noteMatchesRequiredReference(
  note: {
    id: string;
    title: string;
    aliases: string[];
  },
  requiredReference: string,
): boolean {
  const normalizedReference = requiredReference.trim().toLowerCase();
  if (normalizedReference.length === 0) {
    return false;
  }

  return [note.id, note.title, ...note.aliases].some(
    (candidate) => candidate.trim().toLowerCase() === normalizedReference,
  );
}

function assignSection(
  noteTags: string[],
  profile: CxNotesExtractProfileConfig,
): string {
  const tagSet = normalizeTagSet(noteTags);
  for (const sectionId of profile.sectionOrder) {
    const sectionTags = profile.sectionTags[sectionId] ?? [];
    if (sectionTags.some((tag) => tagSet.has(tag))) {
      return sectionId;
    }
  }

  return "reference-notes";
}

async function loadSelectedNotes(params: {
  notesDir: string;
  workspaceRoot: string;
  profile: CxNotesExtractProfileConfig;
}): Promise<NotesExtractNote[]> {
  const validation = await validateNotes(params.notesDir, params.workspaceRoot);
  if (!validation.valid) {
    const reasons = [
      ...validation.errors.map(
        (entry) => `${path.basename(entry.filePath)}: ${entry.error}`,
      ),
      ...validation.duplicateIds.map(
        (entry) =>
          `duplicate note id ${entry.id}: ${entry.files.map((file) => path.basename(file)).join(", ")}`,
      ),
    ];
    throw new CxError(
      `Notes extraction requires a valid notes graph. ${reasons.join(" | ")}`,
      2,
    );
  }

  const selectionTags = selectionTagsForProfile(params.profile);

  const selectedMetadata = validation.notes.filter((note) => {
    if (!params.profile.includeTargets.includes(note.target)) {
      return false;
    }

    const tagSet = normalizeTagSet(note.tags ?? []);
    if (
      params.profile.excludeTags.length > 0 &&
      params.profile.excludeTags.some((tag) => tagSet.has(tag))
    ) {
      return false;
    }

    if (selectionTags.size === 0) {
      return false;
    }

    return [...selectionTags].some((tag) => tagSet.has(tag));
  });

  const selectedIds = new Set(selectedMetadata.map((note) => note.id));
  const selectedNotes = await Promise.all(
    selectedMetadata.map((note) =>
      readNote(note.id, {
        notesDir: params.notesDir,
        workspaceRoot: params.workspaceRoot,
      }),
    ),
  );

  for (const requiredReference of params.profile.requiredNotes) {
    const alreadySelected = selectedNotes.some((note) =>
      noteMatchesRequiredReference(note, requiredReference),
    );
    if (alreadySelected) {
      continue;
    }

    const requiredMetadata = validation.notes.find((note) =>
      noteMatchesRequiredReference(
        {
          id: note.id,
          title: note.title,
          aliases: note.aliases ?? [],
        },
        requiredReference,
      ),
    );
    if (!requiredMetadata) {
      throw new CxError(
        `notes.profiles contains unresolved required note reference: ${requiredReference}`,
        2,
      );
    }

    selectedIds.add(requiredMetadata.id);
    selectedNotes.push(
      await readNote(requiredMetadata.id, {
        notesDir: params.notesDir,
        workspaceRoot: params.workspaceRoot,
      }),
    );
  }

  const sectionOrder = new Map(
    params.profile.sectionOrder.map((sectionId, index) => [sectionId, index]),
  );

  return selectedNotes
    .filter(
      (note, index, notes) =>
        notes.findIndex((entry) => entry.id === note.id) === index,
    )
    .map((note) => {
      const assignedSection = assignSection(note.tags, params.profile);
      const noteLinks = extractWikilinkReferences(note.body)
        .map((reference) => reference.target)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((left, right) => left.localeCompare(right, "en"));

      return {
        id: note.id,
        title: note.title,
        path: path
          .relative(params.workspaceRoot, note.filePath)
          .replaceAll(path.sep, "/"),
        target: note.target,
        aliases: [...note.aliases],
        tags: [...note.tags].sort((left, right) =>
          left.localeCompare(right, "en"),
        ),
        summary: note.summary,
        codeLinks: [
          ...new Set([
            ...note.codeLinks,
            ...extractCodePathReferences(note.body),
          ]),
        ].sort((left, right) => left.localeCompare(right, "en")),
        noteLinks,
        sections: splitSections(note.body),
        body: note.body.trim(),
        assignedSection,
        assignedSectionTitle: renderSectionTitle(assignedSection),
      } satisfies NotesExtractNote;
    })
    .sort((left, right) => {
      const leftSection =
        sectionOrder.get(left.assignedSection) ?? Number.MAX_SAFE_INTEGER;
      const rightSection =
        sectionOrder.get(right.assignedSection) ?? Number.MAX_SAFE_INTEGER;
      return (
        leftSection - rightSection ||
        TARGET_PRIORITY[left.target] - TARGET_PRIORITY[right.target] ||
        left.title.localeCompare(right.title, "en") ||
        left.id.localeCompare(right.id, "en")
      );
    });
}

function buildBundle(params: {
  workspaceRoot: string;
  profileName: string;
  profile: CxNotesExtractProfileConfig;
  notes: NotesExtractNote[];
  format: CxNotesExtractFormat;
}): NotesExtractBundle {
  const sections = params.profile.sectionOrder.map((sectionId) => {
    const notesInSection = params.notes.filter(
      (note) => note.assignedSection === sectionId,
    );

    return {
      id: sectionId,
      title: renderSectionTitle(sectionId),
      noteCount: notesInSection.length,
      noteIds: notesInSection.map((note) => note.id),
    } satisfies NotesExtractBundleSection;
  });

  return {
    version: "1",
    profile: {
      name: params.profileName,
      description: params.profile.description,
      outputFormat: params.format,
      targetPaths: [...params.profile.targetPaths],
      includeTargets: [...params.profile.includeTargets],
      includeTags: [...params.profile.includeTags],
      excludeTags: [...params.profile.excludeTags],
      requiredNotes: [...params.profile.requiredNotes],
      requiredSections: [...params.profile.sectionOrder],
    },
    authoringContract: { ...params.profile.llm },
    provenance: {
      canonicalSource: "notes",
      sourceGlob: "notes/**/*.md",
      workspaceRoot: params.workspaceRoot,
      generationCommand: `cx notes extract --profile ${params.profileName} --format ${params.format}`,
    },
    sections,
    notes: params.notes,
  };
}

function renderMarkdownBundle(bundle: NotesExtractBundle): string {
  const machinePayload = JSON.stringify(bundle, null, 2);
  const lines: string[] = [
    "<!-- cx-notes-llm-bundle:v1 -->",
    `<!-- profile: ${bundle.profile.name} -->`,
    `<!-- canonical: ${bundle.provenance.canonicalSource} -->`,
    `<!-- source: ${bundle.provenance.sourceGlob} -->`,
    `<!-- target_paths: ${bundle.profile.targetPaths.join(", ")} -->`,
    "",
    "# CX Notes LLM Bundle",
    "",
    "## Profile",
    `- Name: ${bundle.profile.name}`,
    `- Description: ${bundle.profile.description}`,
    `- Output format: ${bundle.authoringContract.targetFormat}`,
    `- Document kind: ${bundle.authoringContract.documentKind}`,
    `- Audience: ${bundle.authoringContract.audience}`,
    `- Tone: ${bundle.authoringContract.tone}`,
    `- Target paths: ${bundle.profile.targetPaths.join(", ")}`,
    "",
    "## Authoring Contract",
    `- System role: ${bundle.authoringContract.systemRole}`,
    ...renderMarkdownList(
      bundle.authoringContract.instructions
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      "No additional free-form instructions.",
    ),
    `- Must cite note titles: ${bundle.authoringContract.mustCiteNoteTitles ? "yes" : "no"}`,
    `- Must preserve uncertainty: ${bundle.authoringContract.mustPreserveUncertainty ? "yes" : "no"}`,
    `- Must not invent facts: ${bundle.authoringContract.mustNotInventFacts ? "yes" : "no"}`,
    `- Must include provenance: ${bundle.authoringContract.mustIncludeProvenance ? "yes" : "no"}`,
    `- Must surface conflicts: ${bundle.authoringContract.mustSurfaceConflicts ? "yes" : "no"}`,
    "",
    "## Required Sections",
    ...bundle.sections.map(
      (section, index) => `${index + 1}. ${section.title}`,
    ),
    "",
    "## Provenance",
    `- Canonical source: ${bundle.provenance.canonicalSource}`,
    `- Source glob: ${bundle.provenance.sourceGlob}`,
    `- Generation command: ${bundle.provenance.generationCommand}`,
    "",
    "## Machine Payload",
    MARKDOWN_PAYLOAD_START,
    "```json",
    machinePayload,
    "```",
    MARKDOWN_PAYLOAD_END,
    "",
    "## Canonical Notes",
  ];

  for (const section of bundle.sections) {
    lines.push("");
    lines.push(`### Section: ${section.title}`);
    lines.push(`- Section id: ${section.id}`);
    lines.push(`- Note count: ${section.noteCount}`);

    const notes = bundle.notes.filter(
      (note) => note.assignedSection === section.id,
    );
    for (const note of notes) {
      lines.push("");
      lines.push(`#### Note: ${note.title}`);
      lines.push(`- Note id: ${note.id}`);
      lines.push(`- Path: ${note.path}`);
      lines.push(`- Target: ${note.target}`);
      lines.push(`- Tags: ${note.tags.join(", ") || "(none)"}`);
      lines.push(`- Aliases: ${note.aliases.join(", ") || "(none)"}`);
      lines.push(`- Code links: ${note.codeLinks.join(", ") || "(none)"}`);
      lines.push(`- Note links: ${note.noteLinks.join(", ") || "(none)"}`);
      lines.push("");
      lines.push("##### Summary");
      lines.push(note.summary);

      for (const noteSection of note.sections) {
        lines.push("");
        lines.push(`##### ${noteSection.title}`);
        lines.push(noteSection.content);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderXmlBundle(bundle: NotesExtractBundle): string {
  const machinePayload = JSON.stringify(bundle, null, 2);
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<cx-notes-bundle version="1">',
    `  <profile name="${escapeXml(bundle.profile.name)}">`,
    `    <description>${escapeXml(bundle.profile.description)}</description>`,
    `    <output-format>${escapeXml(bundle.authoringContract.targetFormat)}</output-format>`,
    `    <document-kind>${escapeXml(bundle.authoringContract.documentKind)}</document-kind>`,
    `    <audience>${escapeXml(bundle.authoringContract.audience)}</audience>`,
    `    <tone>${escapeXml(bundle.authoringContract.tone)}</tone>`,
  ];

  for (const targetPath of bundle.profile.targetPaths) {
    lines.push(`    <target-path>${escapeXml(targetPath)}</target-path>`);
  }

  lines.push("  </profile>");
  lines.push("  <authoring-contract>");
  lines.push(
    `    <system-role>${escapeXml(bundle.authoringContract.systemRole)}</system-role>`,
  );
  lines.push(
    `    <instructions>${escapeXml(bundle.authoringContract.instructions)}</instructions>`,
  );
  lines.push(
    `    <must-cite-note-titles>${bundle.authoringContract.mustCiteNoteTitles}</must-cite-note-titles>`,
  );
  lines.push(
    `    <must-preserve-uncertainty>${bundle.authoringContract.mustPreserveUncertainty}</must-preserve-uncertainty>`,
  );
  lines.push(
    `    <must-not-invent-facts>${bundle.authoringContract.mustNotInventFacts}</must-not-invent-facts>`,
  );
  lines.push(
    `    <must-include-provenance>${bundle.authoringContract.mustIncludeProvenance}</must-include-provenance>`,
  );
  lines.push(
    `    <must-surface-conflicts>${bundle.authoringContract.mustSurfaceConflicts}</must-surface-conflicts>`,
  );
  lines.push("  </authoring-contract>");
  lines.push("  <provenance>");
  lines.push(
    `    <canonical-source>${bundle.provenance.canonicalSource}</canonical-source>`,
  );
  lines.push(`    <source-glob>${bundle.provenance.sourceGlob}</source-glob>`);
  lines.push(
    `    <generation-command>${escapeXml(bundle.provenance.generationCommand)}</generation-command>`,
  );
  lines.push("  </provenance>");
  lines.push("  <required-sections>");

  for (const section of bundle.sections) {
    lines.push(
      `    <section id="${escapeXml(section.id)}" note-count="${section.noteCount}">${escapeXml(section.title)}</section>`,
    );
  }

  lines.push("  </required-sections>");
  lines.push("  <notes>");

  for (const note of bundle.notes) {
    lines.push(
      `    <note id="${escapeXml(note.id)}" target="${escapeXml(note.target)}" section="${escapeXml(note.assignedSection)}" path="${escapeXml(note.path)}">`,
    );
    lines.push(`      <title>${escapeXml(note.title)}</title>`);
    lines.push(`      <summary>${escapeXml(note.summary)}</summary>`);
    lines.push("      <aliases>");
    for (const alias of note.aliases) {
      lines.push(`        <alias>${escapeXml(alias)}</alias>`);
    }
    lines.push("      </aliases>");
    lines.push("      <tags>");
    for (const tag of note.tags) {
      lines.push(`        <tag>${escapeXml(tag)}</tag>`);
    }
    lines.push("      </tags>");
    lines.push("      <code-links>");
    for (const codeLink of note.codeLinks) {
      lines.push(`        <code-link>${escapeXml(codeLink)}</code-link>`);
    }
    lines.push("      </code-links>");
    lines.push("      <note-links>");
    for (const noteLink of note.noteLinks) {
      lines.push(`        <note-link>${escapeXml(noteLink)}</note-link>`);
    }
    lines.push("      </note-links>");
    lines.push("      <sections>");
    for (const noteSection of note.sections) {
      lines.push(
        `        <section key="${escapeXml(noteSection.key)}" title="${escapeXml(noteSection.title)}">${escapeXml(noteSection.content)}</section>`,
      );
    }
    lines.push("      </sections>");
    lines.push("    </note>");
  }

  lines.push("  </notes>");
  lines.push(
    `  <machine-payload format="json">${escapeXml(machinePayload)}</machine-payload>`,
  );
  lines.push("</cx-notes-bundle>");
  return `${lines.join("\n")}\n`;
}

function renderPlainBundle(bundle: NotesExtractBundle): string {
  const machinePayload = JSON.stringify(bundle, null, 2);
  const lines: string[] = [
    `CX NOTES BUNDLE v${bundle.version}`,
    `PROFILE ${bundle.profile.name}`,
    `DOCUMENT KIND ${bundle.authoringContract.documentKind}`,
    `TARGET PATHS ${bundle.profile.targetPaths.join(", ")}`,
    `GENERATION COMMAND ${bundle.provenance.generationCommand}`,
    "",
    "AUTHORING CONTRACT",
    `SYSTEM ROLE ${bundle.authoringContract.systemRole}`,
    ...bundle.authoringContract.instructions
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
    "",
    PLAIN_PAYLOAD_START,
    machinePayload,
    PLAIN_PAYLOAD_END,
    "",
  ];

  for (const section of bundle.sections) {
    lines.push(`SECTION ${section.title} (${section.id})`);
    for (const note of bundle.notes.filter(
      (entry) => entry.assignedSection === section.id,
    )) {
      lines.push(`NOTE ${note.id} ${note.title}`);
      lines.push(`PATH ${note.path}`);
      lines.push(`TARGET ${note.target}`);
      lines.push(`SUMMARY ${note.summary}`);
      for (const noteSection of note.sections) {
        lines.push(`${noteSection.title.toUpperCase()} ${noteSection.content}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderBundleContent(
  bundle: NotesExtractBundle,
  format: CxNotesExtractFormat,
): string {
  switch (format) {
    case "markdown":
      return renderMarkdownBundle(bundle);
    case "xml":
      return renderXmlBundle(bundle);
    case "plain":
      return renderPlainBundle(bundle);
  }
}

function extractMachinePayload(
  content: string,
  bundlePath: string | undefined,
): string {
  const markdownMatch = content.match(
    /<!-- cx-notes-bundle-payload:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- cx-notes-bundle-payload:end -->/,
  );
  if (markdownMatch?.[1]) {
    return markdownMatch[1].trim();
  }

  const xmlMatch = content.match(
    /<machine-payload format="json">([\s\S]*?)<\/machine-payload>/,
  );
  if (xmlMatch?.[1]) {
    return unescapeXml(xmlMatch[1].trim());
  }

  const plainMatch = content.match(
    /CX NOTES MACHINE PAYLOAD START\s*([\s\S]*?)\s*CX NOTES MACHINE PAYLOAD END/,
  );
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  throw new CxError(
    `Notes extract bundle is missing its machine payload${bundlePath ? `: ${bundlePath}` : "."}`,
    2,
  );
}

function isNotesExtractBundle(value: unknown): value is NotesExtractBundle {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<NotesExtractBundle>;
  return (
    candidate.version === "1" &&
    typeof candidate.profile?.name === "string" &&
    Array.isArray(candidate.profile?.targetPaths) &&
    typeof candidate.authoringContract?.documentKind === "string" &&
    typeof candidate.provenance?.generationCommand === "string" &&
    Array.isArray(candidate.sections) &&
    Array.isArray(candidate.notes)
  );
}

export function parseNotesExtractBundleContent(
  content: string,
  bundlePath?: string,
): NotesExtractBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractMachinePayload(content, bundlePath));
  } catch (error) {
    const resolved =
      error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new CxError(
      `Notes extract bundle contains an invalid machine payload${bundlePath ? `: ${bundlePath}` : ""}. ${resolved}`,
      2,
    );
  }

  if (!isNotesExtractBundle(parsed)) {
    throw new CxError(
      `Notes extract bundle payload does not match the expected contract${bundlePath ? `: ${bundlePath}` : ""}.`,
      2,
    );
  }

  return parsed;
}

function defaultOutputPath(
  workspaceRoot: string,
  profileName: string,
  format: CxNotesExtractFormat,
): string {
  const extension =
    format === "markdown" ? "md" : format === "xml" ? "xml" : "txt";
  return path.join(
    workspaceRoot,
    "dist",
    `notes-${profileName}.llm.${extension}`,
  );
}

export async function compileNotesExtractBundle(
  options: CompileNotesExtractBundleOptions,
): Promise<CompileNotesExtractBundleResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const configuredProfiles = await loadNotesConfigProfiles(
    workspaceRoot,
    options.configPath,
  );
  const profiles = {
    ...getBuiltinNotesExtractProfiles(),
    ...configuredProfiles,
  };
  const profile = profiles[options.profileName];

  if (!profile) {
    throw new CxError(
      `Unknown notes extract profile: ${options.profileName}. Available profiles: ${Object.keys(
        profiles,
      )
        .sort((left, right) => left.localeCompare(right, "en"))
        .join(", ")}`,
      2,
    );
  }

  const format = options.format ?? profile.outputFormat;
  const notes = await loadSelectedNotes({
    notesDir: "notes",
    workspaceRoot,
    profile,
  });
  const bundle = buildBundle({
    workspaceRoot,
    profileName: options.profileName,
    profile,
    notes,
    format,
  });
  const content = renderBundleContent(bundle, format);
  const outputPath = path.resolve(
    workspaceRoot,
    options.outputPath ??
      defaultOutputPath(workspaceRoot, options.profileName, format),
  );

  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, content, "utf8");

  return {
    bundle,
    content,
    outputPath,
    format,
  };
}
