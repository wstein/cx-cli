import path from "node:path";
import { loadCxConfig } from "../../config/load.js";
import { buildBundlePlan } from "../../planning/buildPlan.js";
import {
  detectRepomixCapabilities,
  getAdapterModulePath,
  getAdapterRuntimeInfo,
} from "../../repomix/capabilities.js";
import { getRepomixCapabilities } from "../../repomix/render.js";
import { CxError } from "../../shared/errors.js";
import {
  type CommandIo,
  resolveCommandIo,
  writeStdout,
  writeValidatedJson,
} from "../../shared/output.js";
import {
  AdapterCapabilitiesJsonSchema,
  AdapterDoctorJsonSchema,
  AdapterInspectJsonSchema,
} from "../jsonContracts.js";

export interface AdapterArgs {
  config?: string | undefined;
  subcommand: "capabilities" | "inspect" | "doctor";
  sections?: string[] | undefined;
  json?: boolean | undefined;
}

export async function runAdapterCommand(
  args: AdapterArgs,
  ioArg: Partial<CommandIo> = {},
): Promise<number> {
  switch (args.subcommand) {
    case "capabilities":
      return runAdapterCapabilities(args, ioArg);
    case "inspect":
      return runAdapterInspect(args, ioArg);
    case "doctor":
      return runAdapterDoctor(args, ioArg);
    default:
      throw new CxError(`Unknown adapter subcommand: ${args.subcommand}`, 2);
  }
}

async function runAdapterCapabilities(
  args: AdapterArgs,
  ioArg: Partial<CommandIo>,
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const capabilities = await getRepomixCapabilities();
  const runtimeInfo = await getAdapterRuntimeInfo();
  const detectedCapabilities = await detectRepomixCapabilities();

  // Determine span capability state
  let spanCapabilityState: "supported" | "unsupported" | "partial" =
    "unsupported";
  let spanCapabilityReason =
    "Structured span capture is unavailable in the installed adapter.";

  if (detectedCapabilities.supportsRenderWithMap) {
    spanCapabilityState = "supported";
    spanCapabilityReason = "renderWithMap available and used";
  } else if (detectedCapabilities.supportsPackStructured) {
    spanCapabilityState = "partial";
    spanCapabilityReason =
      "packStructured is available, but renderWithMap is unavailable.";
  }

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
      spanCapability: spanCapabilityState,
      spanCapabilityReason: spanCapabilityReason,
      exactFileSelection: true,
      sectionPlanning: true,
    },
  };

  if (args.json ?? false) {
    writeValidatedJson(AdapterCapabilitiesJsonSchema, payload, io);
  } else {
    writeStdout(`cx version:                ${payload.cx.version}\n`, io);
    writeStdout(
      `Repomix package:           ${payload.repomix.packageName}\n`,
      io,
    );
    writeStdout(
      `Repomix version:           ${payload.repomix.packageVersion}\n`,
      io,
    );
    writeStdout(
      `adapter contract:          ${payload.repomix.adapterContract}\n`,
      io,
    );
    writeStdout(
      `compatibility strategy:    ${payload.repomix.compatibilityStrategy}\n`,
      io,
    );
    writeStdout(
      `contract valid:            ${payload.repomix.contractValid ? "YES" : "NO"}\n`,
      io,
    );
    writeStdout(`\nDetected capabilities:\n`, io);
    writeStdout(
      `  mergeConfigs:            ${detectedCapabilities.hasMergeConfigs ? "YES" : "NO"}\n`,
      io,
    );
    writeStdout(
      `  pack:                    ${detectedCapabilities.hasPack ? "YES" : "NO"}\n`,
      io,
    );
    writeStdout(
      `  packStructured:          ${detectedCapabilities.supportsPackStructured ? "YES" : "NO"}\n`,
      io,
    );
    writeStdout(`\nCapabilities:\n`, io);
    writeStdout(
      `  output styles:           ${payload.capabilities.styles.join(", ")}\n`,
      io,
    );
    writeStdout(
      `  span capture:            ${payload.capabilities.spanCapability}\n`,
      io,
    );
    if (payload.capabilities.spanCapabilityReason) {
      writeStdout(
        `  reason:                  ${payload.capabilities.spanCapabilityReason}\n`,
        io,
      );
      if (payload.capabilities.spanCapability !== "supported") {
        writeStdout(
          "  note:                    Render-only output may omit span metadata; text bundles require exact spans.\n",
          io,
        );
      }
    }
    writeStdout(
      `  exact file selection:    ${payload.capabilities.exactFileSelection ? "supported" : "not supported"}\n`,
      io,
    );
    writeStdout(
      `  section planning:        ${payload.capabilities.sectionPlanning ? "enabled" : "disabled"}\n`,
      io,
    );
  }

  return 0;
}

async function runAdapterInspect(
  args: AdapterArgs,
  ioArg: Partial<CommandIo>,
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const configPath = path.resolve(io.cwd, args.config ?? "cx.toml");
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
      showLineNumbers: config.repomix.showLineNumbers,
      includeEmptyDirectories: config.repomix.includeEmptyDirectories,
      securityCheck: config.repomix.securityCheck,
      tokenEncoding: config.tokens.encoding,
    },
  };

  if (args.json ?? false) {
    writeValidatedJson(AdapterInspectJsonSchema, payload, io);
  } else {
    for (const section of payload.sections) {
      writeStdout(`\nSection: ${section.name}\n`, io);
      writeStdout(`  style:  ${section.style}\n`, io);
      writeStdout(`  files:  ${section.fileCount}\n`, io);
      writeStdout(`  list:\n`, io);
      for (const file of section.files) {
        writeStdout(`    - ${file}\n`, io);
      }
    }
    writeStdout(`\nRepomix options:\n`, io);
    for (const [key, value] of Object.entries(payload.repomixOptions)) {
      writeStdout(`  ${key}: ${value}\n`, io);
    }
  }

  return 0;
}

async function runAdapterDoctor(
  _args: AdapterArgs,
  ioArg: Partial<CommandIo>,
): Promise<number> {
  const io = resolveCommandIo(ioArg);
  const checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }> = [];

  // Check 1: Repomix package is available with required exports
  const adapterPath = getAdapterModulePath();
  try {
    const adapterCapabilities = await detectRepomixCapabilities();
    const hasRequired = adapterCapabilities.hasMergeConfigs;
    checks.push({
      name: `${adapterPath} available`,
      passed: hasRequired,
      message: hasRequired
        ? "Core adapter contract is available"
        : "mergeConfigs() is missing",
    });
  } catch (error) {
    checks.push({
      name: `${adapterPath} available`,
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

  // Check 5: Core rendering
  checks.push({
    name: "Core rendering",
    passed:
      capabilities.capabilities.hasPack ||
      capabilities.capabilities.supportsPackStructured,
    message:
      capabilities.capabilities.hasPack ||
      capabilities.capabilities.supportsPackStructured
        ? "At least one rendering path is available"
        : "Neither pack() nor packStructured() is available",
  });

  // Check 6: Output styles
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
    writeValidatedJson(AdapterDoctorJsonSchema, payload, io);
  } else {
    for (const check of checks) {
      const mark = check.passed ? "✓" : "✗";
      writeStdout(`${mark} ${check.name}: ${check.message}\n`, io);
    }
    writeStdout(
      `\nResult: ${payload.passed ? "All checks passed" : "Some checks failed"}\n`,
      io,
    );
  }

  return payload.passed ? 0 : 11;
}
