import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const packageVersion = packageJson.version as string;

const args = process.argv.slice(2);
let outputPath = "formula/cx-cli.rb";
let requestedVersion = packageVersion;
let versionProvided = false;
let tarballPath: string | undefined;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg) continue;
  if (arg === "--output") {
    outputPath = args[index + 1] ?? outputPath;
    index += 1;
  } else if (arg.startsWith("--output=")) {
    outputPath = arg.slice("--output=".length);
  } else if (arg === "--tarball") {
    tarballPath = args[index + 1] ?? tarballPath;
    index += 1;
  } else if (arg.startsWith("--tarball=")) {
    tarballPath = arg.slice("--tarball=".length);
  } else if (!arg.startsWith("-") && !versionProvided) {
    requestedVersion = arg;
    versionProvided = true;
  }
}

if (!requestedVersion) {
  throw new Error("A version is required to generate the Homebrew formula.");
}

if (!tarballPath && requestedVersion !== packageVersion) {
  throw new Error(
    `Requested version ${requestedVersion} does not match package.json version ${packageVersion}. Pass --tarball for a prebuilt release artifact or run from the tagged release checkout.`,
  );
}

const description =
  packageJson.description ??
  "Deterministic context bundler built on top of Repomix.";
const homepage = packageJson.homepage ?? "https://github.com/wstein/cx-cli";
const license = packageJson.license ?? "MIT";
const tarballUrl = `https://registry.npmjs.org/@wsmy/cx-cli/-/cx-cli-${requestedVersion}.tgz`;

function packLocalTarball(): { tarballPath: string; cleanupDir: string } {
  console.log(`Packing local npm tarball for version ${requestedVersion}...`);
  const tempDir = mkdtempSync(join(tmpdir(), "cx-cli-homebrew-"));
  try {
    const packResult = spawnSync(
      "npm",
      ["pack", "--json", "--pack-destination", tempDir],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    if (packResult.status !== 0) {
      throw new Error(
        `Failed to pack local npm tarball: ${packResult.stderr || packResult.stdout || "unknown error"}`,
      );
    }

    const packedOutput = packResult.stdout.trim();
    if (!packedOutput) {
      throw new Error("npm pack did not return tarball metadata.");
    }

    const packMetadata = JSON.parse(packedOutput) as Array<{
      filename?: string;
    }>;
    const filename = packMetadata[0]?.filename;
    if (!filename) {
      throw new Error("npm pack did not report a tarball filename.");
    }

    return {
      tarballPath: resolve(tempDir, filename),
      cleanupDir: tempDir,
    };
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

const tarballArtifact = tarballPath
  ? { tarballPath: resolve(process.cwd(), tarballPath), cleanupDir: undefined }
  : packLocalTarball();

try {
  const buffer = readFileSync(tarballArtifact.tarballPath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const escapedDescription = description.replace(/"/g, '\\"');
  const formula = `class CxCli < Formula
  desc "${escapedDescription}"
  homepage "${homepage}"
  url "${tarballUrl}"
  sha256 "${sha256}"
  license "${license}"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "cx", shell_output("#{bin}/cx --help")
  end
end
`;

  writeFileSync(outputPath, formula, "utf8");
  console.log(`Wrote Homebrew formula to ${outputPath}`);
  console.log(`Computed sha256: ${sha256}`);
} finally {
  if (tarballArtifact.cleanupDir) {
    rmSync(tarballArtifact.cleanupDir, { recursive: true, force: true });
  }
}
