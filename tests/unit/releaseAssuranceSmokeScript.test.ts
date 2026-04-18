import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  createNpmPackEnv,
  createReleaseAssurancePaths,
  runCommand,
  runJsonCommand,
  runReleaseAssuranceSmoke,
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

  test("runCommand forwards inherit stdio and merged environment", async () => {
    const execaCalls: Array<{
      command: string;
      args: string[];
      options: Record<string, unknown>;
    }> = [];

    await runCommand(
      "node",
      ["scripts/example.js"],
      { CI: "true" },
      {
        baseEnv: { HOME: "/Users/example" },
        execaImpl: async (command, args, options) => {
          execaCalls.push({ command, args, options });
        },
      },
    );

    expect(execaCalls).toEqual([
      {
        command: "node",
        args: ["scripts/example.js"],
        options: {
          stdio: "inherit",
          env: { HOME: "/Users/example", CI: "true" },
        },
      },
    ]);
  });

  test("runJsonCommand captures stdout with pipe mode", async () => {
    const execaCalls: Array<{
      command: string;
      args: string[];
      options: Record<string, unknown>;
    }> = [];

    const stdout = await runJsonCommand(
      "npm",
      ["pack", "--json"],
      {},
      {
        baseEnv: { HOME: "/Users/example" },
        execaImpl: async (command, args, options) => {
          execaCalls.push({ command, args, options });
          return { stdout: '[{"filename":"demo.tgz"}]' };
        },
      },
    );

    expect(stdout).toBe('[{"filename":"demo.tgz"}]');
    expect(execaCalls).toEqual([
      {
        command: "npm",
        args: ["pack", "--json"],
        options: {
          stdin: "ignore",
          stdout: "pipe",
          stderr: "inherit",
          env: { HOME: "/Users/example" },
        },
      },
    ]);
  });

  test("runReleaseAssuranceSmoke runs pack, integrity checks, and cleanup", async () => {
    const cwd = "/tmp/cx-release-smoke";
    const rmCalls: Array<{ target: string; options: Record<string, unknown> }> =
      [];
    const mkdirCalls: Array<{
      target: string;
      options: Record<string, unknown>;
    }> = [];
    const runJsonCalls: Array<{
      command: string;
      args: string[];
      envOverrides: Record<string, string>;
      options: Record<string, unknown>;
    }> = [];
    const runCalls: Array<{
      command: string;
      args: string[];
      envOverrides: Record<string, string>;
      options: Record<string, unknown>;
    }> = [];
    const logs: string[] = [];

    await runReleaseAssuranceSmoke(cwd, {
      baseEnv: { HOME: "/Users/example" },
      execPath: "/usr/local/bin/node",
      fsImpl: {
        rm: async (target, options) => {
          rmCalls.push({ target, options });
        },
        mkdir: async (target, options) => {
          mkdirCalls.push({ target, options });
        },
      },
      runJsonImpl: async (command, args, envOverrides, options) => {
        runJsonCalls.push({
          command,
          args,
          envOverrides: envOverrides as Record<string, string>,
          options: options as Record<string, unknown>,
        });
        return '[{"filename":"cx-cli-0.0.0.tgz"}]';
      },
      runImpl: async (command, args, envOverrides, options) => {
        runCalls.push({
          command,
          args,
          envOverrides: envOverrides as Record<string, string>,
          options: options as Record<string, unknown>,
        });
      },
      log: (message) => {
        logs.push(message);
      },
    });

    const tarballDir = path.join(cwd, "tarball-artifacts");
    const releaseIntegrityPath = path.join(
      cwd,
      "dist",
      "release-integrity.json",
    );
    const npmCacheDir = path.join(tarballDir, ".npm-cache");

    expect(mkdirCalls).toEqual([
      { target: tarballDir, options: { recursive: true } },
      { target: npmCacheDir, options: { recursive: true } },
    ]);
    expect(runJsonCalls).toEqual([
      {
        command: "npm",
        args: ["pack", "--json", "--pack-destination", "tarball-artifacts"],
        envOverrides: {
          HOME: "/Users/example",
          npm_config_cache: npmCacheDir,
        },
        options: { baseEnv: { HOME: "/Users/example" } },
      },
    ]);
    expect(runCalls).toEqual([
      {
        command: "/usr/local/bin/node",
        args: ["scripts/release-integrity.js"],
        envOverrides: {},
        options: { baseEnv: { HOME: "/Users/example" } },
      },
      {
        command: "/usr/local/bin/node",
        args: ["scripts/verify-release.js"],
        envOverrides: {},
        options: { baseEnv: { HOME: "/Users/example" } },
      },
    ]);
    expect(rmCalls).toEqual([
      { target: tarballDir, options: { recursive: true, force: true } },
      { target: tarballDir, options: { recursive: true, force: true } },
      { target: releaseIntegrityPath, options: { force: true } },
    ]);
    expect(logs).toEqual([
      "✓ Packed release tarball: cx-cli-0.0.0.tgz",
      "✓ Release integrity smoke completed",
    ]);
  });

  test("runReleaseAssuranceSmoke still cleans up when npm pack output is invalid", async () => {
    const cwd = "/tmp/cx-release-smoke";
    const rmCalls: Array<{ target: string; options: Record<string, unknown> }> =
      [];
    const runCalls: string[] = [];

    await expect(
      runReleaseAssuranceSmoke(cwd, {
        fsImpl: {
          rm: async (target, options) => {
            rmCalls.push({ target, options });
          },
          mkdir: async () => {},
        },
        runJsonImpl: async () => "[]",
        runImpl: async () => {
          runCalls.push("unexpected");
        },
        log: () => {},
      }),
    ).rejects.toThrow("npm pack did not return a tarball filename");

    const tarballDir = path.join(cwd, "tarball-artifacts");
    const releaseIntegrityPath = path.join(
      cwd,
      "dist",
      "release-integrity.json",
    );

    expect(runCalls).toHaveLength(0);
    expect(rmCalls).toEqual([
      { target: tarballDir, options: { recursive: true, force: true } },
      { target: tarballDir, options: { recursive: true, force: true } },
      { target: releaseIntegrityPath, options: { force: true } },
    ]);
  });
});
