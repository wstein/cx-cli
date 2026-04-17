import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CxConfig } from "../../../src/config/types.js";
import { toToml } from "../config/toToml.js";
import { copyFixture } from "./copyFixture.js";
import { workspacePaths } from "./workspacePaths.js";
import { writeFiles } from "./writeFiles.js";

export interface CreateWorkspaceOptions {
  fixture?: string;
  config?: CxConfig;
  overlayConfig?: Record<string, unknown>;
  files?: Record<string, string | Uint8Array>;
  outputDir?: string;
  configFileName?: string;
  overlayFileName?: string;
}

export interface CreatedWorkspace {
  rootDir: string;
  configPath: string;
  overlayConfigPath?: string;
  bundleDir: string;
}

export async function createWorkspace(
  options: CreateWorkspaceOptions = {},
): Promise<CreatedWorkspace> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-test-"));

  if (options.fixture) {
    await copyFixture({
      fixturePath: options.fixture,
      destinationPath: rootDir,
    });
  }

  if (options.files) {
    await writeFiles({
      rootDir,
      files: options.files,
    });
  }

  const workspaceParams: {
    rootDir: string;
    outputDir?: string;
    configFileName?: string;
    overlayFileName?: string;
  } = {
    rootDir,
  };

  if (options.configFileName !== undefined) {
    workspaceParams.configFileName = options.configFileName;
  }

  const outputDir = options.outputDir ?? options.config?.outputDir;
  if (outputDir !== undefined) {
    workspaceParams.outputDir = outputDir;
  }

  if (
    options.overlayConfig !== undefined ||
    options.overlayFileName !== undefined
  ) {
    workspaceParams.overlayFileName = options.overlayFileName ?? "cx-mcp.toml";
  }

  const paths = workspacePaths(workspaceParams);

  if (options.config) {
    await fs.writeFile(
      paths.configPath,
      toToml(options.config as unknown as Record<string, unknown>),
      "utf8",
    );
  }

  if (options.overlayConfig && paths.overlayConfigPath) {
    await fs.writeFile(
      paths.overlayConfigPath,
      toToml(options.overlayConfig),
      "utf8",
    );
  }

  const result: CreatedWorkspace = {
    rootDir,
    configPath: paths.configPath,
    bundleDir: paths.bundleDir,
  };

  if (options.overlayConfig && paths.overlayConfigPath) {
    result.overlayConfigPath = paths.overlayConfigPath;
  }

  return result;
}
