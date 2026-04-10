import fs from 'node:fs/promises';
import path from 'node:path';

import picomatch from 'picomatch';

import type { CxConfig, CxSectionConfig, CxStyle } from '../config/types.js';
import { detectMediaType } from '../shared/mime.js';
import { CxError } from '../shared/errors.js';
import { listFilesRecursive, relativePosix, sortLexically } from '../shared/fs.js';
import { isSubpath } from '../shared/paths.js';
import { sha256File } from '../shared/hashing.js';
import type { BundlePlan, PlannedAsset, PlannedSection, PlannedSourceFile } from './types.js';

function outputExtension(style: CxStyle): string {
  switch (style) {
    case 'markdown':
      return 'md';
    case 'json':
      return 'json';
    case 'plain':
      return 'txt';
    case 'xml':
      return 'xml.txt';
  }
}

function compileMatchers(patterns: string[]): Array<(value: string) => boolean> {
  return patterns.map((pattern) => picomatch(pattern, { dot: true }));
}

function matchesAny(matchers: Array<(value: string) => boolean>, value: string): boolean {
  return matchers.some((matcher) => matcher(value));
}

function getSectionOrder(config: CxConfig): string[] {
  const names = Object.keys(config.sections);
  return config.dedup.order === 'lexical' ? sortLexically(names) : names;
}

function getMatchingSections(relativePath: string, sections: Map<string, CxSectionConfig>): string[] {
  const matches: string[] = [];

  for (const [name, section] of sections.entries()) {
    const include = compileMatchers(section.include);
    const exclude = compileMatchers(section.exclude);
    if (matchesAny(include, relativePath) && !matchesAny(exclude, relativePath)) {
      matches.push(name);
    }
  }

  return matches;
}

export async function buildBundlePlan(config: CxConfig): Promise<BundlePlan> {
  const allFiles = await listFilesRecursive(config.sourceRoot);
  const outputExcluded = isSubpath(config.sourceRoot, config.outputDir) ? relativePosix(config.sourceRoot, config.outputDir) : undefined;
  const globalExcludeMatchers = compileMatchers([
    ...config.files.exclude,
    ...(outputExcluded ? [`${outputExcluded}/**`] : []),
  ]);
  const assetIncludeMatchers = compileMatchers(config.assets.include);
  const assetExcludeMatchers = compileMatchers(config.assets.exclude);
  const sectionNames = getSectionOrder(config);
  const sectionEntries = new Map(sectionNames.map((name) => [name, config.sections[name]!]));
  const sectionFiles = new Map<string, PlannedSourceFile[]>(
    sectionNames.map((sectionName) => [sectionName, []]),
  );
  const assets: PlannedAsset[] = [];
  const unmatchedFiles: string[] = [];

  const relativePaths = sortLexically(
    allFiles
      .map((filePath) => relativePosix(config.sourceRoot, filePath))
      .filter((relativePath) => !matchesAny(globalExcludeMatchers, relativePath)),
  );

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(config.sourceRoot, relativePath);
    const matchingSections = getMatchingSections(relativePath, sectionEntries);
    const isAsset = matchesAny(assetIncludeMatchers, relativePath) && !matchesAny(assetExcludeMatchers, relativePath);

    if (matchingSections.length > 1 && config.dedup.mode === 'fail') {
      throw new CxError(
        `Section overlap detected for ${relativePath}: ${matchingSections.join(', ')}.`,
        4,
      );
    }

    if (isAsset && matchingSections.length > 0) {
      throw new CxError(`Asset conflict detected for ${relativePath}: file matches both an asset rule and section ${matchingSections[0]}.`, 4);
    }

    if (matchingSections.length === 0) {
      if (isAsset) {
        if (config.assets.mode === 'fail') {
          throw new CxError(`Asset ${relativePath} matched an asset rule while assets.mode=fail.`, 4);
        }

        if (config.assets.mode === 'copy') {
          const stat = await fs.stat(absolutePath);
          assets.push({
            relativePath,
            absolutePath,
            kind: 'asset',
            mediaType: detectMediaType(relativePath, 'asset'),
            sizeBytes: stat.size,
            sha256: await sha256File(absolutePath),
            storedPath: `${config.assets.targetDir}/${relativePath}`,
          });
        }
        continue;
      }

      unmatchedFiles.push(relativePath);
      continue;
    }

    const sectionName = matchingSections[0]!;
    const stat = await fs.stat(absolutePath);
    const sourceText = await fs.readFile(absolutePath, 'utf8');
    const trimmedText = sourceText.trim();
    const leadingWhitespace = sourceText.slice(0, sourceText.length - sourceText.trimStart().length);
    const trailingWhitespace = sourceText.slice(sourceText.trimEnd().length);
    const plannedFile: PlannedSourceFile = {
      relativePath,
      absolutePath,
      kind: 'text',
      mediaType: detectMediaType(relativePath, 'text'),
      sizeBytes: stat.size,
      sha256: await sha256File(absolutePath),
      leadingWhitespaceBase64: Buffer.from(leadingWhitespace, 'utf8').toString('base64'),
      trailingWhitespaceBase64: Buffer.from(trailingWhitespace, 'utf8').toString('base64'),
    };
    if (trimmedText.length === 0) {
      plannedFile.exactContentBase64 = Buffer.from(sourceText, 'utf8').toString('base64');
    }
    sectionFiles.get(sectionName)!.push(plannedFile);
  }

  if (config.files.unmatched === 'fail' && unmatchedFiles.length > 0) {
    throw new CxError(`Unmatched files detected: ${unmatchedFiles.join(', ')}.`, 2);
  }

  const sections: PlannedSection[] = sectionNames.map((name) => {
    const section = config.sections[name]!;
    const style = section.style ?? config.repomix.style;
    return {
      name,
      style,
      outputFile: `${config.projectName}-repomix-${name}.${outputExtension(style)}`,
      files: sectionFiles.get(name)!.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en')),
    };
  });

  return {
    projectName: config.projectName,
    sourceRoot: config.sourceRoot,
    bundleDir: config.outputDir,
    checksumFile: config.checksums.fileName,
    sections,
    assets: assets.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en')),
    unmatchedFiles,
  };
}
