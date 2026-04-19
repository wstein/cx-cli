export const DEFAULT_INPUT_PATH: string;
export const DEFAULT_OUTPUT_PATH: string;

export function generateCoverageSummaryMarkdown(options?: {
  inputPath?: string;
  outputPath?: string;
}): Promise<string>;
