import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_INPUT_DIR = path.join(
  ROOT,
  "tests",
  "fixtures",
  "repomix-adapter-parity",
  "input",
);
const BASELINE_PATH = path.join(
  ROOT,
  "tests",
  "fixtures",
  "repomix-adapter-parity",
  "repomix-1.13.1-baseline.json",
);
const GENERATED_BINARY_FILE = path.join("edge", "nul-and-crlf.txt");
const GENERATED_BINARY_BYTES = Buffer.from(
  "prefix\0middle\r\nsuffix with spaces   \n",
  "utf8",
);
// Keep split so repository scanners do not flag this intentional fixture.
const SECURITY_FIXTURE_SECRET = [
  "abcdefghijklmnopqrst",
  "uvwxyz1234567890ABCD",
].join("");
const MODULE_PATH = process.env.REPOMIX_ADAPTER_MODULE_PATH ?? "repomix";
const MODE = process.argv.includes("--write-baseline")
  ? "write-baseline"
  : "compare";

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeSecurityMessage(message) {
  return message.replace(SECURITY_FIXTURE_SECRET, "<redacted-fixture-secret>");
}

async function importAdapter(modulePath) {
  if (
    modulePath.startsWith("file:") ||
    path.isAbsolute(modulePath) ||
    modulePath.startsWith(".")
  ) {
    const absolutePath = modulePath.startsWith("file:")
      ? fileURLToPath(modulePath)
      : path.resolve(ROOT, modulePath);
    return import(pathToFileURL(absolutePath).href);
  }

  return import(modulePath);
}

async function findPackageJson(startPath) {
  let current = path.dirname(startPath);
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, "package.json");
    try {
      return JSON.parse(await fs.readFile(candidate, "utf8"));
    } catch {
      current = path.dirname(current);
    }
  }
  return undefined;
}

async function getPackageInfo(modulePath) {
  const require = createRequire(import.meta.url);

  if (
    modulePath.startsWith("file:") ||
    path.isAbsolute(modulePath) ||
    modulePath.startsWith(".")
  ) {
    const absolutePath = modulePath.startsWith("file:")
      ? fileURLToPath(modulePath)
      : path.resolve(ROOT, modulePath);
    const pkg = await findPackageJson(absolutePath);
    return {
      name: pkg?.name ?? modulePath,
      version: pkg?.version ?? "unknown",
    };
  }

  try {
    const pkg = JSON.parse(
      await fs.readFile(require.resolve(`${modulePath}/package.json`), "utf8"),
    );
    return {
      name: pkg.name ?? modulePath,
      version: pkg.version ?? "unknown",
    };
  } catch {
    const pkg = await findPackageJson(require.resolve(modulePath));
    return {
      name: pkg?.name ?? modulePath,
      version: pkg?.version ?? "unknown",
    };
  }
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files.sort();
}

async function copyFixtureToWorkspace(workspaceDir) {
  await fs.cp(FIXTURE_INPUT_DIR, workspaceDir, { recursive: true });
  const generatedPath = path.join(workspaceDir, GENERATED_BINARY_FILE);
  await fs.mkdir(path.dirname(generatedPath), { recursive: true });
  await fs.writeFile(generatedPath, GENERATED_BINARY_BYTES);
}

function buildCliConfig(outputPath) {
  return {
    output: {
      filePath: outputPath,
      style: "xml",
      parsableStyle: true,
      headerText: "repomix adapter parity fixture",
      fileSummary: true,
      directoryStructure: true,
      files: true,
      removeComments: false,
      removeEmptyLines: false,
      compress: false,
      showLineNumbers: false,
      copyToClipboard: false,
      includeEmptyDirectories: false,
      includeFullDirectoryStructure: false,
      git: {
        includeDiffs: false,
        includeLogs: false,
        includeLogsCount: 50,
        sortByChanges: false,
        sortByChangesMaxCommits: 100,
      },
      topFilesLength: 5,
      truncateBase64: true,
      tokenCountTree: false,
    },
    include: [],
    ignore: {
      useGitignore: false,
      useDotIgnore: false,
      useDefaultPatterns: false,
      customPatterns: [],
    },
    security: {
      enableSecurityCheck: false,
    },
    tokenCount: {
      encoding: "o200k_base",
    },
  };
}

