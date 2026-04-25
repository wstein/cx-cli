import { z } from "zod";

const ProvenanceSchema = z.enum([
  "section_match",
  "catch_all_section_match",
  "asset_rule_match",
  "linked_note_enrichment",
  "manifest_note_inclusion",
]);

const ManifestSummarySchema = z.object({
  manifestName: z.string(),
  projectName: z.string(),
  sectionCount: z.number().int().nonnegative(),
  assetCount: z.number().int().nonnegative(),
  derivedReviewExportCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  textFileCount: z.number().int().nonnegative(),
  assetFileCount: z.number().int().nonnegative(),
});

const ExtractabilitySchema = z.object({
  status: z.string(),
  reason: z.string(),
  message: z.string(),
  expectedSha256: z.string().optional(),
  actualSha256: z.string().optional(),
});

const DocsExportDiagnosticSchema = z.object({
  destination: z.string(),
  code: z.enum([
    "raw_xref",
    "antora_family",
    "module_qualified_html",
    "adoc_link",
  ]),
  severity: z.literal("error"),
  message: z.string(),
});

const DocsExportDiagnosticsSchema = z.object({
  status: z.enum(["clean", "flagged"]),
  diagnostics: z.array(DocsExportDiagnosticSchema),
});

const DerivedReviewExportDiagnosticsSchema = z.object({
  status: z.enum(["clean", "flagged", "unavailable"]),
  reason: z.enum(["clean", "source_leak_detected", "artifact_unavailable"]),
  message: z.string(),
  diagnostics: z.array(DocsExportDiagnosticSchema),
});

const InspectFileSchema = z.object({
  relativePath: z.string(),
  absolutePath: z.string(),
  sizeBytes: z.number().nonnegative(),
  mediaType: z.string().optional(),
  provenance: z.array(ProvenanceSchema),
  extractability: ExtractabilitySchema.nullable(),
});

const InspectAssetSchema = z.object({
  relativePath: z.string(),
  absolutePath: z.string(),
  storedPath: z.string(),
  sizeBytes: z.number().nonnegative(),
  provenance: z.array(ProvenanceSchema),
  extractability: ExtractabilitySchema.nullable(),
});

