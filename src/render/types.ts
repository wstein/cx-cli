import type { CxConfig, CxStyle } from "../config/types.js";
import type { CommandIo } from "../shared/output.js";

export interface StructuredRenderEntry {
  path: string;
  content: string;
  sha256: string;
  tokenCount: number;
}

export interface StructuredRenderPlan {
  entries: StructuredRenderEntry[];
  ordering: string[];
}

export interface RenderFileSpan {
  outputStartLine: number;
  outputEndLine: number;
}

export interface RenderSectionInput {
  config: CxConfig;
  style: CxStyle;
  sourceRoot: string;
  outputPath: string;
  sectionName: string;
  explicitFiles: string[];
  bundleIndexFile?: string;
  requireStructured?: boolean;
  requireOutputSpans?: boolean;
  io?: Partial<CommandIo>;
}

export interface RenderSectionResult {
  outputText: string;
  outputTokenCount: number;
  fileTokenCounts: Map<string, number>;
  fileContentHashes: Map<string, string>;
  fileSpans?: Map<string, RenderFileSpan>;
  structuredPlan?: StructuredRenderPlan;
  planHash?: string;
  warnings: string[];
}

export interface RenderEngine {
  renderSection(input: RenderSectionInput): Promise<RenderSectionResult>;
}
