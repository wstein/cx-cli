import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { confirm, input, select } from "@inquirer/prompts";
import kleur from "kleur";

export const SEMVER = /^\d+\.\d+\.\d+(?:[-+].+)?$/;

export function isSemver(version) {
  return SEMVER.test(version);
}

export function suggestReleaseVersion(currentVersion) {
  return isSemver(currentVersion)
    ? currentVersion.replace(/(\d+)$/, (match) => String(Number(match) + 1))
    : currentVersion;
}

export function inferExplicitReleaseAction({
  currentVersion,
  requestedVersion,
}) {
  if (!requestedVersion) {
    return null;
  }

  return requestedVersion === currentVersion ? "finalize" : "start";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function updateReleaseVersionFiles(cwd, version) {
  const packageJsonPath = resolve(cwd, "package.json");
  const packageJson = readJson(packageJsonPath);
  packageJson.version = version;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const packageLockPath = resolve(cwd, "package-lock.json");
  if (existsSync(packageLockPath)) {
    const packageLock = readJson(packageLockPath);
    packageLock.version = version;
    if (packageLock.packages?.[""]) {
      packageLock.packages[""].version = version;
    }
    writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
  }
}

function getVersionFiles(cwd) {
  const files = ["package.json"];
  if (existsSync(resolve(cwd, "package-lock.json"))) {
    files.push("package-lock.json");
  }
  return files;
}

function git(cwd, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: options.capture === true ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const message = stderr || stdout || `git ${args.join(" ")} failed`;
    throw new Error(message);
  }

  return (result.stdout ?? "").trim();
}

