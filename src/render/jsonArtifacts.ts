import { z } from "zod";

import type { SharedHandoverSectionSummary } from "./handover.js";

export const JsonSectionFileSchema = z.record(z.string(), z.string());

export const JsonSectionOutputSchema = z.object({
  fileSummary: z.object({
    generationHeader: z.string(),
    purpose: z.string(),
    fileFormat: z.string(),
    usageGuidelines: z.string(),
    notes: z.string(),
  }),
  userProvidedHeader: z.string(),
  directoryStructure: z.string(),
  files: JsonSectionFileSchema,
});

export type JsonSectionOutput = z.infer<typeof JsonSectionOutputSchema>;

const JsonSharedHandoverSectionSchema = z.object({
  name: z.string(),
  style: z.enum(["xml", "markdown", "json", "plain"]),
  outputFile: z.string(),
  fileCount: z.number().int().nonnegative(),
  packedTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

const JsonSharedHandoverAssetSchema = z.object({
  sourcePath: z.string(),
  storedPath: z.string(),
});

const JsonSharedHandoverProvenanceSchema = z.object({
  marker: z.string(),
  count: z.number().int().nonnegative(),
});

const JsonSharedHandoverHistoryEntrySchema = z.object({
  shortHash: z.string(),
  message: z.string(),
});

export const JsonSharedHandoverSchema = z.object({
  kind: z.literal("cx_shared_handover"),
  project: z.string(),
  purpose: z.string(),
  sections: z.array(JsonSharedHandoverSectionSchema),
  assets: z.array(JsonSharedHandoverAssetSchema).optional(),
  inclusionProvenance: z.array(JsonSharedHandoverProvenanceSchema).optional(),
  recentRepositoryHistory: z
    .array(JsonSharedHandoverHistoryEntrySchema)
    .optional(),
  usage: z.string(),
});

export type JsonSharedHandover = z.infer<typeof JsonSharedHandoverSchema>;

export function buildJsonSharedHandover(params: {
  projectName: string;
  sectionOutputs: SharedHandoverSectionSummary[];
  assetPaths: Array<{ sourcePath: string; storedPath: string }>;
  provenanceSummary?: Array<{ marker: string; count: number }> | undefined;
  repoHistory?: Array<{ shortHash: string; message: string }> | undefined;
}): JsonSharedHandover {
  return JsonSharedHandoverSchema.parse({
    kind: "cx_shared_handover",
    project: params.projectName,
    purpose:
      "shared handover companion for the rendered section outputs below.",
    sections: params.sectionOutputs.map((section) => ({
      name: section.name,
      style: section.style,
      outputFile: section.outputFile,
      fileCount: section.fileCount,
      packedTokens: section.tokenCount,
      outputTokens: section.outputTokenCount,
    })),
    ...(params.assetPaths.length > 0
      ? {
          assets: params.assetPaths.map((asset) => ({
            sourcePath: asset.sourcePath,
            storedPath: asset.storedPath,
          })),
        }
      : {}),
    ...((params.provenanceSummary?.length ?? 0) > 0
      ? {
          inclusionProvenance: (params.provenanceSummary ?? []).map(
            (entry) => ({
              marker: entry.marker,
              count: entry.count,
            }),
          ),
        }
      : {}),
    ...((params.repoHistory?.length ?? 0) > 0
      ? {
          recentRepositoryHistory: (params.repoHistory ?? []).map((entry) => ({
            shortHash: entry.shortHash,
            message: entry.message,
          })),
        }
      : {}),
    usage:
      "use this shared handover with the section files; each section output remains self-contained.",
  });
}

function parseJsonArtifact<T>(
  schema: z.ZodType<T>,
  source: string,
  label: string,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON: ${message}`);
  }

  try {
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join(", ");
      throw new Error(
        `${label} does not match the JSON artifact schema: ${details}`,
      );
    }
    throw error;
  }
}

export function parseJsonSectionOutput(source: string): JsonSectionOutput {
  return parseJsonArtifact(
    JsonSectionOutputSchema,
    source,
    "JSON section output",
  );
}

export function parseJsonSharedHandover(source: string): JsonSharedHandover {
  return parseJsonArtifact(
    JsonSharedHandoverSchema,
    source,
    "JSON shared handover",
  );
}
