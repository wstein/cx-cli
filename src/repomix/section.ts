import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { CxConfig, CxStyle } from "../config/types.js";
import { defaultRenderEngine } from "../render/engine.js";

export interface RenderSectionParams {
  config: CxConfig;
  section: string;
  style: CxStyle;
  sourceRoot: string;
  files: string[];
}

export interface RenderSectionResult {
  content: string;
  fileCount: number;
  style: CxStyle;
  tokenCount: number;
}

export async function renderSection(
  params: RenderSectionParams,
): Promise<RenderSectionResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cx-render-"));
  const outputPath = path.join(tmpDir, "output");

  try {
    const explicitFiles = params.files.map((file) =>
      path.isAbsolute(file) ? file : path.join(params.sourceRoot, file),
    );

    const result = await defaultRenderEngine.renderSection({
      config: params.config,
      style: params.style,
      sourceRoot: params.sourceRoot,
      outputPath,
      sectionName: params.section,
      explicitFiles,
    });

    return {
      content: result.outputText,
      fileCount: params.files.length,
      style: params.style,
      tokenCount: result.outputTokenCount,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
