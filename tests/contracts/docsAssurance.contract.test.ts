// test-lane: contract

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readText(relativePath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

function squashWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

describe("docs assurance contract", () => {
  test("doc hierarchy keeps semantics, mapping, workflows, and integration separate", async () => {
    const rootReadme = await readText("README.md");
    const docsIndex = await readText(
      "docs/modules/onboarding/pages/index.adoc",
    );
    const governance = await readText(
      "docs/modules/ROOT/pages/repository/docs/governance.adoc",
    );
    const mentalModel = await readText(
      "docs/modules/architecture/pages/mental-model.adoc",
    );
    const operatingModes = await readText(
      "docs/modules/manual/pages/operating-modes.adoc",
    );
    const systemMap = await readText(
      "docs/modules/architecture/pages/system-map.adoc",
    );
    const systemContracts = await readText(
      "docs/modules/architecture/pages/system-contracts.adoc",
    );
    const agentModel = await readText(
      "docs/modules/ROOT/pages/repository/docs/agent_operating_model.adoc",
    );
    const agentIntegration = await readText(
      "docs/modules/ROOT/pages/repository/docs/agent_integration.adoc",
    );
    const manual = await readText(
      "docs/modules/manual/pages/operator-manual.adoc",
    );
    const notesGuide = await readText("notes/README.md");
    const docsIndexNormalized = squashWhitespace(docsIndex);
    const governanceNormalized = squashWhitespace(governance);
    const mentalModelNormalized = squashWhitespace(mentalModel);
    const systemContractsNormalized = squashWhitespace(systemContracts);
    const operatingModesNormalized = squashWhitespace(operatingModes);
    const manualNormalized = squashWhitespace(manual);

    expect(rootReadme).toContain("bun run ci:notes:governance");
    expect(rootReadme).toContain("Run `cx mcp`");
    expect(rootReadme).toContain("https://wstein.github.io/cx-cli/coverage/");
    expect(rootReadme).toContain("Source tree: trusted");
    expect(rootReadme).toContain("Notes: conditional");
    expect(rootReadme).toContain("Agent output: untrusted until verified");
    expect(rootReadme).toContain("Bundle: trusted");
    expect(docsIndex).toContain(
      "xref:manual:operating-modes.adoc[Operating Modes]",
    );
    expect(docsIndex).toContain(
      "xref:architecture:system-map.adoc[System Map]",
    );
    expect(docsIndex).toContain(
      "xref:architecture:system-contracts.adoc[System Contracts]",
    );
    expect(docsIndex).toContain("Everything else should reference");
    expect(docsIndex).toContain("Source tree: trusted");
    expect(docsIndex).toContain("Notes: conditional");
    expect(docsIndex).toContain("Agent output: untrusted until verified");
    expect(docsIndex).toContain("Bundle: trusted");
    expect(docsIndex).toContain("== Workflow Set");
    expect(docsIndexNormalized).toContain(
      "Read the Friday-to-Monday workflow first.",
    );
    expect(docsIndex).toContain("== Historical Material");
    expect(docsIndexNormalized).toContain("docs surface budget");
    expect(governance).toContain("=== Hard Hierarchy Contract");
    expect(governance).toContain("=== Docs Surface Budget");
    expect(governance).toContain("=== MCP Tool Stability Tiers");
    expect(governance).toContain("[[mcp-tool-stability]]");
    expect(governance).toContain("=== Tool Stability Matrix");
    expect(governance).toContain("==== Front-Door Docs");
    expect(governance).toContain("==== Reference-Only Docs");
    expect(governance).toContain(
      "If a new document would introduce another plausible place to start",
    );
    expect(governance).toContain("`Mental Model` owns canonical semantics.");
    expect(governance).toContain("`Operating Modes` maps those semantics");
    expect(governance).toContain(
      "`Operator Workflows` shows concrete execution examples",
    );
    expect(governance).toContain(
      "Agent integration docs document the integration layer",
    );
    expect(governanceNormalized).toContain(
      "Everything outside `Mental Model` must reference canonical semantics instead of redefining them.",
    );
    expect(mentalModelNormalized).toContain("canonical semantics");
    expect(mentalModelNormalized).toContain(
      "xref:architecture:system-map.adoc[System Map]",
    );
    expect(mentalModelNormalized).toContain(
      "xref:architecture:system-contracts.adoc[System Contracts]",
    );
    expect(systemMap).toContain("Hypothesis");
    expect(systemMap).toContain("Memory");
    expect(systemMap).toContain("Snapshot");
    expect(systemMap).toContain("Proof");
    expect(systemContracts).toContain("== Cognition Contract V1");
    expect(systemContracts).toContain("== Boundary Contract");
    expect(systemContracts).toContain("== Trust Propagation Model");
    expect(systemContractsNormalized).toContain("valid note != good note");
    expect(operatingModesNormalized).toContain(
      "Need fast interactive AI help on live code? Use `cx mcp`.",
    );
    expect(operatingModes).toContain("== Ultra-Minimal Onboarding");
    expect(operatingModesNormalized).toContain("Run `cx mcp`.");
    expect(operatingModesNormalized).toContain(
      "See the agent work on live code.",
    );
    expect(operatingModesNormalized).toContain("Learn later:");
    expect(operatingModesNormalized).toContain(
      "Track B = hypothesis generation",
    );
    expect(operatingModesNormalized).toContain("Track A = proof generation");
    expect(operatingModesNormalized).toContain(
      "Notes are the durable cognition layer",
    );
    expect(operatingModesNormalized).toContain(
      "Need a reproducible, promotable artifact? Use `cx bundle`.",
    );
    expect(operatingModesNormalized).toContain(
      "Need durable design memory? Use `cx notes`.",
    );
    expect(manualNormalized).toContain(
      "xref:manual:operating-modes.adoc[Operating Modes]",
    );
    expect(manual).toContain("https://wstein.github.io/cx-cli/coverage/");
    expect(notesGuide).toContain("## Notes And Docs Boundary");
    expect(notesGuide).toContain(
      "`docs/modules/architecture/pages/mental-model.adoc` owns canonical semantics.",
    );
    expect(notesGuide).toContain(
      "`docs/modules/architecture/pages/system-contracts.adoc` owns cognition, boundary, and trust contracts.",
    );
    expect(notesGuide).toContain("Notes should support those documents");
    expect(operatingModesNormalized).toContain(
      "xref:manual:workflows.adoc#friday-to-monday-workflow[Friday to Monday]",
    );
    expect(operatingModesNormalized).toContain(
      "xref:manual:workflows.adoc#safe-note-mutation-workflow[Safe Note Mutation]",
    );
    expect(agentModel).toContain("This document covers the integration layer");
    expect(agentModel).toContain(
      "It does not redefine the canonical semantics",
    );
    expect(agentModel).toContain("cx mcp catalog --json");
    expect(agentModel).toContain("MCP Tool Stability Tiers");
    expect(agentModel).toContain("*Source tree:* trusted");
    expect(agentIntegration).toContain(
      "This document is an integration guide.",
    );
    expect(agentIntegration).toContain("documented stable subset");
    expect(squashWhitespace(agentIntegration)).toContain(
      "MCP remains an evolving integration surface in 0.4.0.",
    );
    expect(manual).toContain(
      "client-specific setup details in the repository reference guide",
    );
    expect(manualNormalized).toContain("cx mcp catalog --json");
    expect(manual).toContain("=== MCP Setup And Daily Operator Use");
    expect(docsIndex).toContain("MCP Tool Stability Tiers");
    expect(manualNormalized).toContain(
      "Vitest coverage is now the authoritative",
    );
    expect(rootReadme).toContain("kernel-owned proof path");
    expect(rootReadme).toContain(
      "adapter/oracle path: diagnostics and parity only",
    );
    expect(rootReadme).not.toContain("built on top of Repomix");
    expect(manualNormalized).toContain(
      "Adapter/oracle path: expert diagnostics and parity only",
    );
    expect(manual).not.toContain("built on top of Repomix");
  });

  test("manual defines an assurance ladder", async () => {
    const manual = await readText(
      "docs/modules/manual/pages/operator-manual.adoc",
    );

    expect(manual).toContain("== Assurance Ladder");
    expect(manual).toContain("`bun run verify`");
    expect(manual).toContain("`bun run certify`");
    expect(manual).toContain("`bun run integrity`");
    expect(manual).toContain("`bun run verify-release`");
  });

  test("release checklist states certify as CI-equivalent gate", async () => {
    const checklist = await readText(
      "docs/modules/manual/pages/release-and-integrity.adoc",
    );

    const normalized = squashWhitespace(checklist);

    expect(normalized).toContain("pre-tag CI-equivalent gate");
    expect(normalized).toContain(
      "official Repomix reference-oracle smoke lane",
    );
    expect(normalized).toContain("bundle transition matrix smoke");
    expect(normalized).toContain("release integrity smoke");
  });

  test("release docs lock the two-phase candidate and finalization model", async () => {
    const checklist = await readText(
      "docs/modules/manual/pages/release-and-integrity.adoc",
    );
    const developerWorkflow = await readText(
      "notes/Developer Command Workflow.md",
    );
    const ghaTriggers = await readText("notes/GitHub Actions Triggers.md");

    const normalized = squashWhitespace(checklist);

    expect(normalized).toContain("Prepare the release candidate on `develop`");
    expect(normalized).toContain("Finalize the release");
    expect(normalized).toContain("fast-forward update to the released commit");
    expect(developerWorkflow).toContain("Releases are prepared on `develop`.");
    expect(developerWorkflow).toContain(
      "The `vX.Y.Z` tag is the finalization action.",
    );
    expect(ghaTriggers).toContain("two-phase rule");
    expect(ghaTriggers).toContain("`develop` carries the versioned");
    expect(ghaTriggers).toContain(
      "release workflow should fast-forward `main`",
    );
    expect(normalized).toContain("closed release line");
  });

  test("public docs keep the native-proof-path story and reject fork-backed runtime language", async () => {
    const readme = await readText("README.md");
    const architecture = await readText(
      "docs/modules/architecture/pages/implementation-reference.adoc",
    );
    const migration = await readText(
      "docs/modules/manual/pages/release-and-integrity.adoc",
    );
    const changelog = await readText("CHANGELOG.md");

    expect(readme).toContain("kernel-owned proof path");
    expect(squashWhitespace(architecture)).toContain(
      "adapter/oracle seam exists for diagnostics and parity visibility",
    );
    expect(migration).toContain("The shipped proof path is kernel-owned.");
    expect(changelog).toContain("Native proof path is the shipped runtime");

    expect(readme).not.toContain("built on top of Repomix");
    expect(architecture).not.toContain("wraps Repomix in a stricter system");
    expect(changelog).not.toContain("fork compatibility smoke");
    expect(migration).not.toContain("built on top of Repomix");
  });

  test("docs folder keeps only the Antora guide as markdown", async () => {
    const docsGuide = await readText("docs/README.md");
    const topLevelEntries = await fs.readdir(path.join(ROOT, "docs"));
    const markdownEntries = topLevelEntries.filter((entry) =>
      entry.endsWith(".md"),
    );

    expect(markdownEntries).toEqual(["README.md"]);
    expect(docsGuide).toContain("canonical Antora component");
    expect(docsGuide).toContain("arc42 as its spine");
    expect(docsGuide).toContain("docs/modules/ROOT/pages/index.adoc");
  });

  test("governance documents notes-layer enrichment semantics", async () => {
    const notesSpec = await readText(
      "docs/modules/ROOT/pages/repository/docs/governance.adoc",
    );

    expect(notesSpec).toContain("[[notes-governance]]");
    expect(notesSpec).toContain("=== Notes Governance");
    expect(notesSpec).toContain("formal cognition contract");
    expect(notesSpec).toContain("=== Governance Model: How, What, Why");
    expect(notesSpec).toContain("4000");
    expect(notesSpec).toContain("100");
    expect(notesSpec).toContain("cx notes check");
    expect(notesSpec).toContain("ci:report:observability");
    expect(notesSpec).toContain("=== Linked-Note Enrichment Semantics");
    expect(notesSpec).toContain("inclusion-changing, not advisory");
    expect(notesSpec).toContain("Run `cx inspect --json`");
    expect(notesSpec).toContain("`cx notes graph --id <seed> --depth <n>`");
    expect(notesSpec).toContain("Depth semantics for graph inspection");
    expect(notesSpec).toContain("agent traceability");
    expect(notesSpec).toContain("contradiction pressure");
  });

  test("stop conditions explain the invariant they protect", async () => {
    const manual = await readText(
      "docs/modules/manual/pages/operator-manual.adoc",
    );
    const extractionSafety = await readText(
      "docs/modules/ROOT/pages/repository/docs/extraction_safety.adoc",
    );
    const agentModel = await readText(
      "docs/modules/ROOT/pages/repository/docs/agent_operating_model.adoc",
    );

    const manualNormalized = squashWhitespace(manual);

    expect(manualNormalized).toContain(
      "deterministic plan, token totals, overlap signals, and extractability",
    );
    expect(manualNormalized).toContain(
      "Dirty-state gating stops tracked-file drift",
    );
    expect(manualNormalized).toContain(
      "use `cx extract ... --allow-degraded` only for human inspection",
    );
    expect(extractionSafety).toContain(
      "Why this stops you: once the recovered packed content no longer matches",
    );
    expect(agentModel).toContain(
      "Why this stops you: an exploratory session should not silently cross from analysis into repository mutation.",
    );
  });

  test("workflow docs include temporal provenance and safe note mutation scenarios", async () => {
    const fridayToMonday = await readText(
      "docs/modules/manual/pages/workflows.adoc",
    );
    const safeNoteMutation = await readText(
      "docs/modules/manual/pages/workflows.adoc",
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
    expect(safeNoteMutation).toContain("notes_new(");
    expect(safeNoteMutation).toContain("cx notes check");
    expect(safeNoteMutation).toContain("bun run ci:notes:governance");
  });

  test("mental model and agent integration teach proof, hypothesis, and agent POV", async () => {
    const mentalModel = await readText(
      "docs/modules/architecture/pages/mental-model.adoc",
    );
    const agentIntegration = await readText(
      "docs/modules/ROOT/pages/repository/docs/agent_integration.adoc",
    );
    const agentModel = await readText(
      "docs/modules/ROOT/pages/repository/docs/agent_operating_model.adoc",
    );
    const architecture = await readText(
      "docs/modules/architecture/pages/implementation-reference.adoc",
    );

    expect(mentalModel).toContain("Track B = hypothesis generation");
    expect(mentalModel).toContain("Track A = proof generation");
    expect(mentalModel).toContain("durable cognition layer");
    expect(mentalModel).toContain("Source tree: trusted");
    expect(agentModel).toContain("== Operator Decision Ladder");
    expect(agentModel).toContain("== Capability Tiers");
    expect(agentIntegration).toContain("=== Agent Point Of View");
    expect(agentIntegration).toContain("doctor_mcp()");
    expect(agentIntegration).toContain('"tokenCount": 287');
    expect(agentIntegration).toContain('"outputStartLine": 41');
    const architectureNormalized = squashWhitespace(architecture);

    expect(architectureNormalized).toContain(
      "implementation reference for contributors",
    );
    expect(architectureNormalized).toContain(
      "Vitest as the authoritative shared-suite test runner and coverage lane",
    );
  });
});
