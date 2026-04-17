import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

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
    console.log = (message?: unknown) => {
      output.push(String(message ?? ""));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  afterEach(() => {
    mock.restore();
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

  test("wizardInput forwards defaults and descriptions to the prompt", async () => {
    const inputMock = mock(async () => "typed answer");

    mock.module("@inquirer/prompts", () => ({
      input: inputMock,
      select: mock(async () => "unused"),
      confirm: mock(async () => true),
      checkbox: mock(async () => []),
    }));

    const wizard = await import("../../src/shared/wizard.js");
    const result = await wizard.wizardInput("Your name", {
      default: "fallback",
      description: "Enter the name to use",
    });

    expect(result).toBe("typed answer");
    expect(inputMock).toHaveBeenCalledTimes(1);
    expect(inputMock.mock.calls[0]?.[0]).toMatchObject({
      default: "fallback",
    });
    expect(String(inputMock.mock.calls[0]?.[0]?.message)).toContain(
      "? Your name",
    );
    expect(output[0]).toContain("Enter the name to use");
  });

  test("wizardSelect maps choices before prompting", async () => {
    const selectMock = mock(async () => "two");

    mock.module("@inquirer/prompts", () => ({
      input: mock(async () => "unused"),
      select: selectMock,
      confirm: mock(async () => true),
      checkbox: mock(async () => []),
    }));

    const wizard = await import("../../src/shared/wizard.js");
    const result = await wizard.wizardSelect(
      "Choose one",
      [
        { name: "One", value: "one" },
        { name: "Two", value: "two" },
      ],
      { description: "Pick a value" },
    );

    expect(result).toBe("two");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(selectMock.mock.calls[0]?.[0]?.choices).toEqual([
      { name: "One", value: "one" },
      { name: "Two", value: "two" },
    ]);
    expect(output[0]).toContain("Pick a value");
  });

  test("wizardConfirm respects default values", async () => {
    const confirmMock = mock(async () => false);

    mock.module("@inquirer/prompts", () => ({
      input: mock(async () => "unused"),
      select: mock(async () => "unused"),
      confirm: confirmMock,
      checkbox: mock(async () => []),
    }));

    const wizard = await import("../../src/shared/wizard.js");
    const result = await wizard.wizardConfirm("Proceed?", {
      default: false,
      description: "Confirm the action",
    });

    expect(result).toBe(false);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock.mock.calls[0]?.[0]).toMatchObject({ default: false });
    expect(String(confirmMock.mock.calls[0]?.[0]?.message)).toContain(
      "? Proceed?",
    );
    expect(output[0]).toContain("Confirm the action");
  });

  test("wizardCheckbox maps choices and returns selected values", async () => {
    const checkboxMock = mock(async () => ["alpha", "beta"]);

    mock.module("@inquirer/prompts", () => ({
      input: mock(async () => "unused"),
      select: mock(async () => "unused"),
      confirm: mock(async () => true),
      checkbox: checkboxMock,
    }));

    const wizard = await import("../../src/shared/wizard.js");
    const result = await wizard.wizardCheckbox(
      "Choose items",
      [
        { name: "Alpha", value: "alpha" },
        { name: "Beta", value: "beta" },
      ],
      { description: "Pick all that apply" },
    );

    expect(result).toEqual(["alpha", "beta"]);
    expect(checkboxMock).toHaveBeenCalledTimes(1);
    expect(checkboxMock.mock.calls[0]?.[0]?.choices).toEqual([
      { name: "Alpha", value: "alpha" },
      { name: "Beta", value: "beta" },
    ]);
    expect(output[0]).toContain("Pick all that apply");
  });
});
