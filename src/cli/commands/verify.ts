import path from "node:path";

import { VerifyError, verifyBundle } from "../../bundle/verify.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { CxError } from "../../shared/errors.js";
import { writeJson } from "../../shared/output.js";

export interface VerifyArgs {
  bundleDir: string;
  files?: string[] | undefined;
  json?: boolean | undefined;
  sections?: string[] | undefined;
  againstDir?: string | undefined;
}

export async function runVerifyCommand(args: VerifyArgs): Promise<number> {
  const bundleDir = path.resolve(args.bundleDir);
  const againstDir = args.againstDir
    ? path.resolve(args.againstDir)
    : undefined;
  const selection = {
    sections: args.sections,
    files: args.files,
  };

  try {
    await verifyBundle(bundleDir, againstDir, selection);
    if (args.json ?? false) {
      writeJson({
        bundleDir,
        againstDir: againstDir ?? null,
        sections: args.sections ?? [],
        files: args.files ?? [],
        repomix: getRepomixCapabilities(),
        valid: true,
      });
    }
    return 0;
  } catch (error) {
    if (args.json ?? false) {
      const resolvedError =
        error instanceof Error ? error : new Error(String(error));
      const payload: {
        bundleDir: string;
        againstDir: string | null;
        sections: string[];
        files: string[];
        repomix: ReturnType<typeof getRepomixCapabilities>;
        valid: false;
        error: {
          type?: string;
          message: string;
          path?: string;
        };
      } = {
        bundleDir,
        againstDir: againstDir ?? null,
        sections: args.sections ?? [],
        files: args.files ?? [],
        repomix: getRepomixCapabilities(),
        valid: false,
        error: {
          message: resolvedError.message,
        },
      };

      if (error instanceof VerifyError) {
        payload.error.type = error.type;
        if (error.relativePath) {
          payload.error.path = error.relativePath;
        }
      }

      writeJson(payload);
      return error instanceof CxError ? error.exitCode : 1;
    }

    throw error;
  }
}