export const InspectReportJsonSchema = z.object({
  selection: z.object({
    derivedReviewExportsOnly: z.boolean(),
  }),
  summary: z.object({
    projectName: z.string(),
    sourceRoot: z.string(),
    bundleDir: z.string(),
    sectionCount: z.number().int().nonnegative(),
    assetCount: z.number().int().nonnegative(),
    derivedReviewExportCount: z.number().int().nonnegative(),
    unmatchedCount: z.number().int().nonnegative(),
    textFileCount: z.number().int().nonnegative(),
  }),
  bundleComparison: z.union([
    z.object({
      available: z.literal(true),
      bundleDir: z.string(),
      manifestName: z.string(),
    }),
    z.object({
      available: z.literal(false),
      bundleDir: z.string(),
      reason: z.string(),
    }),
  ]),
  tokenBreakdown: z
    .object({
      totalTokenCount: z.number().int().nonnegative(),
      sections: z.array(
        z.object({
          name: z.string(),
          fileCount: z.number().int().nonnegative(),
          tokenCount: z.number().int().nonnegative(),
          share: z.number().nonnegative(),
          bar: z.string(),
        }),
      ),
    })
    .optional(),
  sections: z.array(
    z.object({
      name: z.string(),
      style: z.string(),
      outputFile: z.string(),
      files: z.array(InspectFileSchema),
    }),
  ),
  assets: z.array(InspectAssetSchema),
  derivedReviewExports: z.array(
    z.object({
      assemblyName: z.string(),
      title: z.string(),
      moduleName: z.string().nullable(),
      storedPath: z.string(),
      pageCount: z.number().int().nonnegative(),
      sizeBytes: z.number().nonnegative(),
      sha256: z.string(),
      rootLevel: z.union([z.literal(0), z.literal(1)]),
      trustClassification: z.literal("derived_review_export"),
      extractability: ExtractabilitySchema.nullable(),
      diagnostics: DerivedReviewExportDiagnosticsSchema,
    }),
  ),
  unmatchedFiles: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const BundleCommandJsonSchema = z.object({
  projectName: z.string(),
  bundleDir: z.string(),
  manifestName: z.string(),
  checksumFile: z.string(),
  handoverFile: z.string(),
  derivedReviewExports: z.array(
    z.object({
      assemblyName: z.string(),
      title: z.string(),
      moduleName: z.string().nullable(),
      storedPath: z.string(),
      sha256: z.string(),
      sizeBytes: z.number().nonnegative(),
      pageCount: z.number().int().nonnegative(),
      rootLevel: z.union([z.literal(0), z.literal(1)]),
      sourcePaths: z.array(z.string()),
      generator: z.object({
        name: z.string(),
        version: z.string(),
        format: z.literal("multimarkdown"),
        extension: z.literal(".mmd.txt"),
      }),
      trustClassification: z.literal("derived_review_export"),
    }),
  ),
  sections: z.array(
    z.object({
      name: z.string(),
      style: z.string(),
      outputFile: z.string(),
      outputSha256: z.string(),
      fileCount: z.number().int().nonnegative(),
      sizeBytes: z.number().nonnegative(),
      tokenCount: z.number().int().nonnegative(),
      outputTokenCount: z.number().int().nonnegative(),
    }),
  ),
  sectionCount: z.number().int().nonnegative(),
  assetCount: z.number().int().nonnegative(),
  unmatchedCount: z.number().int().nonnegative(),
  dirtyState: z.enum(["clean", "safe_dirty", "forced_dirty", "ci_dirty"]),
  dirtyStateNote: z.string(),
  statistics: z.object({
    totalSectionBytes: z.number().nonnegative(),
    totalAssetBytes: z.number().nonnegative(),
    totalBytes: z.number().nonnegative(),
    totalPackedTokens: z.number().int().nonnegative(),
    totalOutputTokens: z.number().int().nonnegative(),
  }),
  warnings: z.array(z.string()),
});

export const DocsExportCommandJsonSchema = z.union([
  z.object({
    command: z.literal("docs export"),
    valid: z.literal(true),
    projectName: z.string(),
    outputDir: z.string(),
    playbookPath: z.string(),
    rootLevel: z.union([z.literal(0), z.literal(1)]),
    exportCount: z.number().int().nonnegative(),
    totalBytes: z.number().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    totalDiagnostics: z.number().int().nonnegative(),
    exports: z.array(
      z.object({
        assemblyName: z.string(),
        title: z.string(),
        moduleName: z.string().nullable(),
        outputFile: z.string(),
        outputPath: z.string(),
        relativeOutputPath: z.string(),
        pageCount: z.number().int().nonnegative(),
        rootLevel: z.union([z.literal(0), z.literal(1)]),
        sourcePaths: z.array(z.string()),
        sha256: z.string(),
        sizeBytes: z.number().nonnegative(),
        diagnostics: DocsExportDiagnosticsSchema,
      }),
    ),
  }),
  z.object({
    command: z.literal("docs export"),
    valid: z.literal(false),
    projectName: z.string(),
    outputDir: z.string(),
    playbookPath: z.string(),
    rootLevel: z.union([z.literal(0), z.literal(1)]),
    error: z.object({
      type: z.literal("runtime"),
      message: z.string(),
    }),
  }),
]);

export const ListCommandJsonSchema = z.object({
  summary: ManifestSummarySchema,
  settings: z.record(z.string(), z.unknown()),
  display: z.record(z.string(), z.unknown()),
  selection: z.object({
    sections: z.array(z.string()),
    files: z.array(z.string()),
    derivedReviewExportsOnly: z.boolean(),
  }),
  sections: z.array(
    z.object({
      name: z.string(),
      outputFile: z.string(),
      outputSha256: z.string(),
      style: z.string(),
      fileCount: z.number().int().nonnegative(),
      tokenCount: z.number().int().nonnegative(),
      files: z.array(
        z.object({
          path: z.string(),
          kind: z.string(),
          section: z.string(),
          storedIn: z.string(),
          sha256: z.string(),
          sizeBytes: z.number().nonnegative(),
          tokenCount: z.number().int().nonnegative(),
          mtime: z.string(),
          mediaType: z.string(),
          outputStartLine: z.number().int().nullable(),
          outputEndLine: z.number().int().nullable(),
          provenance: z.array(ProvenanceSchema).optional(),
        }),
      ),
    }),
  ),
  assets: z.array(
    z.object({
      sourcePath: z.string(),
      storedPath: z.string(),
      sha256: z.string(),
      sizeBytes: z.number().nonnegative(),
      mtime: z.string(),
      mediaType: z.string(),
      provenance: z.array(ProvenanceSchema).optional(),
    }),
  ),
  derivedReviewExports: z.array(
    z.object({
      assemblyName: z.string(),
      title: z.string(),
      moduleName: z.string().nullable(),
      storedPath: z.string(),
      sha256: z.string(),
      sizeBytes: z.number().nonnegative(),
      pageCount: z.number().int().nonnegative(),
      rootLevel: z.union([z.literal(0), z.literal(1)]),
      sourcePaths: z.array(z.string()),
      trustClassification: z.literal("derived_review_export"),
      status: z.enum(["intact", "blocked"]),
      extractability: z.object({
        status: z.enum(["intact", "blocked"]),
        reason: z.string(),
        message: z.string(),
        expectedSha256: z.string().optional(),
        actualSha256: z.string().optional(),
      }),
      diagnostics: DerivedReviewExportDiagnosticsSchema,
    }),
  ),
  files: z.array(
    z.object({
      path: z.string(),
      section: z.string(),
      bytes: z.number().nonnegative(),
      tokens: z.number().int().nonnegative(),
      mtime: z.string(),
      mtimeRelative: z.string(),
      status: z.enum(["intact", "copied", "degraded", "blocked"]),
      provenance: z.array(ProvenanceSchema).optional(),
      extractability: z.object({
        status: z.enum(["intact", "copied", "degraded", "blocked"]),
        reason: z.string(),
        message: z.string(),
        expectedSha256: z.string().optional(),
        actualSha256: z.string().optional(),
      }),
    }),
  ),
});

const LockDriftEntrySchema = z.object({
  setting: z.string(),
  locked: z.string(),
  lockedSource: z.string(),
  current: z.string(),
  currentSource: z.string(),
});

export const VerifyCommandJsonSchema = z.union([
  z.object({
    bundleDir: z.string(),
    againstDir: z.string().nullable(),
    sections: z.array(z.string()),
    files: z.array(z.string()),
    valid: z.literal(true),
    dirtyState: z
      .enum(["clean", "safe_dirty", "forced_dirty", "ci_dirty"])
      .nullable(),
    bundleMode: z.enum(["local", "ci"]).nullable(),
    derivedReviewExports: z
      .object({
        totalCount: z.number().int().nonnegative(),
        intactCount: z.number().int().nonnegative(),
        blockedCount: z.number().int().nonnegative(),
        cleanCount: z.number().int().nonnegative(),
        flaggedCount: z.number().int().nonnegative(),
        unavailableCount: z.number().int().nonnegative(),
        totalDiagnosticCount: z.number().int().nonnegative(),
        files: z.array(
          z.object({
            storedPath: z.string(),
            status: z.enum(["intact", "blocked"]),
            reason: z.enum(["intact", "missing_artifact", "hash_mismatch"]),
            diagnosticStatus: z.enum(["clean", "flagged", "unavailable"]),
            diagnosticCount: z.number().int().nonnegative(),
          }),
        ),
      })
      .nullable(),
    warnings: z.array(z.string()),
    lockDrift: z.array(LockDriftEntrySchema).nullable(),
  }),
  z.object({
    bundleDir: z.string(),
    againstDir: z.string().nullable(),
    sections: z.array(z.string()),
    files: z.array(z.string()),
    valid: z.literal(false),
    dirtyState: z
      .enum(["clean", "safe_dirty", "forced_dirty", "ci_dirty"])
      .nullable(),
    bundleMode: z.enum(["local", "ci"]).nullable(),
    derivedReviewExports: z
      .object({
        totalCount: z.number().int().nonnegative(),
        intactCount: z.number().int().nonnegative(),
        blockedCount: z.number().int().nonnegative(),
        cleanCount: z.number().int().nonnegative(),
        flaggedCount: z.number().int().nonnegative(),
        unavailableCount: z.number().int().nonnegative(),
        totalDiagnosticCount: z.number().int().nonnegative(),
        files: z.array(
          z.object({
            storedPath: z.string(),
            status: z.enum(["intact", "blocked"]),
            reason: z.enum(["intact", "missing_artifact", "hash_mismatch"]),
            diagnosticStatus: z.enum(["clean", "flagged", "unavailable"]),
            diagnosticCount: z.number().int().nonnegative(),
          }),
        ),
      })
      .nullable(),
    error: z.object({
      type: z.string().optional(),
      message: z.string(),
      path: z.string().optional(),
      remediation: z
        .object({
          recommendedCommand: z.string().optional(),
          docsRef: z.string().optional(),
          whyThisProtectsYou: z.string().optional(),
          nextSteps: z.array(z.string()).optional(),
        })
        .nullable(),
    }),
  }),
]);

export const ConfigCommandJsonSchema = z.object({
  configFile: z.string().nullable(),
  cxStrict: z.boolean(),
  cliMode: z.enum(["--strict", "--lenient"]).nullable(),
  settings: z.object({
    "dedup.mode": z.object({
      value: z.string(),
      source: z.string(),
    }),
    "repomix.missing_extension": z.object({
      value: z.string(),
      source: z.string(),
    }),
    "config.duplicate_entry": z.object({
      value: z.string(),
      source: z.string(),
    }),
  }),
});

export const ConfigCommandErrorJsonSchema = z.object({
  error: z.string(),
});

export const AdapterCapabilitiesJsonSchema = z.object({
  cx: z.object({
    version: z.string(),
  }),
  oracleAdapter: z.object({
    modulePath: z.string(),
    packageName: z.string(),
    packageVersion: z.string(),
    adapterContract: z.string(),
    compatibilityStrategy: z.string(),
    contractValid: z.boolean(),
    contractErrors: z.array(z.string()),
  }),
  referenceAdapter: z.object({
    modulePath: z.string(),
    packageName: z.string(),
    packageVersion: z.string(),
    installed: z.boolean(),
    usage: z.string(),
  }),
  detectedCapabilities: z.object({
    hasMergeConfigs: z.boolean(),
    hasPack: z.boolean(),
    supportsPackStructured: z.boolean(),
    supportsRenderWithMap: z.boolean(),
  }),
  capabilities: z.object({
    styles: z.array(z.string()),
    spanCapability: z.enum(["supported", "unsupported", "partial"]),
    spanCapabilityReason: z.string(),
    exactFileSelection: z.boolean(),
    sectionPlanning: z.boolean(),
  }),
});

export const AdapterInspectJsonSchema = z.object({
  projectName: z.string(),
  sourceRoot: z.string(),
  sections: z.array(
    z.object({
      name: z.string(),
      style: z.string(),
      fileCount: z.number().int().nonnegative(),
      files: z.array(z.string()),
    }),
  ),
  adapterOptions: z.object({
    showLineNumbers: z.boolean(),
    includeEmptyDirectories: z.boolean(),
    securityCheck: z.boolean(),
    tokenEncoding: z.string(),
  }),
});

export const AdapterDoctorJsonSchema = z.object({
  passed: z.boolean(),
  checks: z.array(
    z.object({
      name: z.string(),
      passed: z.boolean(),
      message: z.string(),
    }),
  ),
});

export const ValidateCommandJsonSchema = z.object({
  bundleDir: z.string(),
  summary: ManifestSummarySchema,
  checksumFile: z.string(),
  sourceRoot: z.string(),
  bundleVersion: z.number().int().nonnegative(),
  schemaVersion: z.number().int().nonnegative(),
  valid: z.literal(true),
  notes: z.object({
    count: z.number().int().nonnegative(),
    valid: z.boolean(),
  }),
});

const ExtractBaseJsonSchema = z.object({
  bundleDir: z.string(),
  destinationDir: z.string(),
  selection: z.object({
    sections: z.array(z.string()),
    files: z.array(z.string()),
  }),
  assetsOnly: z.boolean(),
  allowDegraded: z.boolean(),
  summary: ManifestSummarySchema,
  verify: z.boolean(),
});

export const ExtractCommandJsonSchema = z.union([
  ExtractBaseJsonSchema.extend({
    extractedSections: z.array(z.string()),
    extractedAssets: z.array(z.string()),
    extractedFiles: z.array(z.string()),
    valid: z.literal(true),
  }),
  ExtractBaseJsonSchema.extend({
    extractedSections: z.array(z.string()),
    extractedAssets: z.array(z.string()),
    extractedFiles: z.array(z.string()),
    valid: z.literal(false),
    error: z.object({
      type: z.string(),
      message: z.string(),
      remediation: z
        .object({
          recommendedCommand: z.string().optional(),
          docsRef: z.string().optional(),
          whyThisProtectsYou: z.string().optional(),
          nextSteps: z.array(z.string()).optional(),
        })
        .nullable(),
      files: z.array(
        z.object({
          path: z.string(),
          section: z.string(),
          status: z.string(),
          reason: z.string(),
          expectedSha256: z.string().optional(),
          actualSha256: z.string().optional(),
          message: z.string(),
        }),
      ),
    }),
  }),
]);

export const RenderCommandJsonSchema = z.object({
  projectName: z.string(),
  sourceRoot: z.string(),
  selection: z.object({
    sections: z.array(z.string()),
    files: z.array(z.string()),
  }),
  outputs: z.array(
    z.object({
      section: z.string(),
      fileCount: z.number().int().nonnegative(),
      sizeBytes: z.number().nonnegative(),
      tokenCount: z.number().int().nonnegative(),
      outputFile: z.string().nullable().optional(),
    }),
  ),
});

export const InitStdoutJsonSchema = z.object({
  config: z.string(),
  projectName: z.string(),
  style: z.string(),
  path: z.null(),
});

export const InitCommandJsonSchema = z.object({
  projectName: z.string(),
  style: z.string(),
  path: z.string(),
  notesDir: z.string(),
  notesCreated: z.array(z.string()),
  notesUpdated: z.array(z.string()),
  makefileCreated: z.boolean(),
  makefileUpdated: z.boolean(),
  mcpCreated: z.boolean(),
  mcpUpdated: z.boolean(),
  buildMcpCreated: z.boolean(),
  buildMcpUpdated: z.boolean(),
});

export const DoctorWorkflowJsonSchema = z.object({
  task: z.string(),
  mode: z.string(),
  sequence: z.array(z.string()),
  reason: z.string(),
  signals: z.array(z.string()),
});

export const DoctorFixOverlapsJsonSchema = z.object({
  configPath: z.string(),
  changed: z.boolean(),
  conflictCount: z.number().int().nonnegative(),
  excludesBySection: z.record(z.string(), z.array(z.string())),
  dryRun: z.boolean().optional(),
  ownership: z
    .array(
      z.object({
        path: z.string(),
        owner: z.string(),
      }),
    )
    .optional(),
});

export const AuditSummaryCommandJsonSchema = z.object({
  command: z.literal("audit summary"),
  workspaceRoot: z.string(),
  auditLogPath: z.string(),
  totalEvents: z.number().int().nonnegative(),
  allowedCount: z.number().int().nonnegative(),
  deniedCount: z.number().int().nonnegative(),
  byCapability: z.object({
    read: z.number().int().nonnegative(),
    observe: z.number().int().nonnegative(),
    plan: z.number().int().nonnegative(),
    mutate: z.number().int().nonnegative(),
  }),
  byPolicyName: z.record(z.string(), z.number().int().nonnegative()),
  recentTraceIds: z.array(z.string()),
});
