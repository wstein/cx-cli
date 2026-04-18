/**
 * Template system types for cx init scaffolding.
 *
 * Templates are file-based Handlebars sources stored under
 * src/templates/init/{environment}/.
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
  | "zig"
  | "base";

export interface TemplateVariables {
  projectName: string;
  style: "xml" | "markdown" | "json" | "plain";
}

export interface TemplateMetadata {
  name: EnvironmentKind;
  description: string;
}

export type TemplateCapabilityLevel = "basic" | "enhanced" | "advanced";

export type TemplateLocalTarget =
  | "build"
  | "test"
  | "check"
  | "verify"
  | "certify";

export interface TemplateFileDescriptor {
  destinationPath: string;
  templateName: string;
  description: string;
}

export interface TemplateCapabilities {
  level: TemplateCapabilityLevel;
  localTargets: Record<TemplateLocalTarget, boolean>;
  authoringOverlay: boolean;
  separateMcpOverlays: boolean;
}

export interface TemplateDescriptor extends TemplateMetadata {
  docsPath: string;
  detectionMarkers: readonly string[];
  requiredGeneratedFiles: readonly TemplateFileDescriptor[];
  optionalGeneratedFiles: readonly TemplateFileDescriptor[];
  capabilities: TemplateCapabilities;
}

export interface GeneratedFile {
  path: string;
  content: string;
  created: boolean;
  updated: boolean;
}
