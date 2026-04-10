import fs from "node:fs/promises";
import path from "node:path";

import { parseChecksumFile } from "../manifest/checksums.js";
import { CxError } from "../shared/errors.js";
import { sha256File } from "../shared/hashing.js";
import { loadManifestFromBundle, validateBundle } from "./validate.js";

export async function verifyBundle(bundleDir: string): Promise<void> {
  const { manifestName } = await validateBundle(bundleDir);
  const { manifest } = await loadManifestFromBundle(bundleDir);
  const checksums = parseChecksumFile(
    await fs.readFile(path.join(bundleDir, manifest.checksumFile), "utf8"),
  );
  const expectedFiles = new Set([
    manifestName,
    ...manifest.sections.map((section) => section.outputFile),
    ...manifest.assets.map((asset) => asset.storedPath),
  ]);

  for (const checksum of checksums) {
    if (!expectedFiles.has(checksum.relativePath)) {
      throw new CxError(
        `Checksum file references an unexpected path: ${checksum.relativePath}.`,
        10,
      );
    }

    const actualHash = await sha256File(
      path.join(bundleDir, checksum.relativePath),
    );
    if (actualHash !== checksum.hash) {
      throw new CxError(`Checksum mismatch for ${checksum.relativePath}.`, 10);
    }
  }
}
