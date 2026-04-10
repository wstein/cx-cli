/**
 * `cx repomix-components` — generate one repomix output file per component.
 *
 * This command reads a `cx.json` file with a `sections`
 * section and invokes the installed `repomix` CLI for each section.
 *
 * It writes section-specific output files, computes a SHA-256 checksum file,
 * and prints a compact summary for each generated output.
 */

import fg from 'fast-glob';
import { access, constants, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import kleur from 'kleur';
import { computeSha256 } from '../adapters/repomixAdapter.js';
import { runRepomix } from './repomix.js';
import { configDirectory, resolveConfigFilePath, resolveConfigPath } from '../utils/paths.js';

export interface RepomixSectionsOptions {
  /** Path to the CX configuration file. */
  cxConfig?: string;
  /** Path to the repomix configuration file. */
  config?: string;
  /** Output directory for section repomix files. */
  outputDir?: string;
  /** Optional path to write a separate checksum file for section outputs. */
  checksumFile?: string;
  /** Whether to print verbose progress information. */
  verbose?: boolean;
}

interface SectionEntryObject {
  name?: string;
  include: string[];
}

interface CxConfig {
  repomix?: {
    configFile?: string;
    outputDir?: string;
  };
  sections?: Record<string, string | string[] | SectionEntryObject>;
}

interface RawRepomixConfig {
  output?: { style?: string };
}

interface ComponentDefinition {
  name: string;
  include: string[];
}

async function ensureFileExists(path: string): Promise<void> {
  await access(path, constants.R_OK);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function parseIncludeString(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
}

export function extractSections(config: unknown): ComponentDefinition[] {
  if (config === null || typeof config !== 'object') {
    throw new Error('cx config must be a JSON object.');
  }

  const raw = config as CxConfig;
  const sections = raw.sections;
  if (sections === undefined) {
    throw new Error('No `sections` field found in cx configuration.');
  }
  if (sections === null || typeof sections !== 'object') {
    throw new Error('`sections` must be an object.');
  }

  return Object.entries(sections).map(([key, value]) => {
    if (typeof value === 'string') {
      const include = parseIncludeString(value);
      if (include.length === 0) {
        throw new Error(`Section ${key} has an empty include value.`);
      }
      return { name: value, include };
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new Error(`Section ${key} has an empty include array.`);
      }
      return {
        name: `group-${key}`,
        include: value.map((item) => String(item).trim()).filter((item) => item.length > 0),
      };
    }

    if (typeof value === 'object' && value !== null) {
      const entry = value as SectionEntryObject;
      if (!Array.isArray(entry.include)) {
        throw new Error(`Section ${key} must contain an array of include paths.`);
      }
      if (entry.include.length === 0) {
        throw new Error(`Section ${key} has an empty include array.`);
      }
      return {
        name: entry.name ? entry.name : `group-${key}`,
        include: entry.include.map((item) => String(item).trim()).filter((item) => item.length > 0),
      };
    }

    throw new Error(
      `Section ${key} has unsupported definition type. Use a string, array, or object with an include array.`,
    );
  });
}

function safeComponentName(name: string): string {
  const candidate = name
    .trim()
    .replace(/[\\/\s]+/g, '-')
    .replace(/[^a-zA-Z0-9_.-]+/g, '')
    .replace(/^-+|-+$/g, '');
  return candidate.length > 0 ? candidate : 'component';
}

async function resolveSectionSources(repoRoot: string, includePatterns: string[]): Promise<string[]> {
  const matched = await fg(includePatterns, {
    cwd: repoRoot,
    onlyFiles: true,
    dot: true,
    unique: true,
    followSymbolicLinks: true,
  });
  return matched.map((filePath) => resolve(repoRoot, filePath));
}

async function getLatestMTime(paths: string[]): Promise<number> {
  if (paths.length === 0) {
    return 0;
  }
  const stats = await Promise.all(paths.map((path) => stat(path).then((s) => s.mtimeMs)));
  return Math.max(...stats);
}

export async function shouldGenerateComponent(
  outputFile: string,
  repoRoot: string,
  includePatterns: string[],
  cxConfigFile: string,
  repomixConfigFile: string,
): Promise<boolean> {
  if (!(await fileExists(outputFile))) {
    return true;
  }

  const outputMtime = (await stat(outputFile)).mtimeMs;
  const sourceFiles = await resolveSectionSources(repoRoot, includePatterns);
  const sourceMtime = await getLatestMTime(sourceFiles);
  const configMtime = await getLatestMTime([cxConfigFile, repomixConfigFile].filter(Boolean) as string[]);

  return sourceMtime > outputMtime || configMtime > outputMtime;
}

export async function runRepomixSections(options: RepomixSectionsOptions = {}): Promise<void> {
  const repoRoot = resolve(process.cwd());
  const cxConfigFile = resolveConfigFilePath(repoRoot, options.cxConfig ?? 'cx.json');

  console.log(kleur.cyan('Starting repomix component generation'));
  console.log(`Repository root: ${repoRoot}`);
  console.log(`CX config file: ${cxConfigFile}`);

  await ensureFileExists(cxConfigFile);

  const cxConfigText = await readFile(cxConfigFile, 'utf8');
  const cxConfig = JSON.parse(cxConfigText) as CxConfig;
  const sections = extractSections(cxConfig);

  if (sections.length === 0) {
    throw new Error('No sections found in `sections`.');
  }

  const configDir = configDirectory(cxConfigFile);
  const repomixConfigFile = resolveConfigPath(
    configDir,
    options.config ?? cxConfig.repomix?.configFile ?? 'repomix.config.json',
  );
  const outputDir = resolveConfigPath(configDir, options.outputDir ?? cxConfig.repomix?.outputDir ?? 'bundles');
  const checksumFile = options.checksumFile
    ? resolveConfigPath(configDir, options.checksumFile)
    : undefined;

  console.log(`Repomix config file: ${repomixConfigFile}`);
  console.log(`Output directory: ${outputDir}`);

  await ensureFileExists(repomixConfigFile);
  await mkdir(outputDir, { recursive: true });

  const repomixText = await readFile(repomixConfigFile, 'utf8');
  const repomixConfig = JSON.parse(repomixText) as RawRepomixConfig;
  const style = repomixConfig.output?.style === 'json' ? 'json' : 'xml';
  const fileExtension = style === 'json' ? 'json.txt' : 'xml.txt';

  const generatedFiles: string[] = [];

  for (const component of sections) {
    const sanitizedName = safeComponentName(component.name);
    const outputFile = join(outputDir, `repomix-component-${sanitizedName}.${fileExtension}`);
    const repomixArgs = [
      '--config',
      repomixConfigFile,
      '--output',
      outputFile,
      ...component.include.flatMap((pattern: string) => ['--include', pattern]),
    ];

    console.log();
    console.log('════════════════════════════════════════════════════════════');
    console.log(`Generating component: ${component.name}`);
    console.log('════════════════════════════════════════════════════════════');

    const componentNeedsRebuild = await shouldGenerateComponent(
      outputFile,
      repoRoot,
      component.include,
      cxConfigFile,
      repomixConfigFile,
    );

    if (!componentNeedsRebuild) {
      console.log(kleur.dim('Skipping component generation — no section source files changed since last bundle.'));
      generatedFiles.push(outputFile);
      continue;
    }

    if (await fileExists(outputFile).catch(() => false)) {
      await rm(outputFile, { force: true });
    }

    if (options.verbose) {
      console.log(`Running repomix with args: ${repomixArgs.join(' ')}`);
    }

    await runRepomix(repomixArgs);

    const fileStat = await stat(outputFile);
    const fileContent = await readFile(outputFile, 'utf8');
    const tokenMatch = /Total tokens:\s*(\d+)/i.exec(fileContent);
    const tokenCount = tokenMatch?.[1] ?? 'unknown';

    console.log(`✅ Generated: ${outputFile}`);
    console.log(`   Size:   ${fileStat.size} bytes`);
    console.log(`   Tokens: ${tokenCount}`);

    generatedFiles.push(outputFile);
  }

  if (checksumFile !== undefined) {
    const checksumLines = await Promise.all(
      generatedFiles.map(async (file) => `${await computeSha256(file)}  ${basename(file)}`),
    );

    await writeFile(checksumFile, checksumLines.join('\n') + '\n', 'utf8');

    console.log();
    console.log('════════════════════════════════════════════════════════════');
    console.log(`✅ Checksum file generated: ${checksumFile}`);
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ All components generated successfully');
    console.log();
    console.log('To verify integrity:');
    console.log(`  cd ${dirname(checksumFile)} && sha256sum -c ${basename(checksumFile)}`);
    console.log();
  } else {
    console.log();
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ All components generated successfully');
    console.log('════════════════════════════════════════════════════════════');
    console.log();
  }
}
