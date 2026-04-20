// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  inferExplicitReleaseAction,
  isDevelopmentVersion,
  normalizeVersionInput,
  suggestReleaseVersion,
  updateReleaseVersionFiles,
} from "../../scripts/release.js";

describe("release script helpers", () => {
  test("release helper expectations stay aligned with the closed single-oracle CI model", () => {
    expect("repomix-reference-oracle").toContain("reference-oracle");
    expect("repomix-reference-oracle").not.toContain("dual-oracle");
    expect("repomix-reference-oracle").not.toContain("adapter-version");
  });

  test("suggestReleaseVersion promotes a dev baseline to its release candidate", () => {
    expect(suggestReleaseVersion("0.4.0-dev")).toBe("0.4.0");
  });

  test("suggestReleaseVersion increments the patch version for stable releases", () => {
    expect(suggestReleaseVersion("0.4.0")).toBe("0.4.1");
  });

  test("normalizeVersionInput strips a leading tag prefix", () => {
    expect(normalizeVersionInput("v0.4.0")).toBe("0.4.0");
  });

  test("isDevelopmentVersion detects the develop baseline convention", () => {
    expect(isDevelopmentVersion("0.4.0-dev")).toBe(true);
    expect(isDevelopmentVersion("0.4.0")).toBe(false);
  });

  test("inferExplicitReleaseAction treats a new version as candidate start", () => {
    expect(
      inferExplicitReleaseAction({
        currentVersion: "0.4.0-dev",
        requestedVersion: "v0.4.0",
      }),
    ).toBe("start");
  });

  test("inferExplicitReleaseAction treats the same version as tag finalization", () => {
    expect(
      inferExplicitReleaseAction({
        currentVersion: "0.4.0",
        requestedVersion: "v0.4.0",
      }),
    ).toBe("finalize");
  });

  test("updateReleaseVersionFiles keeps package.json and package-lock.json aligned", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cx-release-script-"));
    await fs.writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "@wsmy/cx-cli", version: "0.4.0-dev" }, null, 2)}\n`,
      "utf8",
    );
    await fs.writeFile(
      path.join(cwd, "package-lock.json"),
      `${JSON.stringify(
        {
          name: "@wsmy/cx-cli",
          version: "0.4.0-dev",
          packages: {
            "": {
              name: "@wsmy/cx-cli",
              version: "0.4.0-dev",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    updateReleaseVersionFiles(cwd, "0.4.0");

    const packageJson = JSON.parse(
      await fs.readFile(path.join(cwd, "package.json"), "utf8"),
    ) as { version: string };
    const packageLock = JSON.parse(
      await fs.readFile(path.join(cwd, "package-lock.json"), "utf8"),
    ) as {
      version: string;
      packages: { "": { version: string } };
    };

    expect(packageJson.version).toBe("0.4.0");
    expect(packageLock.version).toBe("0.4.0");
    expect(packageLock.packages[""].version).toBe("0.4.0");
  });
});
