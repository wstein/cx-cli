import kleur from "kleur";
import type { CommandIo } from "./output.js";

function getLogger(io: Partial<CommandIo> = {}): (...args: unknown[]) => void {
  return io.log ?? console.log;
}

/**
 * Format bytes into human-readable size strings
 * @param bytes - Number of bytes
 * @returns Formatted string like "1.5 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Create a colored section header
 */
export function printHeader(text: string, io: Partial<CommandIo> = {}): void {
  const formatted = kleur.bold().cyan(`📦 ${text}`);
  getLogger(io)(`\n${formatted}\n`);
}

/**
 * Create a colored subsection header
 */
export function printSubheader(
  text: string,
  io: Partial<CommandIo> = {},
): void {
  getLogger(io)(kleur.bold().white(`  ${text}`));
}

/**
 * Print a stat line with label and value
 */
export function printStat(
  label: string,
  value: string | number,
  io: Partial<CommandIo> = {},
): void {
  getLogger(io)(`  ${kleur.gray(label)}: ${kleur.bold().white(String(value))}`);
}

/**
 * Print key-value pairs in a table format
 */
export function printTable(
  rows: Array<[label: string, value: string | number]>,
  io: Partial<CommandIo> = {},
): void {
  const maxLabelLength = Math.max(...rows.map(([label]) => label.length));
  const log = getLogger(io);
  for (const [label, value] of rows) {
    const paddedLabel = label.padEnd(maxLabelLength);
    log(`  ${kleur.gray(paddedLabel)} ${kleur.bold().white(String(value))}`);
  }
}

/**
 * Print a success message
 */
export function printSuccess(
  message: string,
  io: Partial<CommandIo> = {},
): void {
  getLogger(io)(`${kleur.green("✓")} ${kleur.green(message)}`);
}

/**
 * Print a warning message
 */
export function printWarning(
  message: string,
  io: Partial<CommandIo> = {},
): void {
  getLogger(io)(`${kleur.yellow("⚠")} ${kleur.yellow(message)}`);
}

/**
 * Print an info message
 */
export function printInfo(message: string, io: Partial<CommandIo> = {}): void {
  getLogger(io)(`${kleur.blue("ℹ")} ${kleur.blue(message)}`);
}

/**
 * Print an error message
 */
export function printError(message: string, io: Partial<CommandIo> = {}): void {
  getLogger(io)(`${kleur.red("✗")} ${kleur.red(message)}`);
}

/**
 * Create a progress indicator (simple spinner text)
 */
export function printProgress(
  step: number,
  total: number,
  label: string,
  io: Partial<CommandIo> = {},
): void {
  const percentage = Math.round((step / total) * 100);
  const filled = Math.floor((step / total) * 20);
  const bar = "█".repeat(filled) + "░".repeat(20 - filled);
  getLogger(io)(`  ${kleur.cyan(bar)} ${percentage}% ${kleur.gray(label)}`);
}

/**
 * Print a divider line
 */
export function printDivider(io: Partial<CommandIo> = {}): void {
  getLogger(io)(kleur.gray(`  ${"─".repeat(50)}`));
}

/**
 * Format section statistics for display
 */
export function formatSectionStats(
  name: string,
  fileCount: number,
  totalBytes: number,
  tokenCount: number,
): string[] {
  return [
    kleur.bold().cyan(`📄 ${name}`),
    `  Files: ${kleur.bold().white(String(fileCount))}`,
    `  Size: ${kleur.bold().white(formatBytes(totalBytes))}`,
    `  Tokens: ${kleur.bold().white(formatNumber(tokenCount))}`,
  ];
}

/**
 * Print bundle completion summary
 */
export function printBundleSummary(
  projectName: string,
  bundleDir: string,
  sectionCount: number,
  assetCount: number,
  totalBytes: number,
  tokenCount: number,
  io: Partial<CommandIo> = {},
): void {
  printHeader("Bundle Created Successfully", io);
  printStat("Project", projectName, io);
  printStat("Location", bundleDir, io);
  printDivider(io);
  printStat("Sections", sectionCount, io);
  printStat("Assets", assetCount, io);
  printDivider(io);
  printStat("Total size", formatBytes(totalBytes), io);
  printStat("Total tokens", formatNumber(tokenCount), io);
  getLogger(io)();
}
