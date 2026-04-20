import type {
  EnvironmentKind,
  TemplateDescriptor,
  TemplateMetadata,
} from "./types.js";

const COMMON_REQUIRED_FILES = [
  {
    destinationPath: "cx.toml",
    templateName: "cx.toml",
    description: "Primary CX configuration file.",
  },
  {
    destinationPath: ".editorconfig",
    templateName: ".editorconfig",
    description: "Workspace editor defaults.",
  },
  {
    destinationPath: "Makefile",
    templateName: "Makefile",
    description: "Workspace-local developer task wrapper.",
  },
  {
    destinationPath: "cx-mcp.toml",
    templateName: "cx-mcp.toml",
    description: "Authoring-oriented MCP overlay for the workspace root.",
  },
  {
    destinationPath: ".mcp.json",
    templateName: ".mcp.json",
    description: "Workspace-local MCP client declaration.",
  },
  {
    destinationPath: ".vscode/mcp.json",
    templateName: ".vscode/mcp.json",
    description: "VS Code MCP server wiring.",
  },
  {
    destinationPath: ".claude/settings.json",
    templateName: ".claude/settings.json",
    description: "Claude Desktop MCP wiring.",
  },
  {
    destinationPath: ".codex/settings.json",
    templateName: ".codex/settings.json",
    description: "Codex MCP wiring.",
  },
] as const;

function defineDescriptor(descriptor: TemplateDescriptor): TemplateDescriptor {
  return descriptor;
}

export const TEMPLATE_DESCRIPTORS = [
  defineDescriptor({
    name: "base",
    description: "Generic fallback template for unknown environments.",
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc",
    detectionMarkers: [],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "basic",
      localTargets: {
        build: true,
        test: false,
        check: false,
        verify: false,
        certify: false,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
  defineDescriptor({
    name: "rust",
    description: "Rust workspaces using Cargo.",
    docsPath: "docs/modules/ROOT/pages/repository/docs/template_rust.adoc",
    detectionMarkers: ["Cargo.toml"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "enhanced",
      localTargets: {
        build: true,
        test: true,
        check: true,
        verify: true,
        certify: true,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
  defineDescriptor({
    name: "go",
    description: "Go workspaces using go.mod.",
    docsPath: "docs/modules/ROOT/pages/repository/docs/template_go.adoc",
    detectionMarkers: ["go.mod"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "enhanced",
      localTargets: {
        build: true,
        test: true,
        check: true,
        verify: true,
        certify: true,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
  defineDescriptor({
    name: "typescript",
    description: "TypeScript/Node.js workspaces using package.json.",
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/template_typescript.adoc",
    detectionMarkers: ["package.json"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [
      {
        destinationPath: "cx-mcp-build.toml",
        templateName: "cx-mcp-build.toml",
        description: "Build-artifact MCP overlay for emitted output.",
      },
    ],
    capabilities: {
      level: "advanced",
      localTargets: {
        build: true,
        test: true,
        check: true,
        verify: true,
        certify: true,
      },
      authoringOverlay: true,
      separateMcpOverlays: true,
    },
  }),
  defineDescriptor({
    name: "python",
    description: "Python workspaces using pyproject.toml or requirements.txt.",
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc",
    detectionMarkers: ["pyproject.toml", "requirements.txt"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "basic",
      localTargets: {
        build: true,
        test: true,
        check: false,
        verify: false,
        certify: false,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
  defineDescriptor({
    name: "java",
    description: "Java workspaces using Maven or Gradle.",
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc",
    detectionMarkers: ["pom.xml", "build.gradle", "build.gradle.kts"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "basic",
      localTargets: {
        build: true,
        test: true,
        check: false,
        verify: false,
        certify: false,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
  defineDescriptor({
    name: "elixir",
    description: "Elixir workspaces using mix.exs.",
    docsPath: "docs/modules/ROOT/pages/repository/docs/template_elixir.adoc",
    detectionMarkers: ["mix.exs"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "enhanced",
      localTargets: {
        build: true,
        test: true,
        check: true,
        verify: true,
        certify: true,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
  defineDescriptor({
    name: "julia",
    description: "Julia workspaces using Project.toml.",
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc",
    detectionMarkers: ["Project.toml"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "basic",
      localTargets: {
        build: true,
        test: true,
        check: false,
        verify: false,
        certify: false,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
  defineDescriptor({
    name: "crystal",
    description: "Crystal workspaces using shard.yml or shard.lock.",
    docsPath: "docs/modules/ROOT/pages/repository/docs/template_crystal.adoc",
    detectionMarkers: ["shard.yml", "shard.lock"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "enhanced",
      localTargets: {
        build: true,
        test: true,
        check: false,
        verify: true,
        certify: true,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
  defineDescriptor({
    name: "zig",
    description: "Zig workspaces using build.zig or build.zig.zon.",
    docsPath: "docs/modules/ROOT/pages/repository/docs/template_zig.adoc",
    detectionMarkers: ["build.zig", "build.zig.zon"],
    requiredGeneratedFiles: COMMON_REQUIRED_FILES,
    optionalGeneratedFiles: [],
    capabilities: {
      level: "enhanced",
      localTargets: {
        build: true,
        test: true,
        check: false,
        verify: true,
        certify: true,
      },
      authoringOverlay: true,
      separateMcpOverlays: false,
    },
  }),
] as const satisfies readonly TemplateDescriptor[];

const TEMPLATE_DESCRIPTOR_MAP = new Map<EnvironmentKind, TemplateDescriptor>(
  TEMPLATE_DESCRIPTORS.map((descriptor) => [descriptor.name, descriptor]),
);

export function getTemplateDescriptor(
  name: EnvironmentKind,
): TemplateDescriptor {
  const descriptor = TEMPLATE_DESCRIPTOR_MAP.get(name);
  if (!descriptor) {
    throw new Error(`Missing template descriptor for ${name}.`);
  }
  return descriptor;
}

export function listTemplateDescriptors(): readonly TemplateDescriptor[] {
  return TEMPLATE_DESCRIPTORS;
}

export function getTemplateMetadataList(): ReadonlyArray<TemplateMetadata> {
  return TEMPLATE_DESCRIPTORS.map(({ name, description }) => ({
    name,
    description,
  }));
}
