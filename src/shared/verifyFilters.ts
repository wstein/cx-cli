import type { ManifestFileRow } from "../manifest/types.js";

export interface VerifySelection {
  sections: string[] | undefined;
  files: string[] | undefined;
}

export function selectManifestRows(
  rows: ManifestFileRow[],
  selection: VerifySelection,
): ManifestFileRow[] {
  return rows.filter((row) => {
    if (
      selection.sections &&
      selection.sections.length > 0 &&
      row.section !== "-" &&
      !selection.sections.includes(row.section)
    ) {
      return false;
    }

    if (
      selection.files &&
      selection.files.length > 0 &&
      !selection.files.includes(row.path)
    ) {
      return false;
    }

    return true;
  });
}
