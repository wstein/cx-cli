// test-lane: contract

import fs from "node:fs/promises";
import { afterEach, describe, expect, test } from "vitest";

import { main } from "../../src/cli/main.js";
import { captureCli } from "../helpers/cli/captureCli.js";
import { parseJsonOutput } from "../helpers/cli/parseJsonOutput.js";
import { buildConfig } from "../helpers/config/buildConfig.js";
import { createWorkspace } from "../helpers/workspace/createWorkspace.js";

const workspaceRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    workspaceRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function createProject(): Promise<{ root: string; configPath: string }> {
  const workspace = await createWorkspace({
    config: buildConfig(),
    files: {
      "src/index.ts": "export const ok = 1;\n",
      "README.md": "# Demo\n",
    },
  });
  workspaceRoots.push(workspace.rootDir);
  return {
    root: workspace.rootDir,
    configPath: workspace.configPath,
  };
}

describe("adapter capability contract", () => {
  test("adapter capabilities JSON uses the adapter field name", async () => {
    const result = await captureCli({
      run: () => main(["adapter", "capabilities", "--json"]),
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      adapter?: { adapterContract?: string; packageVersion?: string };
      repomix?: unknown;
    }>(result.stdout);

    expect(payload.adapter?.adapterContract).toBe("repomix-pack-v1");
    expect(typeof payload.adapter?.packageVersion).toBe("string");
    expect(payload).not.toHaveProperty("repomix");
  });

  test("bundle, inspect, list, verify, and validate JSON surfaces expose adapter metadata", async () => {
    const project = await createProject();
    const cwd = process.cwd();
    process.chdir(project.root);

    try {
      const bundleResult = await captureCli({
        run: () => main(["bundle", "--config", project.configPath, "--json"]),
      });
      expect(bundleResult.exitCode).toBe(0);
      const bundlePayload = parseJsonOutput<{
        adapter?: { adapterContract?: string };
        repomix?: unknown;
      }>(bundleResult.stdout);
      expect(bundlePayload.adapter?.adapterContract).toBe("repomix-pack-v1");
      expect(bundlePayload).not.toHaveProperty("repomix");

      const inspectResult = await captureCli({
        run: () => main(["inspect", "--config", project.configPath, "--json"]),
      });
      expect(inspectResult.exitCode).toBe(0);
      const inspectPayload = parseJsonOutput<{
        adapter?: { spanCapability?: string };
        repomix?: unknown;
      }>(inspectResult.stdout);
      expect(inspectPayload.adapter?.spanCapability).toBeDefined();
      expect(inspectPayload).not.toHaveProperty("repomix");

      const listResult = await captureCli({
        run: () => main(["list", "dist/demo-bundle", "--json"]),
      });
      expect(listResult.exitCode).toBe(0);
      const listPayload = parseJsonOutput<{
        adapter?: { spanCapability?: string };
        repomix?: unknown;
      }>(listResult.stdout);
      expect(inspectPayload.adapter?.spanCapability).toBe(
        listPayload.adapter?.spanCapability,
      );
      expect(listPayload).not.toHaveProperty("repomix");

      const verifyResult = await captureCli({
        run: () => main(["verify", "dist/demo-bundle", "--json"]),
      });
      expect(verifyResult.exitCode).toBe(0);
      const verifyPayload = parseJsonOutput<{
        adapter?: { spanCapabilityReason?: string };
        repomix?: unknown;
      }>(verifyResult.stdout);
      expect(verifyPayload.adapter?.spanCapabilityReason).toContain(
        "renderWithMap",
      );
      expect(verifyPayload).not.toHaveProperty("repomix");

      const validateResult = await captureCli({
        run: () => main(["validate", "dist/demo-bundle", "--json"]),
      });
      expect(validateResult.exitCode).toBe(0);
      const validatePayload = parseJsonOutput<{
        adapter?: { adapterContract?: string };
        repomix?: unknown;
      }>(validateResult.stdout);
      expect(validatePayload.adapter?.adapterContract).toBe("repomix-pack-v1");
      expect(validatePayload).not.toHaveProperty("repomix");
    } finally {
      process.chdir(cwd);
    }
  });
});
