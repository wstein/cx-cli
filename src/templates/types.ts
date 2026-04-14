/**
 * Template system types for cx init scaffolding.
 *
 * Templates are file-based Handlebars sources stored under
 * src/templates/init-templates/{environment}/.
 */

export type EnvironmentKind =
  | "rust"
  | "go"
  | "typescript"
  | "python"
  | "java"
  | "elixir"
  | "julia"
  | "crystal"
  | "base";

export interface TemplateVariables {
  projectName: string;
  style: "xml" | "markdown" | "json" | "plain";
}

export interface TemplateMetadata {
  name: EnvironmentKind;
  description: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  created: boolean;
  updated: boolean;
}
