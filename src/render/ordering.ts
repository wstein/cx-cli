import type { StructuredRenderPlan } from "./types.js";

export function validatePlanOrdering(plan: StructuredRenderPlan): boolean {
  for (let i = 1; i < plan.ordering.length; i++) {
    const current = plan.ordering[i];
    const previous = plan.ordering[i - 1];
    if (current && previous && current <= previous) {
      return false;
    }
  }

  return true;
}
