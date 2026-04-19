import {
  extractCodePathReferences,
  extractWikilinkReferences,
  looksLikeCodePath,
} from "./linking.js";
import { parseNoteIdTimestamp } from "./parser.js";

export type NoteCognitionLabel = "high_signal" | "review" | "low_signal";
export type NoteTrustLevel = "conditional";
export type NoteStalenessLabel = "fresh" | "aging" | "stale";

export interface NoteCognitionAssessment {
  summaryWordCount: number;
  noteLinkCount: number;
  codeLinkCount: number;
  localLinkCount: number;
  evidenceLinkCount: number;
  structureSignals: {
    what: boolean;
    why: boolean;
    how: boolean;
  };
  ageDays: number;
  stalenessLabel: NoteStalenessLabel;
  agePenalty: number;
  driftWarningCount: number;
  driftPenalty: number;
  contradictionCount: number;
  contradictionPenalty: number;
  templateBoilerplateDetected: boolean;
  baseScore: number;
  score: number;
  label: NoteCognitionLabel;
  trustLevel: NoteTrustLevel;
}

const MIN_SUMMARY_WORDS = 6;

const TEMPLATE_PHRASES = [
  "Summarize the note in one or two sentences so agents can route to it quickly from the manifest.",
  "State the durable fact, mechanism, decision, or failure mode.",
  "Explain the invariant, constraint, or tradeoff this note protects.",
  "Describe how an operator, reviewer, or later agent should apply it.",
];

const LOCAL_MARKDOWN_LINK_REGEX =
  /\[[^\]]+\]\(((?:\.\.\/|\.\/|[A-Za-z0-9._-]+\/)[^)]+)\)/gu;
const BULLET_PATH_REGEX =
  /^\s*[-*+]\s+`?([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.[A-Za-z0-9._-]+)`?(?:\s+-.*)?$/u;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function countSummaryWords(summary: string): number {
  return summary
    .trim()
    .split(/\s+/u)
    .map((word) => word.trim())
    .filter((word) => word.length > 0).length;
}

function extractLocalMarkdownLinks(body: string): string[] {
  const links = new Set<string>();

  for (const match of body.matchAll(LOCAL_MARKDOWN_LINK_REGEX)) {
    const target = (match[1] ?? "").trim();
    if (
      target.length === 0 ||
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:") ||
      target.startsWith("#")
    ) {
      continue;
    }

    links.add(target.replace(/^\.\/+/u, ""));
  }

  return [...links].sort();
}

function extractBulletPathLinks(body: string): string[] {
  const links = new Set<string>();

  for (const line of body.split(/\r?\n/u)) {
    const match = line.match(BULLET_PATH_REGEX);
    const target = match?.[1]?.trim();
    if (!target) {
      continue;
    }

    links.add(target.replace(/^\.\/+/u, ""));
  }

  return [...links].sort();
}

function detectTemplateBoilerplate(body: string): boolean {
  const normalizedBody = body.toLowerCase();
  return TEMPLATE_PHRASES.some((phrase) =>
    normalizedBody.includes(phrase.toLowerCase()),
  );
}

function determineScoreLabel(score: number): NoteCognitionLabel {
  if (score >= 80) {
    return "high_signal";
  }

  if (score >= 60) {
    return "review";
  }

  return "low_signal";
}

function determineStalenessLabel(ageDays: number): NoteStalenessLabel {
  if (ageDays >= 540) {
    return "stale";
  }

  if (ageDays >= 180) {
    return "aging";
  }

  return "fresh";
}

