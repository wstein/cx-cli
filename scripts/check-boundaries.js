import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RULES = [
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

function extractImportSpecifiers(source) {
  const specifiers = [];
  const importRe =
    /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let m = importRe.exec(source);
  while (m !== null) {
    specifiers.push(m[1]);
    m = importRe.exec(source);
  }
  const bareRe = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  m = bareRe.exec(source);
  while (m !== null) {
    specifiers.push(m[1]);
    m = bareRe.exec(source);
  }
  return specifiers;
}

function resolveToSrcRelative(importingFileSrcRelative, specifier) {
  if (!specifier.startsWith(".")) return null;
  const dir = path.dirname(importingFileSrcRelative);
  const resolved = path.normalize(path.join(dir, specifier));
  return resolved.replace(/\.(js|ts)$/, "");
}

async function collectTsFiles(dir) {
  const results = [];
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

async function main() {
  const srcDir = path.resolve(__dirname, "../src");
  const files = await collectTsFiles(srcDir);

  const violations = [];

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
