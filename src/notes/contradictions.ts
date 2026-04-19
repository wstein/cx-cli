import fs from "node:fs/promises";
import path from "node:path";

import type { NoteCodePathWarning } from "./consistency.js";
import type { NoteMetadata } from "./validate.js";

export type NoteContradictionKind =
  | "code_state_conflict"
  | "sibling_claim_conflict";
type ClaimPolarity = "present" | "missing";

export interface NoteContradictionIssue {
  kind: NoteContradictionKind;
  noteId: string;
  noteTitle: string;
  subject: string;
  reason: string;
  conflictingNoteId?: string;
  conflictingNoteTitle?: string;
}

interface CodePathClaim {
  noteId: string;
  noteTitle: string;
  path: string;
  polarity: ClaimPolarity;
}

const NEGATIVE_CLAIM_PATTERNS = [
  /\bmissing\b/iu,
  /\babsent\b/iu,
  /\bremoved\b/iu,
  /\bdeleted\b/iu,
  /\bgone\b/iu,
  /\bnot present\b/iu,
  /\bno longer exists\b/iu,
  /\bdoes not exist\b/iu,
];
const POSITIVE_CLAIM_PATTERNS = [
  /\bexists\b/iu,
  /\bpresent\b/iu,
  /\bimplemented\b/iu,
  /\bdefined\b/iu,
  /\bavailable\b/iu,
  /\bactive\b/iu,
  /\brequired\b/iu,
];

function stripClaimNoise(text: string): string {
  return text
    .replace(/\[\[[^\]]+\]\]/gu, " PATH ")
    .replace(/`[^`]+`/gu, " PATH ");
}

function detectClaimPolarity(text: string): ClaimPolarity | null {
  const normalizedText = stripClaimNoise(text);
  const hasNegative = NEGATIVE_CLAIM_PATTERNS.some((pattern) =>
    pattern.test(normalizedText),
  );
  const hasPositive = POSITIVE_CLAIM_PATTERNS.some((pattern) =>
    pattern.test(normalizedText),
  );

  if (hasNegative) {
    return "missing";
  }

  if (hasPositive) {
    return "present";
  }

  return null;
}

async function extractCodePathClaims(
  note: NoteMetadata,
): Promise<CodePathClaim[]> {
  if (note.codeLinks.length === 0) {
    return [];
  }

  let content: string;
  try {
    content = await fs.readFile(note.filePath, "utf8");
  } catch {
    return [];
  }

  const claims: CodePathClaim[] = [];
  for (const line of content.split(/\r?\n/u)) {
    for (const codePath of note.codeLinks) {
      if (!line.includes(codePath)) {
        continue;
      }

      const polarity = detectClaimPolarity(line);
      if (!polarity) {
        continue;
      }

      claims.push({
        noteId: note.id,
        noteTitle: note.title,
        path: codePath,
        polarity,
      });
    }
  }

  return claims;
}

export async function collectNoteContradictions(
  notes: NoteMetadata[],
  projectRoot: string,
  codePathWarnings: NoteCodePathWarning[],
): Promise<NoteContradictionIssue[]> {
  const issues: NoteContradictionIssue[] = [];
  const warningsByNotePath = new Map(
    codePathWarnings.map((warning) => [
      `${warning.fromNoteId}:${warning.path}`,
      warning,
    ]),
  );
  const claims = (
    await Promise.all(notes.map((note) => extractCodePathClaims(note)))
  )
    .flat()
    .sort((left, right) =>
      `${left.noteId}:${left.path}`.localeCompare(
        `${right.noteId}:${right.path}`,
      ),
    );

  for (const claim of claims) {
    const warning = warningsByNotePath.get(`${claim.noteId}:${claim.path}`);
    const fileExists = await fs
      .access(path.join(projectRoot, claim.path))
      .then(() => true)
      .catch(() => false);

    if (claim.polarity === "present" && warning?.status === "missing") {
      issues.push({
        kind: "code_state_conflict",
        noteId: claim.noteId,
        noteTitle: claim.noteTitle,
        subject: claim.path,
        reason:
          "Note says the code path is present, but the repository path is missing.",
      });
    }

    if (claim.polarity === "missing" && !warning && fileExists) {
      issues.push({
        kind: "code_state_conflict",
        noteId: claim.noteId,
        noteTitle: claim.noteTitle,
        subject: claim.path,
        reason:
          "Note says the code path is missing, but the repository path exists.",
      });
    }
  }

  const claimsByPath = new Map<string, CodePathClaim[]>();
  for (const claim of claims) {
    const entries = claimsByPath.get(claim.path) ?? [];
    entries.push(claim);
    claimsByPath.set(claim.path, entries);
  }

  for (const [subject, pathClaims] of claimsByPath) {
    const positiveClaims = pathClaims.filter(
      (claim) => claim.polarity === "present",
    );
    const negativeClaims = pathClaims.filter(
      (claim) => claim.polarity === "missing",
    );
    if (positiveClaims.length === 0 || negativeClaims.length === 0) {
      continue;
    }

    for (const positive of positiveClaims) {
      for (const negative of negativeClaims) {
        if (positive.noteId === negative.noteId) {
          continue;
        }

        issues.push({
          kind: "sibling_claim_conflict",
          noteId: positive.noteId,
          noteTitle: positive.noteTitle,
          subject,
          reason:
            "This note claims the code path is present while another note claims it is missing.",
          conflictingNoteId: negative.noteId,
          conflictingNoteTitle: negative.noteTitle,
        });
      }
    }
  }

  return issues.sort((left, right) =>
    `${left.noteId}:${left.subject}:${left.kind}`.localeCompare(
      `${right.noteId}:${right.subject}:${right.kind}`,
    ),
  );
}