function determineAgePenalty(ageDays: number): number {
  const label = determineStalenessLabel(ageDays);

  if (label === "stale") {
    return 14;
  }

  if (label === "aging") {
    return 6;
  }

  return 0;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateAgeDays(noteId: string | undefined, now: Date): number {
  if (!noteId) {
    return 0;
  }

  const timestamp = parseNoteIdTimestamp(noteId);
  if (!timestamp) {
    return 0;
  }

  const diffMs = now.getTime() - timestamp.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.floor(diffMs / DAY_IN_MS);
}

export function applyDriftPressure(
  assessment: NoteCognitionAssessment,
  driftWarningCount: number,
): NoteCognitionAssessment {
  const normalizedDriftWarningCount = Math.max(0, driftWarningCount);
  const driftPenalty = Math.min(24, normalizedDriftWarningCount * 12);
  const score = clampScore(
    assessment.baseScore -
      assessment.agePenalty -
      driftPenalty -
      assessment.contradictionPenalty,
  );

  return {
    ...assessment,
    driftWarningCount: normalizedDriftWarningCount,
    driftPenalty,
    score,
    label: determineScoreLabel(score),
  };
}

export function applyContradictionPressure(
  assessment: NoteCognitionAssessment,
  contradictionCount: number,
): NoteCognitionAssessment {
  const normalizedContradictionCount = Math.max(0, contradictionCount);
  const contradictionPenalty = Math.min(30, normalizedContradictionCount * 15);
  const score = clampScore(
    assessment.baseScore -
      assessment.agePenalty -
      assessment.driftPenalty -
      contradictionPenalty,
  );

  return {
    ...assessment,
    contradictionCount: normalizedContradictionCount,
    contradictionPenalty,
    score,
    label: determineScoreLabel(score),
  };
}

export function hasNonTrivialSummary(summary: string): boolean {
  return countSummaryWords(summary) >= MIN_SUMMARY_WORDS;
}

export function assessNoteCognition(
  body: string,
  summary: string,
  codeLinks: string[] = extractCodePathReferences(body),
  options?: {
    noteId?: string;
    now?: Date;
    driftWarningCount?: number;
  },
): NoteCognitionAssessment {
  const noteLinks = new Set(
    extractWikilinkReferences(body)
      .map((reference) => reference.target)
      .filter((target) => !looksLikeCodePath(target))
      .map((target) => target.toLowerCase()),
  );
  const localLinks = new Set([
    ...extractLocalMarkdownLinks(body),
    ...extractBulletPathLinks(body),
  ]);
  const structureSignals = {
    what: /^##\s+What\b/imu.test(body),
    why: /^##\s+Why\b/imu.test(body),
    how: /^##\s+How\b/imu.test(body),
  };
  const summaryWordCount = countSummaryWords(summary);
  const evidenceLinkCount = noteLinks.size + codeLinks.length + localLinks.size;
  const structureCount = Object.values(structureSignals).filter(Boolean).length;
  const templateBoilerplateDetected = detectTemplateBoilerplate(body);
  const ageDays = calculateAgeDays(options?.noteId, options?.now ?? new Date());
  const stalenessLabel = determineStalenessLabel(ageDays);
  const agePenalty = determineAgePenalty(ageDays);

  let baseScore = 0;

  baseScore += summaryWordCount >= 12 ? 35 : summaryWordCount >= 6 ? 25 : 0;
  baseScore += evidenceLinkCount >= 3 ? 30 : evidenceLinkCount >= 1 ? 18 : 0;
  baseScore += structureCount === 3 ? 25 : structureCount === 2 ? 18 : 0;
  baseScore += templateBoilerplateDetected ? 0 : 10;

  return applyDriftPressure(
    {
      summaryWordCount,
      noteLinkCount: noteLinks.size,
      codeLinkCount: codeLinks.length,
      localLinkCount: localLinks.size,
      evidenceLinkCount,
      structureSignals,
      ageDays,
      stalenessLabel,
      agePenalty,
      driftWarningCount: 0,
      driftPenalty: 0,
      contradictionCount: 0,
      contradictionPenalty: 0,
      templateBoilerplateDetected,
      baseScore,
      score: clampScore(baseScore - agePenalty),
      label: determineScoreLabel(clampScore(baseScore - agePenalty)),
      trustLevel: "conditional",
    },
    options?.driftWarningCount ?? 0,
  );
}
