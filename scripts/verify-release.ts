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
    // Read the SBOM
    const sbomPath = path.join("dist", "release-integrity.json");
    const sbomContent = await fs.readFile(sbomPath, "utf-8");
    const sbom: ReleaseSBOM = JSON.parse(sbomContent);

    // Find the tarball
    const tarballDir = "tarball-artifacts";
    const files = await fs.readdir(tarballDir);
    const tarballFile = files.find((f) => f.endsWith(".tgz"));

    if (!tarballFile) {
      throw new Error("No .tgz file found in tarball-artifacts directory");
    }

    if (tarballFile !== sbom.tarballName) {
      throw new Error(
        `Tarball mismatch: expected ${sbom.tarballName}, found ${tarballFile}`,
      );
    }

    // Compute hash
    const tarballPath = path.join(tarballDir, tarballFile);
    const fileContent = await fs.readFile(tarballPath);
    const hash = createHash("sha256").update(fileContent).digest("hex");

    // Verify
    if (hash !== sbom.tarballHash) {
      throw new Error(
        `Hash mismatch: expected ${sbom.tarballHash}, got ${hash}`,
      );
    }

    console.log(`✓ Release integrity verified`);
    console.log(`  Version: ${sbom.version}`);
    console.log(`  Tarball: ${sbom.tarballName}`);
    console.log(`  Hash: ${hash.slice(0, 16)}...`);
    console.log(`  Timestamp: ${sbom.timestamp}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Release verification failed: ${message}`);
    process.exit(1);
  }
}

main();
