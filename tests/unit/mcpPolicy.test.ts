import { describe, expect, it } from "bun:test";
import {
  checkToolAccess,
  DEFAULT_POLICY,
  isCapabilityAllowed,
  PolicyError,
  STRICT_POLICY,
  TOOL_CAPABILITIES,
  UNRESTRICTED_POLICY,
  type McpPolicy,
} from "../../src/mcp/policy.js";

describe("MCP Policy System", () => {
  describe("isCapabilityAllowed", () => {
    it("denies capabilities not in allow list", () => {
      const policy: McpPolicy = {
        allow: ["read", "observe"],
      };
      expect(isCapabilityAllowed(policy, "read")).toBe(true);
      expect(isCapabilityAllowed(policy, "observe")).toBe(true);
      expect(isCapabilityAllowed(policy, "plan")).toBe(false);
      expect(isCapabilityAllowed(policy, "mutate")).toBe(false);
    });

    it("respects explicit deny list", () => {
      const policy: McpPolicy = {
        allow: ["read", "observe", "plan", "mutate"],
        deny: ["mutate"],
      };
      expect(isCapabilityAllowed(policy, "read")).toBe(true);
      expect(isCapabilityAllowed(policy, "mutate")).toBe(false);
    });

    it("enforces deny-by-default", () => {
      const policy: McpPolicy = {
        allow: ["read"],
      };
      expect(isCapabilityAllowed(policy, "read")).toBe(true);
      expect(isCapabilityAllowed(policy, "observe")).toBe(false);
      expect(isCapabilityAllowed(policy, "plan")).toBe(false);
      expect(isCapabilityAllowed(policy, "mutate")).toBe(false);
    });
  });

  describe("checkToolAccess", () => {
    it("allows read tools under default policy", () => {
      const decision = checkToolAccess("workspace_list", DEFAULT_POLICY);
      expect(decision.allowed).toBe(true);
      expect(decision.capability).toBe("read");
      expect(decision.reason).toContain("allowed");
    });

    it("denies mutate tools under default policy", () => {
      const decision = checkToolAccess("notes_new", DEFAULT_POLICY);
      expect(decision.allowed).toBe(false);
      expect(decision.capability).toBe("mutate");
      expect(decision.reason).toContain("denied");
    });

    it("allows observe tools under default policy", () => {
      const decision = checkToolAccess("doctor_mcp", DEFAULT_POLICY);
      expect(decision.allowed).toBe(true);
      expect(decision.capability).toBe("observe");
    });

    it("allows plan tools under default policy", () => {
      const decision = checkToolAccess("bundle", DEFAULT_POLICY);
      expect(decision.allowed).toBe(true);
      expect(decision.capability).toBe("plan");
    });

    it("rejects unknown tools", () => {
      const decision = checkToolAccess("unknown_tool", DEFAULT_POLICY);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("Unknown tool");
    });

    it("enforces strict policy (read+observe only)", () => {
      expect(checkToolAccess("workspace_list", STRICT_POLICY).allowed).toBe(
        true,
      );
      expect(checkToolAccess("doctor_mcp", STRICT_POLICY).allowed).toBe(true);
      expect(checkToolAccess("bundle", STRICT_POLICY).allowed).toBe(false);
      expect(checkToolAccess("notes_new", STRICT_POLICY).allowed).toBe(false);
    });

    it("allows all capabilities under unrestricted policy", () => {
      expect(checkToolAccess("workspace_list", UNRESTRICTED_POLICY).allowed).toBe(
        true,
      );
      expect(checkToolAccess("bundle", UNRESTRICTED_POLICY).allowed).toBe(true);
      expect(checkToolAccess("notes_new", UNRESTRICTED_POLICY).allowed).toBe(
        true,
      );
    });
  });

  describe("Tool Capability Classification", () => {
    it("classifies all read tools correctly", () => {
      const readTools = ["workspace_list", "workspace_grep", "workspace_read"];
      for (const tool of readTools) {
        expect(TOOL_CAPABILITIES[tool]).toBe("read");
      }
    });

    it("classifies all observe tools correctly", () => {
      const observeTools = [
        "doctor_mcp",
        "doctor_overlaps",
        "doctor_secrets",
        "doctor_workflow",
        "notes_read",
        "notes_search",
        "notes_list",
      ];
      for (const tool of observeTools) {
        expect(TOOL_CAPABILITIES[tool]).toBe("observe");
      }
    });

    it("classifies all plan tools correctly", () => {
      const planTools = ["bundle", "bundle_preview"];
      for (const tool of planTools) {
        expect(TOOL_CAPABILITIES[tool]).toBe("plan");
      }
    });

    it("classifies all mutate tools correctly", () => {
      const mutateTools = [
        "notes_new",
        "notes_update",
        "notes_delete",
        "notes_rename",
      ];
      for (const tool of mutateTools) {
        expect(TOOL_CAPABILITIES[tool]).toBe("mutate");
      }
    });
  });

  describe("Adversarial Scenarios", () => {
    it("blocks unauthorized note creation", () => {
      const decision = checkToolAccess("notes_new", DEFAULT_POLICY);
      expect(decision.allowed).toBe(false);
      expect(decision.capability).toBe("mutate");
    });

    it("allows note reading under default policy", () => {
      const decision = checkToolAccess("notes_read", DEFAULT_POLICY);
      expect(decision.allowed).toBe(true);
      expect(decision.capability).toBe("observe");
    });

    it("blocks workspace writes (not in tool list)", () => {
      // There should be no write tools in the workspace category
      const decision = checkToolAccess("workspace_write", DEFAULT_POLICY);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("Unknown");
    });

    it("allows bundle planning but denies mutate", () => {
      expect(checkToolAccess("bundle", DEFAULT_POLICY).allowed).toBe(true);
      expect(checkToolAccess("notes_new", DEFAULT_POLICY).allowed).toBe(false);
    });

    it("strict policy prevents CI/CD bundling", () => {
      // Strict policy only allows read and observe
      expect(checkToolAccess("bundle", STRICT_POLICY).allowed).toBe(false);
    });

    it("policy decision includes informative reason", () => {
      const deniedDecision = checkToolAccess("notes_delete", DEFAULT_POLICY);
      expect(deniedDecision.reason).toContain("notes_delete");
      expect(deniedDecision.reason).toContain("mutate");
      expect(deniedDecision.reason).toContain("denied");
    });
  });

  describe("PolicyError", () => {
    it("creates error with correct properties", () => {
      const error = new PolicyError(
        "notes_new",
        "mutate",
        "Access denied by policy",
      );
      expect(error.toolName).toBe("notes_new");
      expect(error.capability).toBe("mutate");
      expect(error.message).toContain("Access denied");
    });

    it("has correct exit code", () => {
      const error = new PolicyError(
        "notes_new",
        "mutate",
        "Access denied by policy",
      );
      expect(error.exitCode).toBe(15);
    });
  });
});
