import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { input } from "@inquirer/prompts";

const semver = /^\d+\.\d+\.\d+(?:[-+].+)?$/;
const pkgPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const envVersion = process.env.VERSION ?? process.argv[2];
let version = envVersion;

const currentVersion = pkg.version as string;
const suggestedVersion = semver.test(currentVersion)
  ? currentVersion.replace(/(\d+)$/, (match) => String(Number(match) + 1))
  : currentVersion;

if (!version) {
  version = await input({
    message: "Release version",
    default: suggestedVersion,
  });
}

if (!version) {
  console.error("No version provided.");
  process.exit(1);
}

if (!semver.test(version)) {
  console.error(`Invalid version: ${version}`);
  process.exit(1);
}

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
