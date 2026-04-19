import { execa } from "execa";
import { monitorFastLaneDuration } from "./monitor-fast-lane-time.js";

const startedAt = Date.now();

try {
  await execa("bun", ["run", "ci:test:fast"], {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  process.exit(
    error instanceof Error && "exitCode" in error
      ? Number(error.exitCode) || 1
      : 1,
  );
}

const durationMs = Date.now() - startedAt;
const result = await monitorFastLaneDuration({ durationMs });
process.exit(result.shouldFail ? 1 : 0);
