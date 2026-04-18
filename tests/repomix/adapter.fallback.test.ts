import { afterEach, describe, expect, mock, test } from "bun:test";
import path from "node:path";

import { runBundleCommand } from "../../src/cli/commands/bundle.js";
import {
  getAdapterModulePath,
  setAdapterPath,
} from "../../src/repomix/capabilities.js";
import {
  getRepomixCapabilities,
  renderSectionWithRepomix,
} from "../../src/repomix/render.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";
import { createRenderFixture } from "./helpers.js";

const DEFAULT_ADAPTER_PATH = getAdapterModulePath();

function installMockAdapter(
  specifier: string,
  exports: Record<string, unknown>,
): void {
  mock.module(specifier, () => exports);
  mock.module(`${specifier}/package.json`, () => ({
    default: {
      name: specifier,
      version: "0.0.0-test",
    },
  }));
  setAdapterPath(specifier);
}

afterEach(() => {
  mock.restore();
  setAdapterPath(DEFAULT_ADAPTER_PATH);
});

describe("Repomix adapter fallback behavior", () => {
  test("captures output spans for markdown and plain styles when renderWithMap is available", async () => {
    const fixture = await createRenderFixture();
    installMockAdapter("repomix-test/with-map", {
      mergeConfigs(
        rootDir: string,
        _fileConfig: unknown,
        cliConfig: Record<string, unknown>,
      ) {
        return {
          cwd: rootDir,
          ...cliConfig,
          output: { ...(cliConfig.output as Record<string, unknown>) },
          tokenCount: {
            ...((cliConfig.tokenCount as Record<string, unknown>) ?? {}),
          },
        };
      },
      async packStructured(
        _rootDirs: string[],
        config: { output: { style: string } },
      ) {
        const output =
          config.output.style === "markdown"
            ? "## File: src/index.ts\n```text\nalpha\nbeta\n```\n"
            : config.output.style === "plain"
              ? "================\nFile: src/index.ts\n================\nalpha\nbeta\n"
              : '<file path="src/index.ts">\nalpha\nbeta\n</file>\n';

        return {
          entries: [
            {
              path: "src/index.ts",
              content: "alpha\nbeta\n",
              metadata: { tokenCount: 7 },
            },
          ],
          render: async (style: string) =>
            style === "markdown"
              ? "## File: src/index.ts\n```text\nalpha\nbeta\n```\n"
              : style === "plain"
                ? "================\nFile: src/index.ts\n================\nalpha\nbeta\n"
                : '<file path="src/index.ts">\nalpha\nbeta\n</file>\n',
          renderWithMap: async (style: string) => ({
            output:
              style === "markdown"
                ? "## File: src/index.ts\n```text\nalpha\nbeta\n```\n"
                : style === "plain"
                  ? "================\nFile: src/index.ts\n================\nalpha\nbeta\n"
                  : '<file path="src/index.ts">\nalpha\nbeta\n</file>\n',
            files: [
              {
                path: "src/index.ts",
                startOffset: 0,
                endOffset: output.length,
                startLine: 1,
              },
            ],
          }),
        };
      },
    });

    const markdownResult = await renderSectionWithRepomix({
      config: fixture.config,
      style: "markdown",
      sourceRoot: fixture.rootDir,
      outputPath: fixture.outputPath,
      sectionName: "src",
      explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
      requireOutputSpans: true,
    });
    expect(markdownResult.fileSpans?.get("src/index.ts")).toEqual({
      outputStartLine: 3,
      outputEndLine: 4,
    });

    const plainResult = await renderSectionWithRepomix({
      config: fixture.config,
      style: "plain",
      sourceRoot: fixture.rootDir,
      outputPath: fixture.outputPath,
      sectionName: "src",
      explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
      requireOutputSpans: true,
    });
    expect(plainResult.fileSpans?.get("src/index.ts")).toEqual({
      outputStartLine: 4,
      outputEndLine: 5,
    });
  });

  test("warns when output spans are unavailable and fails when they are required", async () => {
    const fixture = await createRenderFixture();
    installMockAdapter("repomix-test/no-map", {
      mergeConfigs(
        rootDir: string,
        _fileConfig: unknown,
        cliConfig: Record<string, unknown>,
      ) {
        return {
          cwd: rootDir,
          ...cliConfig,
          output: { ...(cliConfig.output as Record<string, unknown>) },
          tokenCount: {
            ...((cliConfig.tokenCount as Record<string, unknown>) ?? {}),
          },
        };
      },
      async packStructured() {
        return {
          entries: [
            {
              path: "src/index.ts",
              content: "alpha\nbeta\n",
              metadata: { tokenCount: 7 },
            },
          ],
          render: async () =>
            "## File: src/index.ts\n```text\nalpha\nbeta\n```\n",
        };
      },
    });

    const capture = createBufferedCommandIo();
    const renderExitCode = await (async () => {
      const result = await renderSectionWithRepomix({
        config: fixture.config,
        style: "markdown",
        sourceRoot: fixture.rootDir,
        outputPath: fixture.outputPath,
        sectionName: "src",
        explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
        io: capture.io,
      });
      expect(result.fileSpans?.size).toBe(0);
      return 0;
    })();
    expect(renderExitCode).toBe(0);
    expect(capture.stderr()).toContain("Exact output spans are unavailable");

    await expect(
      renderSectionWithRepomix({
        config: fixture.config,
        style: "markdown",
        sourceRoot: fixture.rootDir,
        outputPath: fixture.outputPath,
        sectionName: "src",
        explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
        requireOutputSpans: true,
      }),
    ).rejects.toThrow("Text sections require exact output spans");
  });

  test("throws when neither packStructured nor pack is available", async () => {
    const fixture = await createRenderFixture();
    installMockAdapter("repomix-test/no-pack", {
      mergeConfigs(
        rootDir: string,
        _fileConfig: unknown,
        cliConfig: Record<string, unknown>,
      ) {
        return {
          cwd: rootDir,
          ...cliConfig,
          output: { ...(cliConfig.output as Record<string, unknown>) },
          tokenCount: {
            ...((cliConfig.tokenCount as Record<string, unknown>) ?? {}),
          },
        };
      },
    });

    await expect(
      renderSectionWithRepomix({
        config: fixture.config,
        style: "xml",
        sourceRoot: fixture.rootDir,
        outputPath: fixture.outputPath,
        sectionName: "src",
        explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
      }),
    ).rejects.toThrow(
      "neither packStructured() nor pack() is available for rendering",
    );
  });

  test("bundling requires structured rendering for normalized content hashes", async () => {
    const fixture = await createRenderFixture();
    installMockAdapter("repomix-test/pack-only-bundle", {
      mergeConfigs(
        rootDir: string,
        _fileConfig: unknown,
        cliConfig: Record<string, unknown>,
      ) {
        return {
          cwd: rootDir,
          ...cliConfig,
          output: { ...(cliConfig.output as Record<string, unknown>) },
          tokenCount: {
            ...((cliConfig.tokenCount as Record<string, unknown>) ?? {}),
          },
        };
      },
      async pack(
        rootDirs: string[],
        config: { output: { filePath: string } },
        _progress: unknown,
        _options: unknown,
        explicitFiles: string[],
      ) {
        const fs = await import("node:fs/promises");
        const lines: string[] = [];
        for (const filePath of explicitFiles) {
          const content = await fs.readFile(filePath, "utf8");
          const relativePath = path
            .relative(rootDirs[0] as string, filePath)
            .replaceAll("\\\\", "/");
          lines.push(`<file path="${relativePath}">\n${content}</file>`);
        }
        await fs.writeFile(
          config.output.filePath,
          `<files>\n${lines.join("\n")}\n</files>\n`,
          "utf8",
        );
      },
    });

    const capture = createBufferedCommandIo();
    let thrown: unknown;
    let exitCode = 0;
    try {
      await runBundleCommand({ config: fixture.configPath }, capture.io);
    } catch (error) {
      thrown = error;
      exitCode = 1;
    }

    expect(exitCode).toBe(1);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(
      "packStructured() is required for normalized content hashing",
    );

    const capabilities = await getRepomixCapabilities();
    expect(capabilities.contractValid).toBe(true);
    expect(capabilities.capabilities.supportsPackStructured).toBe(false);
    expect(capabilities.spanCapability).toBe("unsupported");
    expect(capture.stderr()).toContain("missing the cx extension");
  });

  test("renderSectionWithRepomix falls back to pack when structured rendering is unavailable", async () => {
    const fixture = await createRenderFixture({
      config: {
        manifest: {
          includeOutputSpans: false,
        },
      },
    });
    installMockAdapter("repomix-test/pack-only-render", {
      mergeConfigs(
        rootDir: string,
        _fileConfig: unknown,
        cliConfig: Record<string, unknown>,
      ) {
        return {
          cwd: rootDir,
          ...cliConfig,
          output: { ...(cliConfig.output as Record<string, unknown>) },
          tokenCount: {
            ...((cliConfig.tokenCount as Record<string, unknown>) ?? {}),
          },
        };
      },
      async pack(
        rootDirs: string[],
        config: { output: { filePath: string } },
        _progress: unknown,
        _options: unknown,
        explicitFiles: string[],
      ) {
        const fs = await import("node:fs/promises");
        const lines: string[] = [];
        for (const filePath of explicitFiles) {
          const content = await fs.readFile(filePath, "utf8");
          const relativePath = path
            .relative(rootDirs[0] as string, filePath)
            .replaceAll("\\\\", "/");
          lines.push(`<file path="${relativePath}">\n${content}</file>`);
        }
        await fs.writeFile(
          config.output.filePath,
          `<files>\n${lines.join("\n")}\n</files>\n`,
          "utf8",
        );
      },
    });

    const result = await renderSectionWithRepomix({
      config: fixture.config,
      style: "xml",
      sourceRoot: fixture.rootDir,
      outputPath: fixture.outputPath,
      sectionName: "src",
      explicitFiles: [path.join(fixture.rootDir, "src", "index.ts")],
    });

    expect(result.outputText).toContain('<file path="src/index.ts">');
    expect(result.outputTokenCount).toBeGreaterThan(0);
    expect(result.fileTokenCounts.get("src/index.ts")).toBeGreaterThan(0);
  });
});
