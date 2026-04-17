import path from "node:path";

export interface SnapshotScrubOptions {
  rootDir?: string;
  normalizePaths?: boolean;
  stripTimestamps?: boolean;
  stripHashes?: boolean;
  stripVersions?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<SnapshotScrubOptions, "rootDir">> = {
  normalizePaths: true,
  stripTimestamps: true,
  stripHashes: false,
  stripVersions: false,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function scrubTextSnapshot(
  input: string,
  options: SnapshotScrubOptions = {},
): string {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  let output = input;

  if (resolved.rootDir) {
    const normalizedRoot = resolved.rootDir.replace(/\\/g, "/");
    const rootPatterns = [
      normalizedRoot,
      path.resolve(normalizedRoot),
      resolved.rootDir,
      path.resolve(resolved.rootDir),
    ];
    for (const pattern of rootPatterns) {
      output = output.replace(new RegExp(escapeRegExp(pattern), "g"), "<ROOT>");
    }
  }

  if (resolved.normalizePaths) {
    output = output.replace(/\\/g, "/");
  }

  if (resolved.stripTimestamps) {
    output = output.replace(
      /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g,
      "<TIMESTAMP>",
    );
  }

  if (resolved.stripHashes) {
    output = output.replace(/\b[a-f0-9]{64}\b/gi, "<SHA256>");
  }

  if (resolved.stripVersions) {
    output = output.replace(/\b\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?\b/g, "<VERSION>");
  }

  return output;
}

export function scrubObjectSnapshot<T>(
  input: T,
  options: SnapshotScrubOptions = {},
): T {
  const json = JSON.stringify(input);
  const scrubbed = scrubTextSnapshot(json, options);
  return JSON.parse(scrubbed) as T;
}