import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packagePath = resolve(process.cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const packageVersion = packageJson.version as string;

const args = process.argv.slice(2);
let outputPath = "formula/cx-cli.rb";
let requestedVersion = packageVersion;
let versionProvided = false;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg) continue;
  if (arg === "--output") {
    outputPath = args[index + 1] ?? outputPath;
    index += 1;
  } else if (arg.startsWith("--output=")) {
    outputPath = arg.slice("--output=".length);
  } else if (!arg.startsWith("-") && !versionProvided) {
    requestedVersion = arg;
    versionProvided = true;
  }
}

if (!requestedVersion) {
  throw new Error("A version is required to generate the Homebrew formula.");
}

const description =
  packageJson.description ??
  "Deterministic context bundler built on top of Repomix.";
const homepage = packageJson.homepage ?? "https://github.com/wstein/cx-cli";
const license = packageJson.license ?? "MIT";
const tarballUrl = `https://registry.npmjs.org/@wsmy/cx-cli/-/cx-cli-${requestedVersion}.tgz`;

console.log(`Fetching npm tarball for version ${requestedVersion}...`);
const response = await fetch(tarballUrl);
if (!response.ok) {
  throw new Error(
    `Failed to download tarball from ${tarballUrl}: ${response.status} ${response.statusText}`,
  );
}

const buffer = Buffer.from(await response.arrayBuffer());
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
