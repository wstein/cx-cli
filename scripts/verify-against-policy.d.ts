export type AgainstDirVerifyTest = {
  relativePath: string;
  testName: string;
  line: number;
  reason: string | undefined;
};

export const VERIFY_AGAINST_TAG_PREFIX: string;

export function collectAgainstDirVerifyTests(
  rootDir?: string,
): AgainstDirVerifyTest[];

export function validateAgainstDirVerifyPolicy(rootDir?: string): {
  entries: AgainstDirVerifyTest[];
  missingJustifications: string[];
};
