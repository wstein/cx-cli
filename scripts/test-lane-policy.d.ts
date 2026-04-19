export const ROOT: string;
export const ALLOWED_LANES: Set<string>;
export const ADVERSARIAL_OVERRIDES: Set<string>;
export function collectTestFiles(dir: string): string[];
export function expectedLane(relativePath: string): string;
export function parseLaneHeader(content: string): string | undefined;
export function validateTestLaneHeaders(rootDir?: string): {
  files: string[];
  mismatches: string[];
};
