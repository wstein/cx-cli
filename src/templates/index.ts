/**
 * Template engine entrypoint for cx init scaffolding.
 */

export {
  detectEnvironment,
  getSupportedTemplateDescriptors,
  getSupportedTemplates,
  getTemplateDescriptorByName,
  isEnvironmentSupported,
  SUPPORTED_ENVIRONMENTS,
} from "./detect.js";
export { renderInitTemplate, renderInitTemplateFile } from "./engine.js";
export type {
  EnvironmentKind,
  GeneratedFile,
  TemplateCapabilities,
  TemplateCapabilityLevel,
  TemplateDescriptor,
  TemplateFileDescriptor,
  TemplateLocalTarget,
  TemplateVariables,
} from "./types.js";
