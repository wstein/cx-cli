import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  printWizardComplete,
  printWizardHeader,
  printWizardStep,
  printWizardTip,
} from "../../src/shared/wizard.js";

describe("shared wizard utilities", () => {
  const originalLog = console.log;
  let output: string[] = [];

  beforeEach(() => {
    output = [];
    console.log = (message?: any) => {
      output.push(String(message ?? ""));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  test("printWizardHeader renders a title block", () => {
    printWizardHeader("Welcome");
    expect(output.length).toBe(3);
    expect(output[1]).toContain("Welcome");
    expect(output[0]).toContain("=");
    expect(output[2]).toContain("=");
  });

  test("printWizardStep displays the current step and title", () => {
    printWizardStep(2, 5, "Configure");
    expect(output.length).toBe(1);
    expect(output[0]).toContain("[2/5]");
    expect(output[0]).toContain("Configure");
  });

  test("printWizardTip displays a tip line", () => {
    printWizardTip("Choose wisely");
    expect(output.length).toBe(1);
    expect(output[0]).toContain("💡");
    expect(output[0]).toContain("Choose wisely");
  });

  test("printWizardComplete displays completion status", () => {
    printWizardComplete("Setup");
    expect(output.length).toBe(1);
    expect(output[0]).toContain("✓ Setup complete");
  });
});
