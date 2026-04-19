import { renderSectionWithRepomix } from "../repomix/render.js";
import type {
  RenderEngine,
  RenderSectionInput,
  RenderSectionResult,
} from "./types.js";

export type RenderSectionFn = (
  input: RenderSectionInput,
) => Promise<RenderSectionResult>;

export class AdapterBackedRenderEngine implements RenderEngine {
  constructor(private readonly renderSectionFn: RenderSectionFn) {}

  renderSection(input: RenderSectionInput): Promise<RenderSectionResult> {
    return this.renderSectionFn(input);
  }
}

export function createRepomixRenderEngine(): RenderEngine {
  return new AdapterBackedRenderEngine(renderSectionWithRepomix);
}

export const defaultRenderEngine = createRepomixRenderEngine();
