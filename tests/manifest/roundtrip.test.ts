/**
 * Property-based round-trip tests for the manifest JSON serialiser.
 *
 * fast-check generates random CxManifest values; each one is rendered to JSON
 * and parsed back. The recovered manifest must be semantically equivalent to
 * the original across every generated case.
 *
 * Separate tests cover the schemaVersion guard by injecting unsupported
 * version numbers and asserting CxError is thrown before any field is read.
 */

import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";

import {
  MANIFEST_SCHEMA_VERSION,
  parseManifestJson,
  renderManifestJson,
} from "../../src/manifest/json.js";
import type {
  AssetRecord,
  CxManifest,
  CxSection,
  ManifestFileRow,
  NoteRecord,
} from "../../src/manifest/types.js";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const nonEmptyString = fc.string({ minLength: 1, maxLength: 80 });
/** ISO 8601 timestamp in the range 2020–2030. */
const isoTimestamp: fc.Arbitrary<string> = fc
  .integer({ min: 1577836800000, max: 1924991999000 }) // 2020-01-01 .. 2030-12-31 (ms)
  .map((ms) => new Date(ms).toISOString());

/** 64-character lowercase hex string for SHA-256 digests. */
const sha256Hex: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ),
    { minLength: 64, maxLength: 64 },
  )
  .map((chars) => chars.join(""));

const nonNegInt = fc.integer({ min: 0, max: 1_000_000 });
const posInt = fc.integer({ min: 1, max: 1_000_000 });
const styleArb = fc.constantFrom<"xml" | "markdown" | "json" | "plain">(
  "xml",
  "markdown",
  "json",
  "plain",
);
const vcsProviderArb = fc.constantFrom<"git" | "fossil" | "none">(
  "git",
  "fossil",
  "none",
);
const dirtyStateArb = fc.constantFrom<"clean" | "safe_dirty" | "forced_dirty">(
  "clean",
  "safe_dirty",
  "forced_dirty",
);
const tokenEncodingArb = fc.constantFrom("o200k_base", "cl100k_base");

/** Arbitrary for a nullable positive integer (outputStartLine / outputEndLine). */
const nullablePos: fc.Arbitrary<number | null> = fc.option(posInt, {
  nil: null,
  freq: 3,
});

/** Arbitrary for a single ManifestFileRow with the given section name. */
function fileRowArb(sectionName: string): fc.Arbitrary<ManifestFileRow> {
  return fc
    .record({
      path: nonEmptyString,
      kind: fc.constantFrom<"text" | "asset">("text", "asset"),
      storedIn: fc.constantFrom<"packed" | "copied">("packed", "copied"),
      sha256: sha256Hex,
      sizeBytes: nonNegInt,
      tokenCount: nonNegInt,
      mtime: isoTimestamp,
      mediaType: nonEmptyString,
      outputStartLine: nullablePos,
      outputEndLine: nullablePos,
    })
    .map((row) => ({ ...row, section: sectionName }));
}

const settingsArb = fc.record({
  globalStyle: styleArb,
  tokenEncoding: tokenEncodingArb,
  showLineNumbers: fc.boolean(),
  includeEmptyDirectories: fc.boolean(),
  securityCheck: fc.boolean(),
  normalizationPolicy: fc.constant("repomix-default-v1" as const),
});

const assetArb: fc.Arbitrary<AssetRecord> = fc.record({
  sourcePath: nonEmptyString,
  storedPath: nonEmptyString,
  sha256: sha256Hex,
  sizeBytes: nonNegInt,
  mtime: isoTimestamp,
  mediaType: nonEmptyString,
});

const noteArb: fc.Arbitrary<NoteRecord> = fc.record({
  id: fc
    .integer({ min: 20200101000000, max: 20301231235959 })
    .map((value) => String(value).padStart(14, "0")),
  title: nonEmptyString,
  fileName: nonEmptyString,
  aliases: fc.array(nonEmptyString, { maxLength: 4 }),
  tags: fc.array(nonEmptyString, { maxLength: 4 }),
  summary: nonEmptyString,
});

