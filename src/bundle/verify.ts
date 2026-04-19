import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { CxConfig } from "../config/types.js";
import { parseChecksumFile } from "../manifest/checksums.js";
import { lockFileName } from "../manifest/lock.js";
import { renderSectionWithRepomix } from "../repomix/render.js";
import {
  validateEntryHashes,
  validatePlanOrdering,
} from "../repomix/structured.js";
import { CxError, type ErrorRemediation } from "../shared/errors.js";
import { sha256File, sha256NormalizedText } from "../shared/hashing.js";
import {
  selectManifestRows,
  type VerifySelection,
} from "../shared/verifyFilters.js";
import { loadManifestFromBundle, validateBundle } from "./validate.js";

type ReadUtf8 = (filePath: string, encoding: BufferEncoding) => Promise<string>;

type Mkdtemp = (prefix: string) => Promise<string>;

type RemovePath = (
  targetPath: string,
  options: { recursive?: boolean; force?: boolean },
) => Promise<void>;

export type VerifyFailureType =
  | "checksum_omission"
  | "checksum_mismatch"
  | "unexpected_checksum_reference"
  | "source_tree_drift"
  | "structured_contract_mismatch"
  | "ordering_violation"
  | "render_plan_drift";

export class VerifyError extends CxError {
  readonly type: VerifyFailureType;
  readonly relativePath: string | undefined;

  constructor(
    type: VerifyFailureType,
    message: string,
    relativePath?: string,
    exitCode = 10,
  ) {
    super(message, exitCode, {
      remediation: buildVerifyRemediation(type, relativePath),
    });
    this.type = type;
    this.relativePath = relativePath;
  }
}

export interface BundleVerifyDeps {
  validateBundle?: typeof validateBundle;
  loadManifestFromBundle?: typeof loadManifestFromBundle;
  readFile?: ReadUtf8;
  parseChecksumFile?: typeof parseChecksumFile;
  sha256File?: typeof sha256File;
  renderSectionWithRepomix?: typeof renderSectionWithRepomix;
  validatePlanOrdering?: typeof validatePlanOrdering;
  validateEntryHashes?: typeof validateEntryHashes;
  mkdtemp?: Mkdtemp;
  rm?: RemovePath;
}

function buildVerifyRemediation(
  type: VerifyFailureType,
  relativePath?: string,
): ErrorRemediation {
  switch (type) {
    case "source_tree_drift":
      return {
        recommendedCommand: "cx bundle --config cx.toml",
        docsRef: "docs/MANUAL.md",
        nextSteps: [
          relativePath
            ? `Review whether ${relativePath} changed intentionally after the bundle was created.`
            : "Review the affected source path to determine whether the drift is intentional.",
          "Rebuild the bundle or restore the expected source content before rerunning verification.",
        ],
      };
    case "checksum_mismatch":
    case "checksum_omission":
    case "unexpected_checksum_reference":
      return {
        recommendedCommand: "cx validate dist/demo-bundle",
        docsRef: "docs/MANUAL.md",
        nextSteps: [
          "Inspect the bundle directory for missing or modified artifacts.",
          "Regenerate the bundle if the current artifact set is no longer trustworthy.",
        ],
      };
    case "structured_contract_mismatch":
    case "ordering_violation":
    case "render_plan_drift":
      return {
        recommendedCommand: "cx inspect --config cx.toml --token-breakdown",
        docsRef: "docs/ARCHITECTURE.md",
        nextSteps: [
          "Confirm that the current render plan and section ordering are deterministic.",
          "Rebuild the bundle after correcting render-path or section-definition drift.",
        ],
      };
  }
}

