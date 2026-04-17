import path from "node:path";

export interface TestWorkspacePaths {
  rootDir: string;
  configPath: string;
  overlayConfigPath?: string;
  bundleDir: string;
}

export function workspacePaths(params: {
  rootDir: string;
  outputDir?: string;
  configFileName?: string;
  overlayFileName?: string;
}): TestWorkspacePaths {
  const configPath = path.join(
    params.rootDir,
    params.configFileName ?? "cx.toml",
  );
  const overlayConfigPath =
    params.overlayFileName === undefined
      ? path.join(params.rootDir, "cx-mcp.toml")
      : path.join(params.rootDir, params.overlayFileName);
  const configuredOutputDir =
    params.outputDir ?? path.join("dist", "demo-bundle");
  const bundleDir = path.isAbsolute(configuredOutputDir)
    ? configuredOutputDir
    : path.join(params.rootDir, configuredOutputDir);

  return {
    rootDir: params.rootDir,
    configPath,
    overlayConfigPath,
    bundleDir,
  };
}
