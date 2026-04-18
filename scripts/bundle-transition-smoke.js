import { spawnSync } from "node:child_process";

const args = ["test", "tests/bundle/update-matrix.test.ts", "--timeout", "60000"];
const transitionFlagIndex = process.argv.indexOf("--transition");

if (transitionFlagIndex !== -1) {
  const transition = process.argv[transitionFlagIndex + 1];
  if (!transition) {
    console.error("bundle-transition-smoke: missing value for --transition");
    process.exit(1);
  }
  args.push("-t", transition);
}

const result = spawnSync("bun", args, {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
