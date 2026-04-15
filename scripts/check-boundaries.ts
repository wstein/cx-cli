/**
 * Import boundary checker.
 *
 * Enforces the module layer rules documented in docs/ARCHITECTURE.md:
 *
 *   - mcp/** must not import from cli/commands/**
 *   - planning/** must not import from notes/**
 *
 * Run via: bun run scripts/check-boundaries.ts
 * Integrated into the `lint` npm script.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface Violation {
  file: string;
  importPath: string;
  rule: string;
}

interface BoundaryRule {
  /** Glob-style prefix of the importing module (relative to src/) */
  fromPrefix: string;
  /** Forbidden import prefix (relative to src/) */
  forbiddenPrefix: string;
  /** Human-readable description for the error message */
  description: string;
}

const RULES: BoundaryRule[] = [
  {
    fromPrefix: "mcp/",
    forbiddenPrefix: "cli/commands/",
    description:
      "mcp/ must not import from cli/commands/ (MCP is a transport layer, not a presentation consumer)",
  },
  {
    fromPrefix: "planning/",
    forbiddenPrefix: "notes/",
    description:
      "planning/ must not import from notes/ (note enrichment is an orchestration concern, not a planner concern)",
  },
];

/** Extract all static import/export-from specifiers from TypeScript source. */
function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  // Match: import ... from "..."  /  export ... from "..."
  const importRe =
    /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  m = importRe.exec(source);
  while (m !== null) {
    specifiers.push(m[1] as string);
    m = importRe.exec(source);
  }
  // Match bare: import "..."
  const bareRe = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  m = bareRe.exec(source);
  while (m !== null) {
    specifiers.push(m[1] as string);
    m = bareRe.exec(source);
  }
  return specifiers;
}

/**
 * Resolve a relative specifier to a src/-relative path, or return null for
 * non-relative (package) imports.
 */
function resolveToSrcRelative(
  importingFileSrcRelative: string,
  specifier: string,
): string | null {
  if (!specifier.startsWith(".")) return null;
  const dir = path.dirname(importingFileSrcRelative);
  const resolved = path.normalize(path.join(dir, specifier));
  // Strip any .js / .ts extension that crept in
  return resolved.replace(/\.(js|ts)$/, "");
}

async function collectTsFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (
      entry.isFile() &&
      /\.ts$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      results.push(path.join(entry.parentPath, entry.name));
    }
  }
  return results;
}

async function main(): Promise<void> {
  const srcDir = path.resolve(import.meta.dirname, "../src");
  const files = await collectTsFiles(srcDir);

  const violations: Violation[] = [];

  for (const absFile of files) {
    const srcRelative = path.relative(srcDir, absFile).replace(/\\/g, "/");
    const source = await readFile(absFile, "utf-8");
    const specifiers = extractImportSpecifiers(source);

    for (const rule of RULES) {
      if (!srcRelative.startsWith(rule.fromPrefix)) continue;

      for (const spec of specifiers) {
        const resolved = resolveToSrcRelative(srcRelative, spec);
        if (resolved === null) continue;
        const resolvedFwd = resolved.replace(/\\/g, "/");
        if (resolvedFwd.startsWith(rule.forbiddenPrefix)) {
          violations.push({
            file: srcRelative,
            importPath: spec,
            rule: rule.description,
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("check-boundaries: all import boundaries satisfied.");
    process.exit(0);
  }

  console.error(`check-boundaries: ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}`);
    console.error(`    imports: "${v.importPath}"`);
    console.error(`    rule:    ${v.rule}\n`);
  }
  process.exit(1);
}

main();
