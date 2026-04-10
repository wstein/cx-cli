/**
 * Helpers for emitting machine-readable JSON output.
 */

/**
 * Print an object as pretty JSON and exit the process cleanly.
 */
export function outputJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}
