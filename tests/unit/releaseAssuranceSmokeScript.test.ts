import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  createNpmPackEnv,
  createReleaseAssurancePaths,
} from "../../scripts/release-assurance-smoke.js";

describe("release assurance smoke script helpers", () => {
  test("uses a local npm cache inside tarball-artifacts", () => {
    const cwd = "/tmp/cx-release-smoke";
    const paths = createReleaseAssurancePaths(cwd);

    expect(paths.tarballDir).toBe(path.join(cwd, "tarball-artifacts"));
    expect(paths.npmCacheDir).toBe(
      path.join(cwd, "tarball-artifacts", ".npm-cache"),
    );
    expect(paths.releaseIntegrityPath).toBe(
      path.join(cwd, "dist", "release-integrity.json"),
    );
  });

  test("creates npm pack env without relying on the global npm cache", () => {
    const tarballDir = "/tmp/cx-release-smoke/tarball-artifacts";
    const env = createNpmPackEnv(tarballDir, {
      HOME: "/Users/example",
      npm_config_cache: "/Users/example/.npm",
    });

    expect(env.HOME).toBe("/Users/example");
    expect(env.npm_config_cache).toBe(path.join(tarballDir, ".npm-cache"));
  });
});
