import type { CxConfig } from "../config/types.js";
import type { BundlePlan } from "../planning/types.js";
import type {
  CxManifest,
  CxSection,
  ManifestFileRow,
  SectionOutputRecord,
  SectionSpanMaps,
} from "./types.js";

export function buildManifest(params: {
  config: CxConfig;
  plan: BundlePlan;
  sectionOutputs: SectionOutputRecord[];
  cxVersion: string;
  repomixVersion: string;
  sectionSpanMaps?: SectionSpanMaps;
}): CxManifest {
  const sections: CxSection[] = params.sectionOutputs.map((sectionOutput) => {
    const planSection = params.plan.sections.find(
      (s) => s.name === sectionOutput.name,
    );
    const sectionSpans = params.sectionSpanMaps?.get(sectionOutput.name);
    const files: ManifestFileRow[] = (planSection?.files ?? []).map((file) => {
      const fileSpan = sectionSpans?.get(file.relativePath);
      return {
        path: file.relativePath,
        kind: "text",
        section: sectionOutput.name,
        storedIn: "packed",
        sha256: file.sha256,
        sizeBytes: file.sizeBytes,
        mediaType: file.mediaType,
        outputStartLine: fileSpan?.outputStartLine ?? null,
        outputEndLine: fileSpan?.outputEndLine ?? null,
      };
    });
    return { ...sectionOutput, files };
  });

  const textRows = sections.flatMap((s) => s.files);

  const assetRows: ManifestFileRow[] = params.plan.assets.map((asset) => ({
    path: asset.relativePath,
    kind: "asset",
    section: "-",
    storedIn: "copied",
    sha256: asset.sha256,
    sizeBytes: asset.sizeBytes,
    mediaType: asset.mediaType,
    outputStartLine: null,
    outputEndLine: null,
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
    checksumAlgorithm: "sha256",
    settings: {
      globalStyle: params.config.repomix.style,
      removeComments: params.config.repomix.removeComments,
      removeEmptyLines: params.config.repomix.removeEmptyLines,
      compress: params.config.repomix.compress,
      showLineNumbers: params.config.repomix.showLineNumbers,
      includeEmptyDirectories: params.config.repomix.includeEmptyDirectories,
      securityCheck: params.config.repomix.securityCheck,
    },
    sections,
    assets: params.plan.assets.map((asset) => ({
      sourcePath: asset.relativePath,
      storedPath: asset.storedPath,
      sha256: asset.sha256,
      sizeBytes: asset.sizeBytes,
      mediaType: asset.mediaType,
    })),
    files: [...textRows, ...assetRows].sort((left, right) =>
      left.path.localeCompare(right.path, "en"),
    ),
  };
}
