/**
 * Template engine entrypoint for cx init scaffolding.
 */

export { renderInitTemplate, renderInitTemplateFile } from "./engine.js";
export {
  detectEnvironment,
  isEnvironmentSupported,
  getSupportedTemplates,
  SUPPORTED_ENVIRONMENTS,
} from "./detect.js";
export type { EnvironmentKind, TemplateVariables, GeneratedFile } from "./types.js";
