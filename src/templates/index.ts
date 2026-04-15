/**
 * Template engine entrypoint for cx init scaffolding.
 */

export {
  detectEnvironment,
  getSupportedTemplates,
  isEnvironmentSupported,
  SUPPORTED_ENVIRONMENTS,
} from "./detect.js";
export { renderInitTemplate, renderInitTemplateFile } from "./engine.js";
export type {
  EnvironmentKind,
  GeneratedFile,
  TemplateVariables,
} from "./types.js";
