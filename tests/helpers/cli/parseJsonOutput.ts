export function parseJsonOutput<T>(stdout: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON CLI output: ${message}`);
  }
}
