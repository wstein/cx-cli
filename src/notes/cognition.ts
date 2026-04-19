import {
  extractCodePathReferences,
  extractWikilinkReferences,
  looksLikeCodePath,
} from "./linking.js";

export type NoteCognitionLabel = "high_signal" | "review" | "low_signal";
export type NoteTrustLevel = "conditional";

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
  templateBoilerplateDetected: boolean;
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

export function hasNonTrivialSummary(summary: string): boolean {
  return countSummaryWords(summary) >= MIN_SUMMARY_WORDS;
}

export function assessNoteCognition(
  body: string,
  summary: string,
  codeLinks: string[] = extractCodePathReferences(body),
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

  let score = 0;

  score += summaryWordCount >= 12 ? 35 : summaryWordCount >= 6 ? 25 : 0;
  score += evidenceLinkCount >= 3 ? 30 : evidenceLinkCount >= 1 ? 18 : 0;
  score += structureCount === 3 ? 25 : structureCount === 2 ? 18 : 0;
  score += templateBoilerplateDetected ? 0 : 10;

  return {
    summaryWordCount,
    noteLinkCount: noteLinks.size,
    codeLinkCount: codeLinks.length,
    localLinkCount: localLinks.size,
    evidenceLinkCount,
    structureSignals,
    templateBoilerplateDetected,
    score,
    label: determineScoreLabel(score),
    trustLevel: "conditional",
  };
}
