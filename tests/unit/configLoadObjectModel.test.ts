// test-lane: unit

import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { loadCxConfigFromTomlString } from "../../src/config/load.js";
import {
  type BuildConfigOptions,
  buildConfig,
} from "../helpers/config/buildConfig.js";
import { toToml } from "../helpers/config/toToml.js";

const VIRTUAL_CONFIG_PATH = path.join(
  os.tmpdir(),
  "cx-config-load-object-model",
  "cx.toml",
);

async function loadConfig(overrides: BuildConfigOptions = {}) {
  const config = buildConfig(overrides);
  return loadCxConfigFromTomlString(
    VIRTUAL_CONFIG_PATH,
    toToml(config),
    {},
    {},
    { emitBehaviorLogs: false },
  );
}

describe("loadCxConfig object model", () => {
  test("loads a valid config and applies defaults", async () => {
    const config = await loadConfig();
    expect(config.projectName).toBe("demo");
    expect(config.assets.targetDir).toBe("demo-assets");
    expect(config.docs.targetDir).toBe("demo-docs-exports");
    expect(config.docs.rootLevel).toBe(1);
    expect(config.assets.layout).toBe("flat");
    expect(config.checksums.fileName).toBe("demo.sha256");
    expect(config.tokens.encoding).toBe("o200k_base");
    expect(config.output.extensions).toEqual({
      xml: ".xml.txt",
      json: ".json.txt",
      markdown: ".md",
      plain: ".txt",
    });
    expect(config.handover.includeRepoHistory).toBe(false);
    expect(config.handover.repoHistoryCount).toBe(25);
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });

  test("loads shared handover history settings from config", async () => {
    const config = await loadConfig({
      handover: {
        includeRepoHistory: true,
        repoHistoryCount: 12,
      },
    });

    expect(config.handover.includeRepoHistory).toBe(true);
    expect(config.handover.repoHistoryCount).toBe(12);
  });

  test("loads notes gating settings from config", async () => {
    const config = await loadConfig({
      notes: {
        requireCognitionScore: 80,
        strictNotesMode: true,
        failOnDriftPressuredNotes: true,
        appliesToSections: ["docs"],
      },
    });

    expect(config.notes.requireCognitionScore).toBe(80);
    expect(config.notes.strictNotesMode).toBe(true);
    expect(config.notes.failOnDriftPressuredNotes).toBe(true);
    expect(config.notes.appliesToSections).toEqual(["docs"]);
  });

  test("loads notes extraction profiles from config", async () => {
    const config = await loadConfig({
      notes: {
        profiles: {
          arc42: {
            description: "Compile arc42 note bundles.",
            outputFormat: "json",
            targetPaths: ["docs/modules/architecture/pages/index.adoc"],
            includeTags: ["architecture"],
            excludeTags: ["draft"],
            requiredNotes: ["Render Kernel Constitution"],
            includeTargets: ["current", "v0.5"],
            sectionOrder: ["constraints", "solution-strategy"],
            sectionTags: {
              constraints: ["contract"],
            },
            llm: {
              systemRole:
                "You are a senior software architect and technical writer.",
              instructions:
                "Update architecture documentation in AsciiDoc. Treat the codebase and notes as the single source of truth.",
              targetFormat: "asciidoc",
              documentKind: "arc42 architecture",
              audience: "architects-and-maintainers",
              tone: "formal-technical",
              mustCiteNoteTitles: true,
              mustPreserveUncertainty: true,
              mustNotInventFacts: true,
              mustIncludeProvenance: true,
              mustSurfaceConflicts: true,
            },
          },
        },
      },
    });

    expect(config.notes.profiles.arc42).toEqual({
      description: "Compile arc42 note bundles.",
      outputFormat: "json",
      targetPaths: ["docs/modules/architecture/pages/index.adoc"],
      includeTags: ["architecture"],
      excludeTags: ["draft"],
      requiredNotes: ["Render Kernel Constitution"],
      includeTargets: ["current", "v0.5"],
      sectionOrder: ["constraints", "solution-strategy"],
      sectionTags: {
        constraints: ["contract"],
      },
      llm: {
        systemRole: "You are a senior software architect and technical writer.",
        instructions:
          "Update architecture documentation in AsciiDoc. Treat the codebase and notes as the single source of truth.",
        targetFormat: "asciidoc",
        documentKind: "arc42 architecture",
        audience: "architects-and-maintainers",
        tone: "formal-technical",
        mustCiteNoteTitles: true,
        mustPreserveUncertainty: true,
        mustNotInventFacts: true,
        mustIncludeProvenance: true,
        mustSurfaceConflicts: true,
      },
    });
  });

  test("rejects notes extraction profiles without a selection surface", async () => {
    await expect(
      loadConfig({
        notes: {
          profiles: {
            empty_contract: {
              description: "This profile is missing a selection surface.",
              outputFormat: "markdown",
              targetPaths: ["docs/modules/manual/pages/index.adoc"],
              includeTags: [],
              excludeTags: [],
              requiredNotes: [],
              includeTargets: ["current"],
              sectionOrder: ["reference-notes"],
              sectionTags: {},
              llm: {
                systemRole: "You are a technical writer.",
                instructions: "Write carefully.",
                targetFormat: "asciidoc",
                documentKind: "manual",
                audience: "operators",
                tone: "technical",
                mustCiteNoteTitles: true,
                mustPreserveUncertainty: true,
                mustNotInventFacts: true,
                mustIncludeProvenance: true,
                mustSurfaceConflicts: true,
              },
            },
          },
        },
      }),
    ).rejects.toThrow(
      "notes.profiles.empty_contract must define at least one note-selection surface",
    );
  });

  test("loads scanner settings from config", async () => {
    const config = await loadConfig({
      scanner: {
        mode: "fail",
        ids: ["reference_secrets"],
        includePostPackArtifacts: true,
      },
    });

    expect(config.scanner.mode).toBe("fail");
    expect(config.scanner.ids).toEqual(["reference_secrets"]);
    expect(config.scanner.includePostPackArtifacts).toBe(true);
  });

  test("loads custom output extension overrides", async () => {
    const config = await loadConfig({
      output: {
        extensions: {
          xml: ".xml.bundle.txt",
          json: ".json.bundle.txt",
          markdown: ".md",
          plain: ".txt",
        },
      },
    });

    expect(config.output.extensions).toEqual({
      xml: ".xml.bundle.txt",
      json: ".json.bundle.txt",
      markdown: ".md",
      plain: ".txt",
    });
  });

  test("loads token encoding overrides", async () => {
    const config = await loadConfig({
      tokens: { encoding: "cl100k_base" },
    });

    expect(config.tokens.encoding).toBe("cl100k_base");
  });

  test("expands tilde and environment variables in config paths", async () => {
    const previousOutputBase = process.env.CX_OUTPUT_BASE;
    const tempOutputBase = path.join(os.tmpdir(), "cx-config-output-base");
    process.env.CX_OUTPUT_BASE = tempOutputBase;

    try {
      const config = await loadConfig({
        sourceRoot: `\${HOME}/workspace`,
        outputDir: "$CX_OUTPUT_BASE/{project}",
      });

      expect(config.sourceRoot).toBe(path.join(os.homedir(), "workspace"));
      expect(config.outputDir).toBe(path.join(tempOutputBase, "demo"));
    } finally {
      process.env.CX_OUTPUT_BASE = previousOutputBase;
    }
  });

  test("expands a leading tilde in output_dir", async () => {
    const config = await loadConfig({
      outputDir: "~/Downloads/demo-bundle",
    });

    expect(config.outputDir).toBe(
      path.join(os.homedir(), "Downloads/demo-bundle"),
    );
  });

  test("expands the project token in checksum, asset, and docs paths", async () => {
    const config = await loadConfig({
      checksums: {
        fileName: "{project}.lock",
      },
      assets: {
        targetDir: "{project}-assets",
      },
      docs: {
        targetDir: "{project}-review-docs",
      },
    });

    expect(config.checksums.fileName).toBe("demo.lock");
    expect(config.assets.targetDir).toBe("demo-assets");
    expect(config.docs.targetDir).toBe("demo-review-docs");
  });

  test("loads section priority from config", async () => {
    const config = await loadConfig({
      sections: {
        src: {
          include: ["src/**"],
          exclude: [],
          priority: 10,
        },
      },
    });

    expect(config.sections.src?.priority).toBe(10);
  });

  test("loads assets.layout = deep from config", async () => {
    const config = await loadConfig({
      assets: { layout: "deep" },
    });

    expect(config.assets.layout).toBe("deep");
    expect(config.behaviorSources.assetsLayout).toBe("cx.toml");
  });

  test("loads a catch_all section without include patterns", async () => {
    const config = await loadConfig({
      sections: {
        src: {
          include: ["src/**"],
          exclude: [],
        },
        other: {
          exclude: [],
          catchAll: true,
        },
      },
    });

    expect(config.sections.other?.catch_all).toBe(true);
    expect(config.sections.other?.include).toBeUndefined();
    expect(config.sections.src?.include).toEqual(["src/**"]);
  });

  test("files.include defaults to an empty array", async () => {
    const config = await loadConfig();
    expect(config.files.include).toEqual([]);
  });

  test("loads files.include patterns from config", async () => {
    const config = await loadConfig({
      files: {
        include: ["generated/**", "dist-public/**"],
        exclude: [],
      },
    });

    expect(config.files.include).toEqual(["generated/**", "dist-public/**"]);
  });
});
