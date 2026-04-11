import kleur from "kleur";

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
export function printHeader(text: string): void {
  console.log(kleur.bold().cyan(`\n📦 ${text}\n`));
}

/**
 * Create a colored subsection header
 */
export function printSubheader(text: string): void {
  console.log(kleur.bold().white(`  ${text}`));
}

/**
 * Print a stat line with label and value
 */
export function printStat(label: string, value: string | number): void {
  console.log(`  ${kleur.gray(label)}: ${kleur.bold().white(String(value))}`);
}

/**
 * Print key-value pairs in a table format
 */
export function printTable(
  rows: Array<[label: string, value: string | number]>,
): void {
  const maxLabelLength = Math.max(...rows.map(([label]) => label.length));
  for (const [label, value] of rows) {
    const paddedLabel = label.padEnd(maxLabelLength);
    console.log(
      `  ${kleur.gray(paddedLabel)} ${kleur.bold().white(String(value))}`,
    );
  }
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(`${kleur.green("✓")} ${kleur.green(message)}`);
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.log(`${kleur.yellow("⚠")} ${kleur.yellow(message)}`);
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  console.log(`${kleur.blue("ℹ")} ${kleur.blue(message)}`);
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.log(`${kleur.red("✗")} ${kleur.red(message)}`);
}

/**
 * Create a progress indicator (simple spinner text)
 */
export function printProgress(
  step: number,
  total: number,
  label: string,
): void {
  const percentage = Math.round((step / total) * 100);
  const filled = Math.floor((step / total) * 20);
  const bar = "█".repeat(filled) + "░".repeat(20 - filled);
  console.log(`  ${kleur.cyan(bar)} ${percentage}% ${kleur.gray(label)}`);
}

/**
 * Print a divider line
 */
export function printDivider(): void {
  console.log(kleur.gray(`  ${"─".repeat(50)}`));
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
): void {
  printHeader("Bundle Created Successfully");
  printStat("Project", projectName);
  printStat("Location", bundleDir);
  printDivider();
  printStat("Sections", sectionCount);
  printStat("Assets", assetCount);
  printDivider();
  printStat("Total size", formatBytes(totalBytes));
  printStat("Total tokens", formatNumber(tokenCount));
  console.log();
}
