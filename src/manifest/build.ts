import type { BundlePlan } from '../planning/types.js';
import type { CxConfig } from '../config/types.js';
import type { CxManifest, ManifestFileRow, SectionOutputRecord } from './types.js';

export function buildManifest(params: {
  config: CxConfig;
  plan: BundlePlan;
  sectionOutputs: SectionOutputRecord[];
  cxVersion: string;
  repomixVersion: string;
}): CxManifest {
  const textRows: ManifestFileRow[] = params.plan.sections.flatMap((section) =>
    section.files.map((file) => ({
      path: file.relativePath,
      kind: 'text',
      section: section.name,
      storedIn: 'packed',
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
      mediaType: file.mediaType,
      outputFile: section.outputFile,
      outputStartLine: '-',
      outputEndLine: '-',
      leadingWhitespaceBase64: file.leadingWhitespaceBase64 ?? '-',
      trailingWhitespaceBase64: file.trailingWhitespaceBase64 ?? '-',
      exactContentBase64: file.exactContentBase64 ?? '-',
    })),
  );

  const assetRows: ManifestFileRow[] = params.plan.assets.map((asset) => ({
    path: asset.relativePath,
    kind: 'asset',
    section: '-',
    storedIn: 'copied',
    sha256: asset.sha256,
    sizeBytes: asset.sizeBytes,
    mediaType: asset.mediaType,
    outputFile: '-',
    outputStartLine: '-',
    outputEndLine: '-',
    leadingWhitespaceBase64: '-',
    trailingWhitespaceBase64: '-',
    exactContentBase64: '-',
  }));

  return {
    schemaVersion: 1,
    bundleVersion: 1,
    projectName: params.plan.projectName,
    sourceRoot: params.plan.sourceRoot,
    bundleDir: params.plan.bundleDir,
    checksumFile: params.plan.checksumFile,
    createdAt: new Date().toISOString(),
    cxVersion: params.cxVersion,
    repomixVersion: params.repomixVersion,
    checksumAlgorithm: 'sha256',
    settings: {
      globalStyle: params.config.repomix.style,
      removeComments: params.config.repomix.removeComments,
      removeEmptyLines: params.config.repomix.removeEmptyLines,
      compress: params.config.repomix.compress,
      showLineNumbers: params.config.repomix.showLineNumbers,
      includeEmptyDirectories: params.config.repomix.includeEmptyDirectories,
      securityCheck: params.config.repomix.securityCheck,
      losslessTextExtraction: !params.config.repomix.removeComments
        && !params.config.repomix.removeEmptyLines
        && !params.config.repomix.compress
        && !params.config.repomix.showLineNumbers,
    },
    sections: params.sectionOutputs,
    assets: params.plan.assets.map((asset) => ({
      sourcePath: asset.relativePath,
      storedPath: asset.storedPath,
      sha256: asset.sha256,
      sizeBytes: asset.sizeBytes,
      mediaType: asset.mediaType,
    })),
    files: [...textRows, ...assetRows].sort((left, right) => left.path.localeCompare(right.path, 'en')),
  };
}
