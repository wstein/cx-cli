/**
 * Environment detection for template selection.
 *
 * Detects the presence of language-specific configuration files
 * to determine which template should be used.
 */

import { pathExists } from "../shared/fs.js";
import type { EnvironmentKind, TemplateMetadata } from "./types.js";

export const SUPPORTED_ENVIRONMENTS: readonly EnvironmentKind[] = [
  "rust",
  "go",
  "typescript",
  "python",
  "java",
  "elixir",
  "julia",
  "crystal",
  "base",
] as const;

const TEMPLATE_METADATA: ReadonlyArray<TemplateMetadata> = [
  {
    name: "base",
    description: "Generic fallback template for unknown environments.",
  },
  { name: "rust", description: "Rust workspaces using Cargo." },
  { name: "go", description: "Go workspaces using go.mod." },
  {
    name: "typescript",
    description: "TypeScript/Node.js workspaces using package.json.",
  },
  {
    name: "python",
    description: "Python workspaces using pyproject.toml or requirements.txt.",
  },
  { name: "java", description: "Java workspaces using Maven or Gradle." },
  { name: "elixir", description: "Elixir workspaces using mix.exs." },
  { name: "julia", description: "Julia workspaces using Project.toml." },
  {
    name: "crystal",
    description: "Crystal workspaces using shard.yml or shard.lock.",
  },
];

export function isEnvironmentSupported(
  value: string,
): value is EnvironmentKind {
  return SUPPORTED_ENVIRONMENTS.includes(value as EnvironmentKind);
}

export function getSupportedTemplates(): ReadonlyArray<TemplateMetadata> {
  return TEMPLATE_METADATA;
}

export async function detectEnvironment(cwd: string): Promise<EnvironmentKind> {
  const checks = [
    { file: "Cargo.toml", env: "rust" as const },
    { file: "go.mod", env: "go" as const },
    { file: "package.json", env: "typescript" as const },
    { file: "pyproject.toml", env: "python" as const },
    { file: "requirements.txt", env: "python" as const },
    { file: "pom.xml", env: "java" as const },
    { file: "build.gradle", env: "java" as const },
    { file: "mix.exs", env: "elixir" as const },
    { file: "Project.toml", env: "julia" as const },
    { file: "shard.yml", env: "crystal" as const },
    { file: "shard.lock", env: "crystal" as const },
  ];

  for (const check of checks) {
    const filePath = `${cwd}/${check.file}`;
    if (await pathExists(filePath)) {
      return check.env;
    }
  }

  return "base";
}
