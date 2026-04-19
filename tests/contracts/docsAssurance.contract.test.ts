// test-lane: contract
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

describe("docs assurance contract", () => {
  test("doc hierarchy keeps semantics, mapping, workflows, and integration separate", async () => {
    const rootReadme = await readText("README.md");
    const docsIndex = await readText("docs/README.md");
    const governance = await readText("docs/GOVERNANCE.md");
    const mentalModel = await readText("docs/MENTAL_MODEL.md");
    const operatingModes = await readText("docs/OPERATING_MODES.md");
    const systemMap = await readText("docs/SYSTEM_MAP.md");
    const systemContracts = await readText("docs/SYSTEM_CONTRACTS.md");
    const agentModel = await readText("docs/AGENT_OPERATING_MODEL.md");
    const agentIntegration = await readText("docs/AGENT_INTEGRATION.md");
    const manual = await readText("docs/MANUAL.md");

    expect(rootReadme).toContain("bun run ci:notes:governance");
    expect(rootReadme).toContain("Run `cx mcp`");
    expect(rootReadme).toContain("https://wstein.github.io/cx-cli/coverage/");
    expect(docsIndex).toContain("[OPERATING_MODES.md](./OPERATING_MODES.md)");
    expect(docsIndex).toContain("[SYSTEM_MAP.md](./SYSTEM_MAP.md)");
    expect(docsIndex).toContain("[SYSTEM_CONTRACTS.md](./SYSTEM_CONTRACTS.md)");
    expect(docsIndex).toContain("Everything else should reference");
    expect(governance).toContain("## Hard Hierarchy Contract");
    expect(governance).toContain("`MENTAL_MODEL.md` owns canonical semantics.");
    expect(governance).toContain("`OPERATING_MODES.md` maps those semantics");
    expect(governance).toContain(
      "`WORKFLOWS/*` shows concrete execution examples",
    );
    expect(governance).toContain("`AGENT_*` documents the integration layer");
    expect(governance).toContain(
      "Everything outside `MENTAL_MODEL.md` must reference canonical semantics instead of redefining them.",
    );
    expect(mentalModel).toContain("canonical semantics");
    expect(mentalModel).toContain("See: [SYSTEM_MAP.md](SYSTEM_MAP.md)");
    expect(mentalModel).toContain(
      "See: [SYSTEM_CONTRACTS.md](SYSTEM_CONTRACTS.md)",
    );
    expect(systemMap).toContain("Hypothesis");
    expect(systemMap).toContain("Memory");
    expect(systemMap).toContain("Snapshot");
    expect(systemMap).toContain("Proof");
    expect(systemContracts).toContain("## Cognition Contract V1");
    expect(systemContracts).toContain("## Boundary Contract");
    expect(systemContracts).toContain("## Trust Propagation Model");
    expect(systemContracts).toContain("valid note != good note");
    expect(operatingModes).toContain(
      "Need fast interactive AI help on live code? Use `cx mcp`.",
    );
    expect(operatingModes).toContain("## Ultra-Minimal Onboarding");
    expect(operatingModes).toContain("Run `cx mcp`.");
    expect(operatingModes).toContain("See the agent work on live code.");
    expect(operatingModes).toContain("Learn later:");
    expect(operatingModes).toContain("Track B = hypothesis generation");
    expect(operatingModes).toContain("Track A = proof generation");
    expect(operatingModes).toContain("Notes are the durable cognition layer");
    expect(operatingModes).toContain(
      "Need a reproducible, promotable artifact? Use `cx bundle`.",
    );
    expect(operatingModes).toContain(
      "Need durable design memory? Use `cx notes`.",
    );
    expect(manual).toContain("See: [OPERATING_MODES.md](OPERATING_MODES.md)");
    expect(manual).toContain("https://wstein.github.io/cx-cli/coverage/");
    expect(operatingModes).toContain(
      "See: [WORKFLOWS/friday-to-monday.md](WORKFLOWS/friday-to-monday.md)",
    );
    expect(operatingModes).toContain(
      "See: [WORKFLOWS/safe-note-mutation.md](WORKFLOWS/safe-note-mutation.md)",
    );
    expect(agentModel).toContain("This document covers the integration layer");
    expect(agentModel).toContain(
      "It does not redefine the canonical semantics",
    );
    expect(agentModel).toContain("cx mcp catalog --json");
    expect(agentModel).toContain("Source tree: trusted");
    expect(agentIntegration).toContain(
      "This document is an integration guide.",
    );
    expect(agentIntegration).toContain("documented stable subset");
    expect(agentIntegration).toContain("MCP remains an evolving integration");
    expect(manual).toContain("cx mcp catalog --json");
    expect(manual).toContain("Vitest coverage is now the authoritative");
  });

  test("manual defines an assurance ladder", async () => {
    const manual = await readText("docs/MANUAL.md");

    expect(manual).toContain("## Assurance Ladder");
    expect(manual).toContain("`bun run verify`");
    expect(manual).toContain("`bun run certify`");
    expect(manual).toContain("`bun run integrity`");
    expect(manual).toContain("`bun run verify-release`");
  });

  test("release checklist states certify as CI-equivalent gate", async () => {
    const checklist = await readText("docs/RELEASE_CHECKLIST.md");

    expect(checklist).toContain("pre-tag CI-equivalent gate");
    expect(checklist).toContain("Repomix fork compatibility smoke");
    expect(checklist).toContain("bundle transition matrix smoke");
    expect(checklist).toContain("release integrity smoke");
  });

  test("notes module spec documents linked-note enrichment semantics", async () => {
    const notesSpec = await readText("docs/NOTES_MODULE_SPEC.md");

    expect(notesSpec).toContain("## Notes As The Cognition Layer");
    expect(notesSpec).toContain("formal cognition contract");
    expect(notesSpec).toContain("## Governance Model: How, What, Why");
    expect(notesSpec).toContain("4000");
    expect(notesSpec).toContain("100");
    expect(notesSpec).toContain("cx notes check");
    expect(notesSpec).toContain("ci:report:observability");
    expect(notesSpec).toContain("## Linked-Note Enrichment Semantics");
    expect(notesSpec).toContain("inclusion-changing, not advisory");
    expect(notesSpec).toContain("Run `cx inspect --json`");
    expect(notesSpec).toContain("`cx notes graph --id <seed> --depth <n>`");
    expect(notesSpec).toContain("Depth semantics for graph inspection");
    expect(notesSpec).toContain("agent traceability");
    expect(notesSpec).toContain("staleness and contradiction checks");
  });

  test("stop conditions explain the invariant they protect", async () => {
    const manual = await readText("docs/MANUAL.md");
    const extractionSafety = await readText("docs/EXTRACTION_SAFETY.md");
    const agentModel = await readText("docs/AGENT_OPERATING_MODEL.md");

    expect(manual).toContain("Why this stops you: overlap failure protects");
    expect(manual).toContain("Why this stops you: tracked-file drift means");
    expect(extractionSafety).toContain(
      "Why this stops you: once the recovered packed content no longer matches",
    );
    expect(agentModel).toContain(
      "Why this stops you: an exploratory session should not silently cross from analysis into repository mutation.",
    );
  });

  test("workflow docs include temporal provenance and safe note mutation scenarios", async () => {
    const fridayToMonday = await readText("docs/WORKFLOWS/friday-to-monday.md");
    const safeNoteMutation = await readText(
      "docs/WORKFLOWS/safe-note-mutation.md",
    );
    const agentReviewLoop = await readText(
      "docs/WORKFLOWS/agent-note-review-loop.md",
    );

    expect(fridayToMonday).toContain("The developer has local tracked changes");
    expect(fridayToMonday).toContain("cx bundle --config cx.toml --force");
    expect(fridayToMonday).toContain(
      "On Monday, CI should trust only the clean, promotable path.",
    );
    expect(safeNoteMutation).toContain("[mcp]");
    expect(safeNoteMutation).toContain("enable_mutation = true");
    expect(safeNoteMutation).toContain(
      "cx notes graph --id 20260419090000 --depth 2",
    );
    expect(agentReviewLoop).toContain("notes_new(");
    expect(agentReviewLoop).toContain("cx notes check");
    expect(agentReviewLoop).toContain("bun run ci:notes:governance");
  });

  test("mental model and agent integration teach proof, hypothesis, and agent POV", async () => {
    const mentalModel = await readText("docs/MENTAL_MODEL.md");
    const agentIntegration = await readText("docs/AGENT_INTEGRATION.md");
    const agentModel = await readText("docs/AGENT_OPERATING_MODEL.md");

    expect(mentalModel).toContain("Track B = hypothesis generation");
    expect(mentalModel).toContain("Track A = proof generation");
    expect(mentalModel).toContain("durable cognition layer");
    expect(mentalModel).toContain("Source tree: trusted");
    expect(agentModel).toContain("## Operator Decision Ladder");
    expect(agentModel).toContain("## Capability Tiers");
    expect(agentIntegration).toContain("## Agent Point Of View");
    expect(agentIntegration).toContain("doctor_mcp()");
    expect(agentIntegration).toContain('"tokenCount": 287');
    expect(agentIntegration).toContain('"outputStartLine": 41');
  });
});
