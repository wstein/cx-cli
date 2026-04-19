import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

export function createNotesGovernanceInvocation(cwd = process.cwd()) {
  return {
    command: "bun",
    args: ["run", "src/cli/main.ts", "notes", "check"],
    cwd,
  };
}

export async function runNotesGovernance(cwd = process.cwd(), options = {}) {
  const execaImpl = options.execaImpl ?? execa;
  const baseEnv = options.baseEnv ?? process.env;
  const log = options.log ?? console.log;
  const invocation = options.invocation ?? createNotesGovernanceInvocation(cwd);

  await execaImpl(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    stdio: "inherit",
    env: baseEnv,
  });

  log("✓ Notes governance check completed");
}

export async function runNotesGovernanceEntry(options = {}) {
  const runCheck = options.runCheck ?? runNotesGovernance;
  const logError = options.logError ?? console.error;
  const exit = options.exit ?? process.exit;

  try {
    await runCheck();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`✗ Notes governance check failed: ${message}`);
    exit(1);
  }
}

const executedAsScript =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executedAsScript) {
  runNotesGovernanceEntry();
}
