import { renderSectionWithAdapterOracle } from "../adapter/oracleRender.js";
import { createNativeRenderSectionFn } from "./native/section.js";
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

export function createAdapterOracleRenderEngine(): RenderEngine {
  return new AdapterBackedRenderEngine(renderSectionWithAdapterOracle);
}

export function createNativeRenderEngine(): RenderEngine {
  return new AdapterBackedRenderEngine(createNativeRenderSectionFn());
}

export const defaultRenderEngine = createNativeRenderEngine();
