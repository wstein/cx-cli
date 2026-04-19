// test-lane: unit
import { describe, expect, test } from "vitest";
import { renderCompletionScript } from "../../src/cli/completion.js";

describe("Completion Script Generation", () => {
  describe("Bash completion", () => {
    test("sentinel strings present", () => {
      const script = renderCompletionScript("bash");
      expect(script).toContain("###-begin-cx-completions-###");
      expect(script).toContain("###-end-cx-completions-###");
    });

    test("all command names in output", () => {
      const script = renderCompletionScript("bash");
      const commands = [
        "init",
        "inspect",
        "bundle",
        "list",
        "validate",
        "verify",
        "extract",
        "mcp",
        "doctor",
        "render",
        "config",
        "completion",
        "notes",
        "adapter",
      ];
      for (const cmd of commands) {
        expect(script).toContain(cmd);
      }
    });

    test("option flags in output", () => {
      const script = renderCompletionScript("bash");
      expect(script).toContain("--json");
      expect(script).toContain("--config");
      expect(script).toContain("--force");
      expect(script).toContain("--help");
      expect(script).toContain("--version");
    });

    test("choices for style option", () => {
      const script = renderCompletionScript("bash");
      expect(script).toContain("xml");
      expect(script).toContain("markdown");
      expect(script).toContain("plain");
    });
  });

  describe("Zsh completion", () => {
    test("#compdef header present", () => {
      const script = renderCompletionScript("zsh");
      expect(script).toContain("#compdef cx");
    });

    test("sentinel strings present", () => {
      const script = renderCompletionScript("zsh");
      expect(script).toContain("###-begin-cx-completions-###");
      expect(script).toContain("###-end-cx-completions-###");
    });

    test("all command names in output", () => {
      const script = renderCompletionScript("zsh");
      const commands = [
        "init",
        "inspect",
        "bundle",
        "list",
        "validate",
        "verify",
        "extract",
        "mcp",
        "doctor",
        "render",
        "config",
        "completion",
        "notes",
        "adapter",
      ];
      for (const cmd of commands) {
        expect(script).toContain(cmd);
      }
    });

    test("short flags present", () => {
      const script = renderCompletionScript("zsh");
      expect(script).toContain("-h");
      expect(script).toContain("-v");
      expect(script).toContain("--help");
      expect(script).toContain("--version");
    });

    test("choices for style option", () => {
      const script = renderCompletionScript("zsh");
      expect(script).toContain("xml");
      expect(script).toContain("markdown");
      expect(script).toContain("json");
      expect(script).toContain("plain");
    });

    test("choices for layout option", () => {
      const script = renderCompletionScript("zsh");
      expect(script).toContain("flat");
      expect(script).toContain("deep");
    });
  });

  describe("Fish completion", () => {
    test("sentinel strings present", () => {
      const script = renderCompletionScript("fish");
      expect(script).toContain("###-begin-cx-completions-###");
      expect(script).toContain("###-end-cx-completions-###");
    });

    test("complete -c cx prefix", () => {
      const script = renderCompletionScript("fish");
      expect(script).toContain("complete -c cx");
    });

    test("all command names in output", () => {
      const script = renderCompletionScript("fish");
      const commands = [
        "init",
        "inspect",
        "bundle",
        "list",
        "validate",
        "verify",
        "extract",
        "mcp",
        "doctor",
        "render",
        "config",
        "completion",
        "notes",
        "adapter",
      ];
      for (const cmd of commands) {
        expect(script).toContain(cmd);
      }
    });

    test("command descriptions present", () => {
      const script = renderCompletionScript("fish");
      expect(script).toContain("Create a starter cx.toml");
      expect(script).toContain("Show the computed plan");
      expect(script).toContain("Create a bundle directory");
    });

    test("global option flags present", () => {
      const script = renderCompletionScript("fish");
      expect(script).toContain("-l help");
      expect(script).toContain("-l version");
      expect(script).toContain("-l strict");
      expect(script).toContain("-l lenient");
    });

    test("short flags for global options", () => {
      const script = renderCompletionScript("fish");
      expect(script).toContain("-s h");
      expect(script).toContain("-s v");
    });

    test("choices for style option", () => {
      const script = renderCompletionScript("fish");
      expect(script).toContain("xml");
      expect(script).toContain("markdown");
      expect(script).toContain("json");
      expect(script).toContain("plain");
    });

    test("choices for layout option", () => {
      const script = renderCompletionScript("fish");
      expect(script).toContain("flat");
      expect(script).toContain("deep");
    });

    test("choices for shell option", () => {
      const script = renderCompletionScript("fish");
      expect(script).toContain("bash");
      expect(script).toContain("zsh");
      expect(script).toContain("fish");
    });
  });
});
