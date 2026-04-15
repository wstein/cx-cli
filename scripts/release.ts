import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";

const version = process.env.VERSION ?? process.argv[2];
if (!version) {
  console.error("Usage: VERSION=x.y.z bun run scripts/release.ts");
  process.exit(1);
}

const semver = /^\d+\.\d+\.\d+(?:[-+].+)?$/;
if (!semver.test(version)) {
  console.error(`Invalid version: ${version}`);
  process.exit(1);
}

const pkgPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("git", ["add", "package.json"]);
run("git", ["commit", "-m", `chore(release): v${version}`]);
run("git", ["tag", "-a", `v${version}`, "-m", `Release v${version}`]);
run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", `v${version}`]);
