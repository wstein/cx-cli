// test-lane: unit

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  inferExplicitReleaseAction,
  suggestReleaseVersion,
  updateReleaseVersionFiles,
} from "../../scripts/release.js";

describe("release script helpers", () => {
  test("suggestReleaseVersion increments the patch version", () => {
    expect(suggestReleaseVersion("0.3.23")).toBe("0.3.24");
  });

  test("inferExplicitReleaseAction treats a new version as candidate start", () => {
    expect(
      inferExplicitReleaseAction({
        currentVersion: "0.3.23",
        requestedVersion: "0.3.24",
      }),
    ).toBe("start");
  });

  test("inferExplicitReleaseAction treats the same version as tag finalization", () => {
    expect(
      inferExplicitReleaseAction({
        currentVersion: "0.3.24",
        requestedVersion: "0.3.24",
      }),
    ).toBe("finalize");
  });

  test("updateReleaseVersionFiles keeps package.json and package-lock.json aligned", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cx-release-script-"));
    await fs.writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "@wsmy/cx-cli", version: "0.3.23" }, null, 2)}\n`,
      "utf8",
    );
    await fs.writeFile(
      path.join(cwd, "package-lock.json"),
      `${JSON.stringify(
        {
          name: "@wsmy/cx-cli",
          version: "0.3.23",
          packages: {
            "": {
              name: "@wsmy/cx-cli",
              version: "0.3.23",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    updateReleaseVersionFiles(cwd, "0.3.24");

    const packageJson = JSON.parse(
      await fs.readFile(path.join(cwd, "package.json"), "utf8"),
    ) as { version: string };
    const packageLock = JSON.parse(
      await fs.readFile(path.join(cwd, "package-lock.json"), "utf8"),
    ) as {
      version: string;
      packages: { "": { version: string } };
    };

    expect(packageJson.version).toBe("0.3.24");
    expect(packageLock.version).toBe("0.3.24");
    expect(packageLock.packages[""].version).toBe("0.3.24");
  });
});
