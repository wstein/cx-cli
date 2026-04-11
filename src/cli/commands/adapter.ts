import path from "node:path";

import { loadCxConfig } from "../../config/load.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import {
  detectRepomixCapabilities,
  getAdapterRuntimeInfo,
} from "../../repomix/capabilities.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
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
  const capabilities = await getRepomixCapabilities();
  const runtimeInfo = await getAdapterRuntimeInfo();
  const detectedCapabilities = detectRepomixCapabilities();

  const payload = {
    cx: {
      version: "0.1.0",
    },
    repomix: {
      packageName: runtimeInfo.packageName,
      packageVersion: runtimeInfo.packageVersion,
      adapterContract: capabilities.adapterContract,
      compatibilityStrategy: capabilities.compatibilityStrategy,
      contractValid: capabilities.contractValid,
    },
    detectedCapabilities: detectedCapabilities,
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
      `Repomix package:           ${payload.repomix.packageName}\n`,
    );
    process.stdout.write(
      `Repomix version:           ${payload.repomix.packageVersion}\n`,
    );
    process.stdout.write(
      `adapter contract:          ${payload.repomix.adapterContract}\n`,
    );
    process.stdout.write(
      `compatibility strategy:    ${payload.repomix.compatibilityStrategy}\n`,
    );
    process.stdout.write(
      `contract valid:            ${payload.repomix.contractValid ? "YES" : "NO"}\n`,
    );
    process.stdout.write(`\nDetected capabilities:\n`);
    process.stdout.write(
      `  mergeConfigs:            ${detectedCapabilities.hasMergeConfigs ? "YES" : "NO"}\n`,
    );
    process.stdout.write(
      `  pack:                    ${detectedCapabilities.hasPack ? "YES" : "NO"}\n`,
    );
    process.stdout.write(
      `  packStructured:          ${detectedCapabilities.hasPackStructured ? "YES" : "NO"}\n`,
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

  // Check 1: Repomix package is available with required exports
  try {
    const capabilities = detectRepomixCapabilities();
    const hasRequired =
      capabilities.hasMergeConfigs &&
      capabilities.hasPack &&
      capabilities.hasPackStructured;
    checks.push({
      name: "@wstein/repomix available",
      passed: hasRequired,
      message: hasRequired
        ? "All required exports are available"
        : "Missing required exports",
    });
  } catch (error) {
    checks.push({
      name: "@wstein/repomix available",
      passed: false,
      message: `Package not available: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check 2: Runtime info
  try {
    const runtimeInfo = await getAdapterRuntimeInfo();
    checks.push({
      name: "Package identification",
      passed: Boolean(runtimeInfo.packageName && runtimeInfo.packageVersion),
      message: `${runtimeInfo.packageName}@${runtimeInfo.packageVersion}`,
    });
  } catch (error) {
    checks.push({
      name: "Package identification",
      passed: false,
      message: `Could not read package info: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check 3: Capabilities detection
  const capabilities = await getRepomixCapabilities();
  checks.push({
    name: "Adapter contract",
    passed: capabilities.adapterContract === "repomix-pack-v1",
    message: `Contract: ${capabilities.adapterContract}`,
  });

  // Check 4: Contract validation
  checks.push({
    name: "Contract validation",
    passed: capabilities.contractValid,
    message: capabilities.contractValid
      ? "Contract is valid"
      : "Contract validation failed",
  });

  // Check 5: Output styles
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
