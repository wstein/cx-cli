// test-lane: integration

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { runExtractCommand } from "../../src/cli/commands/extract.js";
import { runListCommand } from "../../src/cli/commands/list.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";
import {
  createProject,
  expectExtractedFilesToMatchManifest,
  runQuietBundleCommand,
  tamperSectionOutput,
} from "./helpers.js";

describe("bundle extract", () => {
  test("emits filtered JSON for list and extract automation", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-filtered");

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    const listCapture = createBufferedCommandIo();
    const listExitCode = await runListCommand(
      {
        bundleDir: project.bundleDir,
        files: ["src/index.ts"],
        json: true,
        sections: ["src"],
      },
      listCapture.io,
    );
    expect(listExitCode).toBe(0);
    const listPayload = parseJsonOutput<{
      summary?: { fileCount?: number; sectionCount?: number };
      selection?: { sections?: string[]; files?: string[] };
      files?: Array<{
        path: string;
        status?: string;
        mtime?: string;
        extractability?: { status?: string; reason?: string };
      }>;
    }>(listCapture.stdout());

    const extractCapture = createBufferedCommandIo();
    const extractExitCode = await runExtractCommand(
      {
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: ["src"],
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
        json: true,
      },
      extractCapture.io,
    );
    expect(extractExitCode).toBe(0);
    const extractPayload = parseJsonOutput<{
      summary?: { fileCount?: number; textFileCount?: number };
      extractedSections?: string[];
      extractedFiles?: string[];
      selection?: { sections?: string[] };
    }>(extractCapture.stdout());

    expect(listPayload.summary?.fileCount).toBe(1);
    expect(listPayload.summary?.sectionCount).toBe(1);
    expect(listPayload.selection?.sections).toEqual(["src"]);
    expect(listPayload.selection?.files).toEqual(["src/index.ts"]);
    expect(listPayload.files?.map((file) => file.path)).toEqual([
      "src/index.ts",
    ]);
    expect(listPayload.files?.[0]?.status).toBe("intact");
    expect(listPayload.files?.[0]?.mtime).toBeDefined();
    expect(listPayload.files?.[0]?.extractability?.status).toBe("intact");

    expect(extractPayload.summary?.fileCount).toBe(2);
    expect(extractPayload.summary?.textFileCount).toBe(1);
    expect(extractPayload.extractedSections).toEqual(["src"]);
    expect(extractPayload.extractedFiles?.sort()).toEqual([
      "logo.png",
      "src/index.ts",
    ]);
    expect(extractPayload.selection?.sections).toEqual(["src"]);
  });

  test("round-trips extracted files exactly for xml bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored");

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    await expectExtractedFilesToMatchManifest({
      bundleDir: project.bundleDir,
      restoreDir,
    });
  });

  test("round-trips extracted files exactly for json bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-json");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "json"',
      ),
      "utf8",
    );

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    await expectExtractedFilesToMatchManifest({
      bundleDir: project.bundleDir,
      restoreDir,
    });
  });

  test("round-trips extracted files exactly for markdown bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-markdown");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "markdown"',
      ),
      "utf8",
    );

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    await expectExtractedFilesToMatchManifest({
      bundleDir: project.bundleDir,
      restoreDir,
    });
  });

  test("round-trips extracted files exactly for plain bundles", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-plain");
    await fs.writeFile(
      project.configPath,
      (await fs.readFile(project.configPath, "utf8")).replace(
        'style = "xml"',
        'style = "plain"',
      ),
      "utf8",
    );

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    expect(
      await runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: undefined,
        assetsOnly: false,
        overwrite: false,
        verify: true,
      }),
    ).toBe(0);

    await expectExtractedFilesToMatchManifest({
      bundleDir: project.bundleDir,
      restoreDir,
    });
  });

  test("blocks degraded extraction unless explicitly allowed", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-lossy");
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );

    const capture = createBufferedCommandIo();
    const exitCode = await runExtractCommand(
      {
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: ["src/index.ts"],
        assetsOnly: false,
        overwrite: false,
        verify: false,
      },
      capture.io,
    );
    expect(exitCode).toBe(8);
  });

  test("emits structured JSON failure payload for extract mismatches", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-lossy-json");

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
    const extractCapture = createBufferedCommandIo();
    const extractExitCode = await runExtractCommand(
      {
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: ["src/index.ts"],
        assetsOnly: false,
        overwrite: false,
        verify: false,
        json: true,
      },
      extractCapture.io,
    );
    expect(extractExitCode).toBe(8);
    const payload = parseJsonOutput<{
      valid?: boolean;
      error?: {
        type?: string;
        remediation?: {
          recommendedCommand?: string;
          docsRef?: string;
          nextSteps?: string[];
        } | null;
        files?: Array<{
          path?: string;
          reason?: string;
          expectedSha256?: string;
          actualSha256?: string;
        }>;
      };
    }>(extractCapture.stdout());

    expect(payload.valid).toBe(false);
    expect(payload.error?.type).toBe("extractability_mismatch");
    expect(payload.error?.remediation?.recommendedCommand).toContain(
      "--allow-degraded",
    );
    expect(payload.error?.files?.[0]?.path).toBe("src/index.ts");
    expect(payload.error?.files?.[0]?.reason).toBe("manifest_hash_mismatch");
    expect(payload.error?.files?.[0]?.expectedSha256).toBeDefined();
    expect(payload.error?.files?.[0]?.actualSha256).toBeDefined();
  });

  test("surfaces checksum prefixes for long special paths", async () => {
    const project = await createProject({ includeSpecialChecksumFile: true });
    const restoreDir = path.join(project.root, "restored-special");

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      "export const special = true;\n",
      "export const special = false;\n",
    );
    const capture = createBufferedCommandIo();
    const exitCode = await runExtractCommand(
      {
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: ["src/special cases/checksum + edge.ts"],
        assetsOnly: false,
        overwrite: false,
        verify: false,
      },
      capture.io,
    );
    expect(exitCode).toBe(8);

    const output = capture.stderr();
    expect(output).toContain("src/special cases/checksum + edge.ts");
    expect(output).toMatch(/expected [a-f0-9]{8}… got [a-f0-9]{8}…/);
  });

  test("surfaces blocked extractability in list JSON before extraction", async () => {
    const project = await createProject();

    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
    const capture = createBufferedCommandIo();
    const exitCode = await runListCommand(
      {
        bundleDir: project.bundleDir,
        files: ["src/index.ts"],
        json: true,
      },
      capture.io,
    );
    expect(exitCode).toBe(0);
    const payload = parseJsonOutput<{
      files?: Array<{
        path?: string;
        status?: string;
        extractability?: {
          status?: string;
          reason?: string;
          expectedSha256?: string;
          actualSha256?: string;
        };
      }>;
    }>(capture.stdout());

    expect(payload.files?.[0]?.path).toBe("src/index.ts");
    expect(payload.files?.[0]?.status).toBe("degraded");
    expect(payload.files?.[0]?.extractability?.status).toBe("degraded");
    expect(payload.files?.[0]?.extractability?.reason).toBe(
      "manifest_hash_mismatch",
    );
    expect(payload.files?.[0]?.extractability?.expectedSha256).toBeDefined();
    expect(payload.files?.[0]?.extractability?.actualSha256).toBeDefined();
  });

  test("extracts degraded files with explicit opt-in", async () => {
    const project = await createProject();
    const restoreDir = path.join(project.root, "restored-degraded");
    expect(await runQuietBundleCommand({ config: project.configPath })).toBe(0);
    await tamperSectionOutput(
      project.bundleDir,
      "src",
      'export const demo = "================";\n',
      'export const demo = "tampered";\n',
    );
    await expect(
      runExtractCommand({
        bundleDir: project.bundleDir,
        destinationDir: restoreDir,
        sections: undefined,
        files: ["src/index.ts"],
        assetsOnly: false,
        allowDegraded: true,
        overwrite: false,
        verify: false,
      }),
    ).resolves.toBe(0);

    expect(
      await fs.readFile(path.join(restoreDir, "src", "index.ts"), "utf8"),
    ).not.toBe(
      await fs.readFile(path.join(project.root, "src", "index.ts"), "utf8"),
    );
  });
});
