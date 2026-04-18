/**
 * Environment detection for template selection.
 *
 * Detects the presence of language-specific configuration files
 * to determine which template should be used.
 */

import { pathExists } from "../shared/fs.js";
import {
  getTemplateDescriptor,
  getTemplateMetadataList,
  listTemplateDescriptors,
} from "./descriptors.js";
import type {
  EnvironmentKind,
  TemplateDescriptor,
  TemplateMetadata,
} from "./types.js";

export const SUPPORTED_ENVIRONMENTS = listTemplateDescriptors().map(
  (descriptor) => descriptor.name,
) as readonly EnvironmentKind[];

export function isEnvironmentSupported(
  value: string,
): value is EnvironmentKind {
  return SUPPORTED_ENVIRONMENTS.includes(value as EnvironmentKind);
}

export function getSupportedTemplates(): ReadonlyArray<TemplateMetadata> {
  return getTemplateMetadataList();
}

export function getSupportedTemplateDescriptors(): readonly TemplateDescriptor[] {
  return listTemplateDescriptors();
}

export async function detectEnvironment(cwd: string): Promise<EnvironmentKind> {
  for (const descriptor of listTemplateDescriptors()) {
    if (descriptor.name === "base") {
      continue;
    }

    for (const marker of descriptor.detectionMarkers) {
      const filePath = `${cwd}/${marker}`;
      if (await pathExists(filePath)) {
        return descriptor.name;
      }
    }
  }

  return "base";
}

export function getTemplateDescriptorByName(
  environment: EnvironmentKind,
): TemplateDescriptor {
  return getTemplateDescriptor(environment);
}
