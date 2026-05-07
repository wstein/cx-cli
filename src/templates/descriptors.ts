import type {
  EnvironmentKind,
  TemplateDescriptor,
  TemplateMetadata,
} from "./types.js";

const COMMON_REQUIRED_FILES = [
  {
    destinationPath: "README.md",
    templateName: "README.md",
    description: "Workspace overview with Antora docs entrypoints.",
  },
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
    destinationPath: ".markdownlint.json",
    templateName: ".markdownlint.json",
    description: "Markdown lint defaults for generated docs and notes.",
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
  {
    destinationPath: "antora-playbook.yml",
    templateName: "antora-playbook.yml",
    description: "Minimal Antora playbook for the generated docs site.",
  },
  {
    destinationPath: "docs/README.md",
    templateName: "docs/README.md",
    description: "Overview of the generated Antora docs scaffold.",
  },
  {
    destinationPath: "docs/antora.yml",
    templateName: "docs/antora.yml",
    description: "Antora component descriptor for the generated docs site.",
  },
  {
    destinationPath: "docs/modules/ROOT/nav.adoc",
    templateName: "docs/modules/ROOT/nav.adoc",
    description: "Top-level navigation for the generated Antora docs site.",
  },
  {
    destinationPath: "docs/modules/ROOT/pages/index.adoc",
    templateName: "docs/modules/ROOT/pages/index.adoc",
    description: "Shared docs index for the generated Antora docs site.",
  },
  {
    destinationPath: "docs/modules/onboarding/nav.adoc",
    templateName: "docs/modules/onboarding/nav.adoc",
    description: "Onboarding navigation for the generated Antora docs site.",
  },
  {
    destinationPath: "docs/modules/onboarding/pages/index.adoc",
    templateName: "docs/modules/onboarding/pages/index.adoc",
    description: "Onboarding landing page for the generated Antora docs site.",
  },
  {
    destinationPath: "docs/modules/manual/nav.adoc",
    templateName: "docs/modules/manual/nav.adoc",
    description: "Manual navigation for the generated Antora docs site.",
  },
  {
    destinationPath: "docs/modules/manual/pages/index.adoc",
    templateName: "docs/modules/manual/pages/index.adoc",
    description: "Manual landing page for the generated Antora docs site.",
  },
  {
    destinationPath: "docs/modules/architecture/nav.adoc",
    templateName: "docs/modules/architecture/nav.adoc",
    description: "arc42 architecture navigation for the generated docs site.",
  },
  {
    destinationPath: "docs/modules/architecture/pages/index.adoc",
    templateName: "docs/modules/architecture/pages/index.adoc",
    description:
      "arc42 architecture overview page for the generated docs site.",
  },
  {
    destinationPath:
      "docs/modules/architecture/pages/01-introduction-and-goals.adoc",
    templateName:
      "docs/modules/architecture/pages/01-introduction-and-goals.adoc",
    description: "arc42 introduction and goals chapter scaffold.",
  },
  {
    destinationPath: "docs/modules/architecture/pages/02-constraints.adoc",
    templateName: "docs/modules/architecture/pages/02-constraints.adoc",
    description: "arc42 constraints chapter scaffold.",
  },
  {
    destinationPath:
      "docs/modules/architecture/pages/03-context-and-scope.adoc",
    templateName: "docs/modules/architecture/pages/03-context-and-scope.adoc",
    description: "arc42 context and scope chapter scaffold.",
  },
  {
    destinationPath:
      "docs/modules/architecture/pages/04-solution-strategy.adoc",
    templateName: "docs/modules/architecture/pages/04-solution-strategy.adoc",
    description: "arc42 solution strategy chapter scaffold.",
  },
  {
    destinationPath:
      "docs/modules/architecture/pages/05-building-block-view.adoc",
    templateName: "docs/modules/architecture/pages/05-building-block-view.adoc",
    description: "arc42 building block view chapter scaffold.",
  },
  {
    destinationPath: "docs/modules/architecture/pages/06-runtime-view.adoc",
    templateName: "docs/modules/architecture/pages/06-runtime-view.adoc",
    description: "arc42 runtime view chapter scaffold.",
  },
  {
    destinationPath: "docs/modules/architecture/pages/07-deployment-view.adoc",
    templateName: "docs/modules/architecture/pages/07-deployment-view.adoc",
    description: "arc42 deployment view chapter scaffold.",
  },
  {
    destinationPath:
      "docs/modules/architecture/pages/08-cross-cutting-concepts.adoc",
    templateName:
      "docs/modules/architecture/pages/08-cross-cutting-concepts.adoc",
    description: "arc42 cross-cutting concepts chapter scaffold.",
  },
  {
    destinationPath:
      "docs/modules/architecture/pages/09-architecture-decisions.adoc",
    templateName:
      "docs/modules/architecture/pages/09-architecture-decisions.adoc",
    description: "arc42 architecture decisions chapter scaffold.",
  },
  {
    destinationPath:
      "docs/modules/architecture/pages/10-quality-requirements.adoc",
    templateName:
      "docs/modules/architecture/pages/10-quality-requirements.adoc",
    description: "arc42 quality requirements chapter scaffold.",
  },
  {
    destinationPath:
      "docs/modules/architecture/pages/11-risks-and-technical-debt.adoc",
    templateName:
      "docs/modules/architecture/pages/11-risks-and-technical-debt.adoc",
    description: "arc42 risks and technical debt chapter scaffold.",
  },
  {
    destinationPath: "docs/modules/architecture/pages/12-glossary.adoc",
    templateName: "docs/modules/architecture/pages/12-glossary.adoc",
    description: "arc42 glossary chapter scaffold.",
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
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc#rust-template",
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
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc#go-template",
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
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc#typescript-template",
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
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc#elixir-template",
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
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc#crystal-template",
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
    docsPath:
      "docs/modules/ROOT/pages/repository/docs/init_template_contract.adoc#zig-template",
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
