export type StabilityTier = "STABLE" | "BETA" | "EXPERIMENTAL" | "INTERNAL";

export function tierLabel(tier: StabilityTier): string {
  return `[${tier}]`;
}