function getReleaseState(cwd) {
  const packageJsonPath = resolve(cwd, "package.json");
  const pkg = readJson(packageJsonPath);
  const currentVersion = String(pkg.version ?? "");
  const tagName = `v${currentVersion}`;

  return {
    currentVersion,
    suggestedVersion: suggestReleaseVersion(currentVersion),
    branch: git(cwd, ["branch", "--show-current"], { capture: true }),
    worktreeClean:
      git(cwd, ["status", "--short"], { capture: true }).trim().length === 0,
    currentVersionTagExists:
      git(cwd, ["tag", "--list", tagName], { capture: true }) === tagName,
    headTags: git(cwd, ["tag", "--points-at", "HEAD"], { capture: true })
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function printHeader(title, log) {
  log(`\n${kleur.bold().cyan("=".repeat(50))}`);
  log(kleur.bold().cyan(`  ${title}`));
  log(`${kleur.bold().cyan("=".repeat(50))}\n`);
}

function printStep(current, total, title, log) {
  log(`${kleur.cyan(`[${current}/${total}]`)} ${kleur.bold().white(title)}`);
}

function printTip(message, log) {
  log(`${kleur.gray(`  ${message}`)}\n`);
}

function printComplete(message, log) {
  log(`\n${kleur.green(`✓ ${message}`)}\n`);
}

function assertReleasePreconditions(state) {
  if (state.branch !== "develop") {
    throw new Error(
      `Release wizard must run on develop. Current branch: ${state.branch || "(detached HEAD)"}`,
    );
  }

  if (!state.worktreeClean) {
    throw new Error(
      "Release wizard requires a clean worktree so the candidate and tag map to a single audited state.",
    );
  }
}

async function chooseReleaseAction(state, requestedVersion, log) {
  const explicitAction = inferExplicitReleaseAction({
    currentVersion: state.currentVersion,
    requestedVersion,
  });
  if (explicitAction) {
    return explicitAction;
  }

  printStep(2, 4, "Choose release phase", log);
  printTip(
    "Use the first pass to prepare the candidate on develop, then rerun this command to finalize the tag after CI is green.",
    log,
  );

  const choices = [
    {
      name: `Start release candidate from ${state.currentVersion}`,
      value: "start",
    },
  ];

  if (!state.currentVersionTagExists) {
    choices.push({
      name: `Finalize current candidate as v${state.currentVersion}`,
      value: "finalize",
    });
  }

  return select({
    message: kleur.cyan("? Release phase"),
    choices,
  });
}

async function chooseVersion(state, requestedVersion, log) {
  if (requestedVersion) {
    return requestedVersion;
  }

  printStep(3, 4, "Choose candidate version", log);
  return input({
    message: kleur.cyan("? Release version"),
    default: state.suggestedVersion,
  });
}

function assertVersionAvailable(cwd, state, version, action) {
  if (!isSemver(version)) {
    throw new Error(`Invalid version: ${version}`);
  }

  if (action === "start" && version === state.currentVersion) {
    throw new Error(
      `Version ${version} is already set in package.json. Rerun the wizard with the same version to finalize the tag, or choose a new version to start a fresh candidate.`,
    );
  }

  if (
    action === "start" &&
    git(cwd, ["tag", "--list", `v${version}`], { capture: true }) ===
      `v${version}`
  ) {
    throw new Error(
      `Tag v${version} already exists. Start a new candidate with a different version.`,
    );
  }

  if (action === "finalize" && state.currentVersionTagExists) {
    throw new Error(
      `Tag v${version} already exists. The current candidate has already been finalized.`,
    );
  }
}

async function confirmPlan({ action, version, log }) {
  printStep(4, 4, "Confirm plan", log);
  if (action === "start") {
    log(
      kleur.white(
        `Start release candidate ${kleur.bold(`v${version}`)} on ${kleur.bold("develop")}: bump version files, commit, and push the candidate commit.`,
      ),
    );
  } else {
    log(
      kleur.white(
        `Finalize release ${kleur.bold(`v${version}`)}: create the release tag on the current certified commit and push only the tag.`,
      ),
    );
  }

  return confirm({
    message: kleur.cyan("? Continue?"),
    default: true,
  });
}

function runReleaseAction({ cwd, action, version, log }) {
  const tagName = `v${version}`;
  const versionFiles = getVersionFiles(cwd);

  if (action === "start") {
    updateReleaseVersionFiles(cwd, version);
    git(cwd, ["add", ...versionFiles]);
    git(cwd, ["commit", "-m", `chore(release): start ${tagName}`]);
    git(cwd, ["push", "origin", "develop"]);
    printComplete(`Release candidate ${tagName} started`, log);
    log(
      kleur.gray(
        `Next: let CI go green on develop, then rerun ${kleur.bold(
          `make release VERSION=${version}`,
        )} to create and push the tag.`,
      ),
    );
    return;
  }

  git(cwd, ["tag", "-a", tagName, "-m", `Release ${tagName}`]);
  git(cwd, ["push", "origin", tagName]);
  printComplete(`Release tag ${tagName} pushed`, log);
  log(
    kleur.gray(
      "Next: watch the release workflow finalize the certified build inputs and fast-forward main after publish.",
    ),
  );
}

export async function runReleaseWizard(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;

  printHeader("Release Wizard", log);

  const state = getReleaseState(cwd);
  assertReleasePreconditions(state);

  printStep(1, 4, "Inspect repository state", log);
  log(
    kleur.white(
      `Current version: ${kleur.bold(state.currentVersion)} | Branch: ${kleur.bold(
        state.branch,
      )} | Worktree: ${kleur.bold("clean")}`,
    ),
  );
  printTip(
    state.currentVersionTagExists
      ? `Tag v${state.currentVersion} already exists, so the current version can only start a newer candidate.`
      : `Current version v${state.currentVersion} is untagged, so it can be finalized if CI already certified the commit.`,
    log,
  );

  const requestedVersion = env.VERSION ?? argv[0];
  const action = await chooseReleaseAction(state, requestedVersion, log);
  const version =
    action === "start"
      ? await chooseVersion(state, requestedVersion, log)
      : state.currentVersion;

  assertVersionAvailable(cwd, state, version, action);

  const proceed = await confirmPlan({ action, version, log });
  if (!proceed) {
    log(kleur.yellow("Release wizard cancelled."));
    return;
  }

  runReleaseAction({ cwd, action, version, log });
}

function isDirectExecution() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  runReleaseWizard().catch((error) => {
    console.error(kleur.red(String(error instanceof Error ? error.message : error)));
    process.exit(1);
  });
}
