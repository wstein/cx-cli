import fs from "node:fs/promises";
import path from "node:path";
import { loadCxConfig } from "../../src/config/load.js";
import {
  type BuildConfigOptions,
  buildConfig,
} from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

async function loadQuietCxConfig(configPath: string) {
  return loadCxConfig(configPath, undefined, undefined, {
    emitBehaviorLogs: false,
  });
}

export async function createRenderFixture(
  options: {
    config?: BuildConfigOptions;
    files?: Record<string, string | Uint8Array>;
  } = {},
): Promise<{
  rootDir: string;
  configPath: string;
  config: Awaited<ReturnType<typeof loadCxConfig>>;
  outputPath: string;
}> {
  const workspace = await createWorkspace({
    config: buildConfig({
      assets: {
        include: [],
        exclude: [],
        mode: "ignore",
        targetDir: "assets",
      },
      manifest: {
        includeOutputSpans: true,
      },
      sections: {
        src: {
          include: ["src/**"],
          exclude: [],
        },
      },
      ...options.config,
    }),
    files: {
      "src/index.ts": "export const ok = 1;\n",
      ...(options.files ?? {}),
    },
  });

  return {
    rootDir: workspace.rootDir,
    configPath: workspace.configPath,
    config: await loadQuietCxConfig(workspace.configPath),
    outputPath: path.join(workspace.rootDir, "render.out"),
  };
}

export async function writeMockReferenceOracleAdapter(
  oracleDir: string,
  options: {
    withPackStructured: boolean;
    withRenderWithMap: boolean;
    withPack: boolean;
  },
): Promise<void> {
  await fs.writeFile(
    path.join(oracleDir, "package.json"),
    JSON.stringify({
      name: "mock-reference-oracle",
      type: "module",
      exports: "./index.js",
    }),
    "utf8",
  );

  const pieces: string[] = [
    'import fs from "node:fs/promises";',
    'import path from "node:path";',
    `
function renderOutput(style) {
  if (style === "markdown") {
    return '## File: src/index.ts\\n\`\`\`text\\nalpha\\nbeta\\n\`\`\`\\n';
  }

  if (style === "plain") {
    return '================\\nFile: src/index.ts\\n================\\nalpha\\nbeta\\n';
  }

  return '<file path="src/index.ts">\\nalpha\\nbeta\\n</file>\\n';
}
`,
    `
export function mergeConfigs(rootDir, _fileConfig, cliConfig) {
  return {
    cwd: rootDir,
    ...cliConfig,
    output: { ...cliConfig.output },
    tokenCount: { ...(cliConfig.tokenCount ?? {}) },
  };
}
`,
  ];

  if (options.withPackStructured) {
    pieces.push(
      `
export async function packStructured(_rootDirs, config, _options) {
  const output = renderOutput(config.output.style);
  return {
    entries: [
      {
        path: "src/index.ts",
        content: "alpha\\nbeta\\n",
        metadata: { tokenCount: 7 },
      },
    ],
    render: async (style) => renderOutput(style),
    ${
      options.withRenderWithMap
        ? `renderWithMap: async (style) => ({
      output: renderOutput(style),
      files: [
        {
          path: "src/index.ts",
          startOffset: 0,
          endOffset: output.length,
          startLine: 1,
        },
      ],
    }),`
        : ""
    }
  };
}
`,
    );
  }

  if (options.withPack) {
    pieces.push(
      `
export async function pack(rootDirs, config, _progress, _options, explicitFiles) {
  const rootDir = rootDirs[0];
  const files = [];
  for (const filePath of explicitFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const relativePath = path.relative(rootDir, filePath).replaceAll("\\\\", "/");
    files.push(\`<file path="\${relativePath}">\\n\${content}</file>\`);
  }
  const output = \`<files>\\n\${files.join("\\n")}\\n</files>\\n\`;
  await fs.writeFile(config.output.filePath, output, "utf8");
}
`,
    );
  }

  await fs.writeFile(
    path.join(oracleDir, "index.js"),
    pieces.join("\n"),
    "utf8",
  );
}