async function verifyBundleAgainstSourceTree(
  bundleDir: string,
  sourceDir: string,
  selection: VerifySelection,
  config: CxConfig,
  deps: BundleVerifyDeps = {},
): Promise<void> {
  const loadManifest = deps.loadManifestFromBundle ?? loadManifestFromBundle;
  const renderSection =
    deps.renderSectionWithRepomix ?? renderSectionWithRepomix;
  const validateOrdering = deps.validatePlanOrdering ?? validatePlanOrdering;
  const validateHashes = deps.validateEntryHashes ?? validateEntryHashes;
  const mkdtemp = deps.mkdtemp ?? ((prefix) => fs.mkdtemp(prefix));
  const rm = deps.rm ?? ((targetPath, options) => fs.rm(targetPath, options));

  const { manifest } = await loadManifest(bundleDir);
  const selectedFiles = selectManifestRows(manifest.files, selection);

  const selectedTextFiles = selectedFiles.filter(
    (file) => file.kind === "text",
  );
  const selectedSections = manifest.sections.filter((section) =>
    selectedTextFiles.some((file) => file.section === section.name),
  );
  const shouldVerifyAggregatePlanHash =
    manifest.renderPlanHash !== undefined &&
    !(selection.sections?.length || selection.files?.length);
  const sectionPlanHashes = new Map<string, string>();

  for (const section of selectedSections) {
    const sectionRows = selectedTextFiles.filter(
      (file) => file.section === section.name,
    );
    const explicitFiles = sectionRows.map((file) =>
      path.join(sourceDir, file.path),
    );
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "cx-verify-"));
    try {
      const renderResult = await renderSection({
        config: {
          ...config,
          projectName: manifest.projectName,
          sourceRoot: sourceDir,
          repomix: {
            ...config.repomix,
            showLineNumbers: manifest.settings.showLineNumbers,
            includeEmptyDirectories: manifest.settings.includeEmptyDirectories,
            securityCheck: manifest.settings.securityCheck,
          },
          tokens: {
            ...config.tokens,
            encoding: manifest.settings.tokenEncoding,
          },
        },
        style: section.style,
        sourceRoot: sourceDir,
        outputPath: path.join(tmpDir, "output"),
        sectionName: section.name,
        explicitFiles,
        requireStructured: true,
      });

      // Verify structured plan integrity if available
      if (
        renderResult.structuredPlan &&
        renderResult.planHash &&
        manifest.renderPlanHash
      ) {
        sectionPlanHashes.set(section.name, renderResult.planHash);

        // Validate ordering is deterministic
        if (!validateOrdering(renderResult.structuredPlan)) {
          throw new VerifyError(
            "ordering_violation",
            `Render plan ordering is not deterministic for section ${section.name}.`,
            section.name,
          );
        }

        // Validate all entry hashes are consistent
        const hashErrors = validateHashes(renderResult.structuredPlan.entries);
        if (hashErrors.size > 0) {
          const errorDetails = Array.from(hashErrors.values()).join(", ");
          throw new VerifyError(
            "structured_contract_mismatch",
            `Content hash validation failed for section ${section.name}: ${errorDetails}`,
            section.name,
          );
        }
      }

      for (const file of sectionRows) {
        const sourceHash = renderResult.fileContentHashes.get(file.path);
        if (sourceHash === undefined) {
          throw new VerifyError(
            "source_tree_drift",
            `Source tree render for ${file.path} omitted normalized packed content.`,
            file.path,
          );
        }
        if (sourceHash !== file.sha256) {
          throw new VerifyError(
            "source_tree_drift",
            `Source tree mismatch for ${file.path}: normalized packed content differs between bundle and source tree.`,
            file.path,
          );
        }
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  if (shouldVerifyAggregatePlanHash) {
    if (sectionPlanHashes.size !== selectedSections.length) {
      throw new VerifyError(
        "render_plan_drift",
        "Source tree verification could not produce render plan hashes for all sections.",
      );
    }
    const aggregatePlanHash = sha256NormalizedText(
      JSON.stringify(
        Array.from(sectionPlanHashes.entries()).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    if (aggregatePlanHash !== manifest.renderPlanHash) {
      throw new VerifyError(
        "render_plan_drift",
        "Render plan hash drift: source tree plan hash no longer matches the bundle manifest.",
      );
    }
  }
}

export async function verifyBundle(
  bundleDir: string,
  againstDir?: string,
  selection: VerifySelection = { sections: undefined, files: undefined },
  config?: CxConfig,
  deps: BundleVerifyDeps = {},
): Promise<void> {
  const validate = deps.validateBundle ?? validateBundle;
  const loadManifest = deps.loadManifestFromBundle ?? loadManifestFromBundle;
  const readFile =
    deps.readFile ?? ((filePath, encoding) => fs.readFile(filePath, encoding));
  const parseChecksums = deps.parseChecksumFile ?? parseChecksumFile;
  const sha256FileImpl = deps.sha256File ?? sha256File;

  const { manifestName } = await validate(bundleDir);
  const { manifest } = await loadManifest(bundleDir);
  const selectedFiles = selectManifestRows(manifest.files, selection);
  const selectedSections = manifest.sections.filter((section) =>
    selectedFiles.some((file) => file.section === section.name),
  );
  const selectedAssets = manifest.assets.filter((asset) =>
    selectedFiles.some((file) => file.path === asset.sourcePath),
  );
  const checksums = parseChecksums(
    await readFile(path.join(bundleDir, manifest.checksumFile), "utf8"),
  );
  const listedFiles = new Set(
    checksums.map((checksum) => checksum.relativePath),
  );
  const lock = lockFileName(manifest.projectName);
  const expectedFiles = new Set([
    manifestName,
    ...(manifest.bundleIndexFile ? [manifest.bundleIndexFile] : []),
    ...selectedSections.map((section) => section.outputFile),
    ...selectedAssets.map((asset) => asset.storedPath),
    // Include the lock file only when present — older bundles do not have one.
    ...(listedFiles.has(lock) ? [lock] : []),
  ]);

  for (const checksum of checksums) {
    if (!expectedFiles.has(checksum.relativePath)) {
      if (selection.sections?.length || selection.files?.length) {
        continue;
      }
      throw new VerifyError(
        "unexpected_checksum_reference",
        `Checksum file references an unexpected path: ${checksum.relativePath}.`,
        checksum.relativePath,
      );
    }

    const actualHash = await sha256FileImpl(
      path.join(bundleDir, checksum.relativePath),
    );
    if (actualHash !== checksum.hash) {
      throw new VerifyError(
        "checksum_mismatch",
        `Checksum mismatch for ${checksum.relativePath}.`,
        checksum.relativePath,
      );
    }
  }

  for (const expectedFile of expectedFiles) {
    if (!listedFiles.has(expectedFile)) {
      throw new VerifyError(
        "checksum_omission",
        `Checksum file is missing an entry for ${expectedFile}.`,
        expectedFile,
      );
    }
  }

  if (againstDir) {
    if (!config) {
      throw new CxError(
        "A loaded cx config is required to verify normalized content against a source tree.",
        2,
        {
          remediation: {
            recommendedCommand:
              "cx verify dist/demo-bundle --against . --config cx.toml",
            docsRef: "docs/MANUAL.md",
            nextSteps: [
              "Provide the same cx.toml that was used when the bundle was built.",
            ],
          },
        },
      );
    }
    await verifyBundleAgainstSourceTree(
      bundleDir,
      againstDir,
      selection,
      config,
      deps,
    );
  }
}
