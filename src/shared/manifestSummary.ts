import type {
  AssetRecord,
  CxManifest,
  ManifestFileRow,
} from "../manifest/types.js";

export interface ManifestSelection {
  sections: string[] | undefined;
  files: string[] | undefined;
}

export interface ManifestSummary {
  manifestName: string;
  projectName: string;
  sectionCount: number;
  assetCount: number;
  fileCount: number;
  textFileCount: number;
  assetFileCount: number;
}

export function summarizeManifest(
  manifestName: string,
  manifest: CxManifest,
  rows: ManifestFileRow[] = manifest.files,
): ManifestSummary {
  const selectedSectionNames = new Set(
    rows
      .map((row) => row.section)
      .filter((section): section is string => section !== "-"),
  );
  const selectedAssetPaths = new Set(
    rows.filter((row) => row.kind === "asset").map((row) => row.path),
  );

  return {
    manifestName,
    projectName: manifest.projectName,
    sectionCount: manifest.sections.filter((section) =>
      selectedSectionNames.has(section.name),
    ).length,
    assetCount: manifest.assets.filter((asset) =>
      selectedAssetPaths.has(asset.sourcePath),
    ).length,
    fileCount: rows.length,
    textFileCount: rows.filter((file) => file.kind === "text").length,
    assetFileCount: rows.filter((file) => file.kind === "asset").length,
  };
}

export function selectManifestSections(
  manifest: CxManifest,
  rows: ManifestFileRow[],
) {
  const selectedSectionNames = new Set(
    rows
      .map((row) => row.section)
      .filter((section): section is string => section !== "-"),
  );
  return manifest.sections.filter((section) =>
    selectedSectionNames.has(section.name),
  );
}

export function selectManifestAssets(
  manifest: CxManifest,
  rows: ManifestFileRow[],
): AssetRecord[] {
  const selectedAssetPaths = new Set(
    rows.filter((row) => row.kind === "asset").map((row) => row.path),
  );
  return manifest.assets.filter((asset) =>
    selectedAssetPaths.has(asset.sourcePath),
  );
}