async function summarizeSecurity(adapter) {
  const results = await adapter.runSecurityCheck([
    {
      path: "src/secrets.env",
      content: `AWS_SECRET_ACCESS_KEY=${SECURITY_FIXTURE_SECRET}\n`,
    },
    {
      path: "src/ordinary.ts",
      content: "export const ordinary = true;\n",
    },
  ]);

  return results.map((result) => ({
    filePath: result.filePath,
    messages: [...result.messages].map(normalizeSecurityMessage).sort(),
    type: result.type,
  }));
}

async function captureParitySnapshot(adapter, packageInfo) {
  const workspaceDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "cx-repomix-adapter-parity-"),
  );
  try {
    await copyFixtureToWorkspace(workspaceDir);
    const outputPath = path.join(workspaceDir, "repomix-output.xml");
    const explicitFiles = await listFiles(workspaceDir);
    const mergedConfig = adapter.mergeConfigs(
      workspaceDir,
      {},
      buildCliConfig(outputPath),
    );
    await adapter.pack([workspaceDir], mergedConfig, () => {}, {}, explicitFiles);
    const outputText = await fs.readFile(outputPath, "utf8");
    const tokenCounter = new adapter.TokenCounter("o200k_base");
    if (typeof tokenCounter.init === "function") {
      await tokenCounter.init();
    }
    const perFileTokenCounts = {};
    try {
      for (const absolutePath of explicitFiles) {
        if (absolutePath === outputPath) {
          continue;
        }
        const relativePath = path
          .relative(workspaceDir, absolutePath)
          .replaceAll("\\", "/");
        const content = await fs.readFile(absolutePath, "utf8");
        perFileTokenCounts[relativePath] = tokenCounter.countTokens(
          content,
          relativePath,
        );
      }
    } finally {
      if (typeof tokenCounter.free === "function") {
        tokenCounter.free();
      }
    }

    const sortedPerFileTokenCounts = Object.fromEntries(
      Object.entries(perFileTokenCounts).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
    const totalTokens = Object.values(sortedPerFileTokenCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      baselinePackage: {
        name: packageInfo.name,
        version: packageInfo.version,
      },
      encoding: "o200k_base",
      fixture: {
        source: "tests/fixtures/repomix-adapter-parity/input",
        generatedFiles: [GENERATED_BINARY_FILE],
      },
      perFileTokenCounts: sortedPerFileTokenCounts,
      totalTokens,
      outputXmlSha256: sha256(outputText),
      securityFindings: await summarizeSecurity(adapter),
    };
  } finally {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  }
}

function comparableSnapshot(snapshot) {
  const { baselinePackage: _baselinePackage, ...comparable } = snapshot;
  return comparable;
}

function firstDifference(left, right, prefix = "") {
  if (Object.is(left, right)) {
    return undefined;
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return `${prefix || "<root>"}: expected ${JSON.stringify(left)}, got ${JSON.stringify(right)}`;
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    const child = firstDifference(
      left[key],
      right[key],
      prefix ? `${prefix}.${key}` : key,
    );
    if (child) {
      return child;
    }
  }
  return undefined;
}

const adapter = await importAdapter(MODULE_PATH);
const packageInfo = await getPackageInfo(MODULE_PATH);
const snapshot = await captureParitySnapshot(adapter, packageInfo);

if (MODE === "write-baseline") {
  await fs.writeFile(BASELINE_PATH, stableJson(snapshot), "utf8");
  console.log(
    `repomix adapter parity: wrote ${packageInfo.name}@${packageInfo.version} baseline`,
  );
} else {
  const baseline = JSON.parse(await fs.readFile(BASELINE_PATH, "utf8"));
  const expected = comparableSnapshot(baseline);
  const actual = comparableSnapshot(snapshot);
  const difference = firstDifference(expected, actual);
  if (difference) {
    console.error(
      `repomix adapter parity failed for ${packageInfo.name}@${packageInfo.version}`,
    );
    console.error(difference);
    process.exit(1);
  }
  console.log(
    `repomix adapter parity: ${packageInfo.name}@${packageInfo.version} matches ${baseline.baselinePackage.name}@${baseline.baselinePackage.version}`,
  );
}
