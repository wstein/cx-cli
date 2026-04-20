import { execa } from "execa";

const result = await execa(
  "bunx",
  ["vitest", "run", "tests/render/nativeParity.test.ts"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.exitCode ?? 0);
