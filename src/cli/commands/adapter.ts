import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import {
  getRepomixCapabilities,
  SUPPORTED_REPOMIX_VERSION,
} from "../../repomix/render.js";
import { CxError } from "../../shared/errors.js";
import { writeJson } from "../../shared/output.js";

export interface AdapterArgs {
  config?: string | undefined;
  subcommand: "capabilities" | "inspect" | "doctor";
  sections?: string[] | undefined;
  json?: boolean | undefined;
}

export async function runAdapterCommand(args: AdapterArgs): Promise<number> {
  switch (args.subcommand) {
    case "capabilities":
      return runAdapterCapabilities(args);
    case "inspect":
      return runAdapterInspect(args);
    case "doctor":
      return runAdapterDoctor(args);
    default:
      throw new CxError(`Unknown adapter subcommand: ${args.subcommand}`, 2);
  }
}

async function runAdapterCapabilities(args: AdapterArgs): Promise<number> {
  const capabilities = getRepomixCapabilities();

  const payload = {
    cx: {
      version: "0.1.0",
    },
    repomix: {
      version: SUPPORTED_REPOMIX_VERSION,
      adapterContract: capabilities.adapterContract,
      compatibilityStrategy: capabilities.compatibilityStrategy,
    },
    capabilities: {
      styles: ["xml", "markdown", "json", "plain"],
      exactSpanCapture: capabilities.exactSpanCaptureSupported,
      exactSpanCaptureReason: capabilities.exactSpanCaptureReason,
      exactFileSelection: true,
      sectionPlanning: true,
    },
  };

  if (args.json ?? false) {
    writeJson(payload);
  } else {
    process.stdout.write(`cx version:                ${payload.cx.version}\n`);
    process.stdout.write(
      `Repomix version (support): ${payload.repomix.version}\n`,
    );
    process.stdout.write(
      `adapter contract:          ${payload.repomix.adapterContract}\n`,
    );
    process.stdout.write(
      `compatibility strategy:    ${payload.repomix.compatibilityStrategy}\n`,
    );
    process.stdout.write(`\nCapabilities:\n`);
    process.stdout.write(
      `  output styles:           ${payload.capabilities.styles.join(", ")}\n`,
    );
    process.stdout.write(
      `  exact span capture:      ${payload.capabilities.exactSpanCapture ? "supported" : "not supported"}\n`,
    );
    if (!payload.capabilities.exactSpanCapture) {
      process.stdout.write(
        `  reason:                  ${payload.capabilities.exactSpanCaptureReason}\n`,
      );
    }
    process.stdout.write(
      `  exact file selection:    ${payload.capabilities.exactFileSelection ? "supported" : "not supported"}\n`,
    );
    process.stdout.write(
      `  section planning:        ${payload.capabilities.sectionPlanning ? "enabled" : "disabled"}\n`,
    );
  }

  return 0;
}

async function runAdapterInspect(args: AdapterArgs): Promise<number> {
  const configPath = path.resolve(args.config ?? "cx.toml");
  const config = await loadCxConfig(configPath);
  const plan = await buildBundlePlan(config);

  const requestedSections = args.sections ?? [];
  if (requestedSections.length === 0) {
    throw new CxError(
      "Adapter inspect requires --section to specify which section to inspect.",
      2,
    );
  }

  const selectedSections = requestedSections.map((name) => {
    const section = plan.sections.find((s) => s.name === name);
    if (!section) {
      throw new CxError(`Section '${name}' not found in plan.`, 2);
    }
    return section;
  });

  const payload = {
    projectName: config.projectName,
    sourceRoot: config.sourceRoot,
    sections: selectedSections.map((section) => ({
      name: section.name,
      style: config.repomix.style,
      fileCount: section.files.length,
      files: section.files.map((f) => f.relativePath),
    })),
    repomixOptions: {
      compress: config.repomix.compress,
      removeComments: config.repomix.removeComments,
      removeEmptyLines: config.repomix.removeEmptyLines,
      showLineNumbers: config.repomix.showLineNumbers,
      includeEmptyDirectories: config.repomix.includeEmptyDirectories,
      securityCheck: config.repomix.securityCheck,
    },
  };

  if (args.json ?? false) {
    writeJson(payload);
  } else {
    for (const section of payload.sections) {
      process.stdout.write(`\nSection: ${section.name}\n`);
      process.stdout.write(`  style:  ${section.style}\n`);
      process.stdout.write(`  files:  ${section.fileCount}\n`);
      process.stdout.write(`  list:\n`);
      for (const file of section.files) {
        process.stdout.write(`    - ${file}\n`);
      }
    }
    process.stdout.write(`\nRepomix options:\n`);
    for (const [key, value] of Object.entries(payload.repomixOptions)) {
      process.stdout.write(`  ${key}: ${value}\n`);
    }
  }

  return 0;
}

async function runAdapterDoctor(_args: AdapterArgs): Promise<number> {
  const checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }> = [];

  // Check 1: Repomix is available
  try {
    const { mergeConfigs, pack } = await import("repomix");
    checks.push({
      name: "Repomix available",
      passed: typeof mergeConfigs === "function" && typeof pack === "function",
      message:
        typeof mergeConfigs === "function" && typeof pack === "function"
          ? "Repomix package exports are available"
          : "Repomix exports are unavailable",
    });
  } catch (error) {
    checks.push({
      name: "Repomix available",
      passed: false,
      message: `Repomix not available: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check 2: Capabilities
  const capabilities = getRepomixCapabilities();
  checks.push({
    name: "Adapter contract",
    passed: capabilities.adapterContract === "repomix-pack-v1",
    message: `Contract: ${capabilities.adapterContract}`,
  });

  // Check 3: Supported version
  checks.push({
    name: "Supported version",
    passed: true,
    message: `Repomix ${SUPPORTED_REPOMIX_VERSION} is supported`,
  });

  // Check 4: Output styles
  const styles = ["xml", "markdown", "json", "plain"];
  checks.push({
    name: "Output styles",
    passed: styles.length > 0,
    message: `${styles.length} styles available: ${styles.join(", ")}`,
  });

  const payload = {
    passed: checks.every((c) => c.passed),
    checks,
  };

  if (_args.json ?? false) {
    writeJson(payload);
  } else {
    for (const check of checks) {
      const mark = check.passed ? "✓" : "✗";
      process.stdout.write(`${mark} ${check.name}: ${check.message}\n`);
    }
    process.stdout.write(
      `\nResult: ${payload.passed ? "All checks passed" : "Some checks failed"}\n`,
    );
  }

  return payload.passed ? 0 : 11;
}
