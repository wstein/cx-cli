import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

interface ReleaseSBOM {
  version: string;
  timestamp: string;
  nodeVersion: string;
  bunVersion: string;
  tarballName: string;
  tarballHash: string;
}

async function main(): Promise<void> {
  try {
    const tarballDir = "tarball-artifacts";

    // Find the tarball file
    const files = await fs.readdir(tarballDir);
    const tarballFile = files.find((f) => f.endsWith(".tgz"));

    if (!tarballFile) {
      throw new Error("No .tgz file found in tarball-artifacts directory");
    }

    const tarballPath = path.join(tarballDir, tarballFile);

    // Compute SHA-256 hash
    const fileContent = await fs.readFile(tarballPath);
    const hash = createHash("sha256").update(fileContent).digest("hex");

    // Get version from package.json
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf-8"));
    const version = packageJson.version;

    // Get Node version
    const nodeVersion = execSync("node --version").toString().trim();

    // Get Bun version
    const bunVersion = execSync("bun --version").toString().trim();

    const sbom: ReleaseSBOM = {
      version,
      timestamp: new Date().toISOString(),
      nodeVersion,
      bunVersion,
      tarballName: tarballFile,
      tarballHash: hash,
    };

    // Write to dist/release-integrity.json
    const distDir = "dist";
    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(
      path.join(distDir, "release-integrity.json"),
      JSON.stringify(sbom, null, 2),
    );

    console.log(
      `✓ Release integrity file created: ${tarballFile} (SHA-256: ${hash.slice(0, 16)}...)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Release integrity generation failed: ${message}`);
    process.exit(1);
  }
}

main();