function sectionArb(): fc.Arbitrary<CxSection> {
  return fc
    .record({
      name: nonEmptyString,
      style: styleArb,
      outputFile: nonEmptyString,
      outputSha256: sha256Hex,
      fileCount: nonNegInt,
      tokenCount: nonNegInt,
    })
    .chain((meta) =>
      fc
        .array(fc.constant(null), { minLength: 0, maxLength: 6 })
        .chain((slots) => {
          const rowArbs: Array<fc.Arbitrary<ManifestFileRow>> = slots.map(() =>
            fileRowArb(meta.name),
          );
          if (rowArbs.length === 0) {
            return fc.constant({ ...meta, files: [] as ManifestFileRow[] });
          }
          return fc.tuple(...rowArbs).map((rows) => ({
            ...meta,
            fileCount: rows.length,
            files: rows,
          }));
        }),
    );
}

/** Full CxManifest arbitrary. */
const manifestArb: fc.Arbitrary<CxManifest> = fc
  .record({
    projectName: nonEmptyString,
    sourceRoot: nonEmptyString,
    bundleDir: nonEmptyString,
    checksumFile: nonEmptyString,
    bundleIndexFile: fc
      .option(nonEmptyString)
      .map((value) => value ?? undefined),
    createdAt: isoTimestamp,
    cxVersion: nonEmptyString,
    repomixVersion: nonEmptyString,
    settings: settingsArb,
    sections: fc.array(sectionArb(), { minLength: 0, maxLength: 4 }),
    assets: fc.array(assetArb, { minLength: 0, maxLength: 4 }),
    notes: fc.array(noteArb, { minLength: 0, maxLength: 4 }),
    vcsProvider: vcsProviderArb,
    dirtyState: dirtyStateArb,
    modifiedFiles: fc.array(nonEmptyString, { minLength: 0, maxLength: 5 }),
  })
  .map((fields) => {
    const textRows: ManifestFileRow[] = fields.sections.flatMap((s) => s.files);
    const assetRows: ManifestFileRow[] = fields.assets.map((a) => ({
      path: a.sourcePath,
      kind: "asset" as const,
      section: "-",
      storedIn: "copied" as const,
      sha256: a.sha256,
      sizeBytes: a.sizeBytes,
      tokenCount: 0,
      mtime: a.mtime,
      mediaType: a.mediaType,
      outputStartLine: null,
      outputEndLine: null,
    }));
    return {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      bundleVersion: 1 as const,
      projectName: fields.projectName,
      sourceRoot: fields.sourceRoot,
      bundleDir: fields.bundleDir,
      checksumFile: fields.checksumFile,
      bundleIndexFile: fields.bundleIndexFile,
      createdAt: fields.createdAt,
      cxVersion: fields.cxVersion,
      repomixVersion: fields.repomixVersion,
      checksumAlgorithm: "sha256" as const,
      settings: fields.settings,
      sections: fields.sections,
      assets: fields.assets,
      notes: fields.notes.length > 0 ? fields.notes : undefined,
      files: [...textRows, ...assetRows].sort((a, b) =>
        a.path.localeCompare(b.path, "en"),
      ),
      totalTokenCount: fields.sections.reduce(
        (sum, section) => sum + section.tokenCount,
        0,
      ),
      vcsProvider: fields.vcsProvider,
      dirtyState: fields.dirtyState,
      modifiedFiles: fields.modifiedFiles,
    };
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip the runtime-only `section` field from a file row before comparing.
 * The section name is re-populated from the parent section during parsing and
 * comparing it separately would double-count the same information.
 */
function stripSection(row: ManifestFileRow): Omit<ManifestFileRow, "section"> {
  const { section: _section, ...rest } = row;
  return rest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("manifest round-trip (property-based)", () => {
  test("render → parse produces an identical manifest", () => {
    fc.assert(
      fc.property(manifestArb, (manifest) => {
        const rendered = renderManifestJson(manifest);
        const recovered = parseManifestJson(rendered);

        // Top-level scalars
        expect(recovered.schemaVersion).toBe(manifest.schemaVersion);
        expect(recovered.bundleVersion).toBe(manifest.bundleVersion);
        expect(recovered.projectName).toBe(manifest.projectName);
        expect(recovered.sourceRoot).toBe(manifest.sourceRoot);
        expect(recovered.bundleDir).toBe(manifest.bundleDir);
        expect(recovered.checksumFile).toBe(manifest.checksumFile);
        expect(recovered.bundleIndexFile).toBe(manifest.bundleIndexFile);
        expect(recovered.createdAt).toBe(manifest.createdAt);
        expect(recovered.cxVersion).toBe(manifest.cxVersion);
        expect(recovered.repomixVersion).toBe(manifest.repomixVersion);
        expect(recovered.checksumAlgorithm).toBe(manifest.checksumAlgorithm);

        // Settings (deep equal)
        expect(recovered.settings).toEqual(manifest.settings);

        // Sections and their file rows
        expect(recovered.sections).toHaveLength(manifest.sections.length);
        for (const [i, orig] of manifest.sections.entries()) {
          const recv = recovered.sections[i];
          expect(recv).toBeDefined();
          if (!recv) {
            continue;
          }
          expect(recv.name).toBe(orig.name);
          expect(recv.style).toBe(orig.style);
          expect(recv.outputFile).toBe(orig.outputFile);
          expect(recv.outputSha256).toBe(orig.outputSha256);
          expect(recv.fileCount).toBe(orig.fileCount);
          expect(recv.tokenCount).toBe(orig.tokenCount);
          expect(recv.files).toHaveLength(orig.files.length);
          for (const [j, origFile] of orig.files.entries()) {
            const recvFile = recv.files[j];
            expect(recvFile).toBeDefined();
            if (!recvFile) {
              continue;
            }
            expect(stripSection(recvFile)).toEqual(stripSection(origFile));
          }
        }

        // Assets (deep equal)
        expect(recovered.assets).toEqual(manifest.assets);
        expect(recovered.notes).toEqual(manifest.notes);

        // Flat file list path set (reconstructed during parse)
        const origPaths = manifest.files.map((r) => r.path).sort();
        const recvPaths = recovered.files.map((r) => r.path).sort();
        expect(recvPaths).toEqual(origPaths);

        // VCS fields
        expect(recovered.vcsProvider).toBe(manifest.vcsProvider);
        expect(recovered.dirtyState).toBe(manifest.dirtyState);
        expect(recovered.modifiedFiles).toEqual(manifest.modifiedFiles);
      }),
      { numRuns: 200 },
    );
  });

  test("compact and pretty output parse to the same manifest", () => {
    fc.assert(
      fc.property(manifestArb, (manifest) => {
        const fromPretty = parseManifestJson(
          renderManifestJson(manifest, true),
        );
        const fromCompact = parseManifestJson(
          renderManifestJson(manifest, false),
        );
        expect(fromCompact.projectName).toBe(fromPretty.projectName);
        expect(fromCompact.sections).toHaveLength(fromPretty.sections.length);
        expect(fromCompact.assets).toEqual(fromPretty.assets);
        expect(fromCompact.notes).toEqual(fromPretty.notes);
        expect(fromCompact.settings).toEqual(fromPretty.settings);
      }),
      { numRuns: 100 },
    );
  });

  test("rejects manifests with an unsupported schemaVersion", () => {
    fc.assert(
      fc.property(
        manifestArb,
        fc.integer().filter((v) => v !== MANIFEST_SCHEMA_VERSION),
        (manifest, badVersion) => {
          const corrupted = renderManifestJson(manifest).replace(
            `"schemaVersion": ${MANIFEST_SCHEMA_VERSION}`,
            `"schemaVersion": ${badVersion}`,
          );
          expect(() => parseManifestJson(corrupted)).toThrow(
            `Unsupported manifest schema version ${badVersion}`,
          );
        },
      ),
      { numRuns: 50 },
    );
  });

  test("rejects manifests with a corrupted file object", () => {
    fc.assert(
      fc.property(
        // Only test manifests with at least one section containing at least one file
        manifestArb.filter((m) => m.sections.some((s) => s.files.length > 0)),
        (manifest) => {
          // Replace the first file object's "path" key with a non-matching value.
          const corrupted = renderManifestJson(manifest).replace(
            '"path":',
            '"path_":',
          );
          expect(() => parseManifestJson(corrupted)).toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });
});
