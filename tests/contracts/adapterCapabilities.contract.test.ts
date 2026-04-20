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
      oracleAdapter?: {
        adapterContract?: string;
        packageName?: string;
        packageVersion?: string;
      };
      referenceAdapter?: { packageName?: string; installed?: boolean };
      adapter?: unknown;
      repomix?: unknown;
    }>(result.stdout);

    expect(payload.oracleAdapter?.adapterContract).toBe("repomix-pack-v1");
    expect(typeof payload.oracleAdapter?.packageVersion).toBe("string");
    expect(payload.oracleAdapter?.packageName).toBeDefined();
    expect(payload.referenceAdapter?.packageName).toBe("repomix");
    expect(typeof payload.referenceAdapter?.installed).toBe("boolean");
    expect(payload).not.toHaveProperty("adapter");
    expect(payload).not.toHaveProperty("repomix");
  });

  test("adapter capability roles stay semantically distinct without fork-era assumptions", async () => {
    const result = await captureCli({
      run: () => main(["adapter", "capabilities", "--json"]),
    });
    expect(result.exitCode).toBe(0);

    const payload = parseJsonOutput<{
      oracleAdapter?: { modulePath?: string; compatibilityStrategy?: string };
      referenceAdapter?: { modulePath?: string; usage?: string };
    }>(result.stdout);

    expect(payload.oracleAdapter?.modulePath).toBeDefined();
    expect(payload.oracleAdapter?.compatibilityStrategy).toContain(
      "optional parity oracle",
    );
    expect(payload.referenceAdapter?.modulePath).toBe("repomix");
    expect(payload.referenceAdapter?.usage).toBe(
      "reference-only parity target",
    );
  });

  test("non-adapter JSON surfaces do not leak adapter metadata", async () => {
    const project = await createProject();
    const cwd = process.cwd();
    process.chdir(project.root);

    try {
      const bundleResult = await captureCli({
        run: () => main(["bundle", "--config", project.configPath, "--json"]),
      });
      expect(bundleResult.exitCode).toBe(0);
      const bundlePayload = parseJsonOutput<{
        adapter?: unknown;
        repomix?: unknown;
      }>(bundleResult.stdout);
      expect(bundlePayload).not.toHaveProperty("adapter");
      expect(bundlePayload).not.toHaveProperty("repomix");

      const inspectResult = await captureCli({
        run: () => main(["inspect", "--config", project.configPath, "--json"]),
      });
      expect(inspectResult.exitCode).toBe(0);
      const inspectPayload = parseJsonOutput<{
        adapter?: unknown;
        repomix?: unknown;
      }>(inspectResult.stdout);
      expect(inspectPayload).not.toHaveProperty("adapter");
      expect(inspectPayload).not.toHaveProperty("repomix");

      const listResult = await captureCli({
        run: () => main(["list", "dist/demo-bundle", "--json"]),
      });
      expect(listResult.exitCode).toBe(0);
      const listPayload = parseJsonOutput<{
        adapter?: unknown;
        repomix?: unknown;
      }>(listResult.stdout);
      expect(listPayload).not.toHaveProperty("adapter");
      expect(listPayload).not.toHaveProperty("repomix");

      const verifyResult = await captureCli({
        run: () => main(["verify", "dist/demo-bundle", "--json"]),
      });
      expect(verifyResult.exitCode).toBe(0);
      const verifyPayload = parseJsonOutput<{
        adapter?: unknown;
        repomix?: unknown;
      }>(verifyResult.stdout);
      expect(verifyPayload).not.toHaveProperty("adapter");
      expect(verifyPayload).not.toHaveProperty("repomix");

      const validateResult = await captureCli({
        run: () => main(["validate", "dist/demo-bundle", "--json"]),
      });
      expect(validateResult.exitCode).toBe(0);
      const validatePayload = parseJsonOutput<{
        adapter?: unknown;
        repomix?: unknown;
      }>(validateResult.stdout);
      expect(validatePayload).not.toHaveProperty("adapter");
      expect(validatePayload).not.toHaveProperty("repomix");
    } finally {
      process.chdir(cwd);
    }
  });
});
