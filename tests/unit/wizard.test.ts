// test-lane: unit

import * as prompts from "@inquirer/prompts";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  printWizardComplete,
  printWizardHeader,
  printWizardStep,
  printWizardTip,
} from "../../src/shared/wizard.js";
import { createBufferedCommandIo } from "../helpers/cli/createBufferedCommandIo.js";

describe("shared wizard utilities", () => {
  let output: string[] = [];
  let log: (...args: unknown[]) => void;

  beforeEach(() => {
    const capture = createBufferedCommandIo();
    output = [];
    log = (...args: unknown[]) => {
      output.push(args.map((value) => String(value ?? "")).join(" "));
      capture.io.log?.(...args);
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test("printWizardHeader renders a title block", () => {
    printWizardHeader("Welcome", { log });
    expect(output.length).toBe(3);
    expect(output[1]).toContain("Welcome");
    expect(output[0]).toContain("=");
    expect(output[2]).toContain("=");
  });

  test("printWizardStep displays the current step and title", () => {
    printWizardStep(2, 5, "Configure", { log });
    expect(output.length).toBe(1);
    expect(output[0]).toContain("[2/5]");
    expect(output[0]).toContain("Configure");
  });

  test("printWizardTip displays a tip line", () => {
    printWizardTip("Choose wisely", { log });
    expect(output.length).toBe(1);
    expect(output[0]).toContain("💡");
    expect(output[0]).toContain("Choose wisely");
  });

  test("printWizardComplete displays completion status", () => {
    printWizardComplete("Setup", { log });
    expect(output.length).toBe(1);
    expect(output[0]).toContain("✓ Setup complete");
  });

  test("wizardInput forwards defaults and descriptions to the prompt", async () => {
    const inputMock = vi.fn(
      async (_options: { message: string; default?: string }) => "typed answer",
    );
    vi.spyOn(prompts, "input").mockImplementation(inputMock);

    const result = await import("../../src/shared/wizard.js").then((wizard) =>
      wizard.wizardInput(
        "Your name",
        {
          default: "fallback",
          description: "Enter the name to use",
        },
        { log },
      ),
    );

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
    const selectMock = vi.fn(
      async (_options: { message: string; choices: readonly unknown[] }) =>
        "two",
    );
    vi.spyOn(prompts, "select").mockImplementation(selectMock);

    const result = await import("../../src/shared/wizard.js").then((wizard) =>
      wizard.wizardSelect(
        "Choose one",
        [
          { name: "One", value: "one" },
          { name: "Two", value: "two" },
        ],
        { description: "Pick a value" },
        { log },
      ),
    );

    expect(result).toBe("two");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(
      selectMock.mock.calls[0]?.[0]?.choices as ReadonlyArray<{
        name: string;
        value: string;
      }>,
    ).toEqual([
      { name: "One", value: "one" },
      { name: "Two", value: "two" },
    ]);
    expect(output[0]).toContain("Pick a value");
  });

  test("wizardConfirm respects default values", async () => {
    const confirmMock = vi.fn(
      async (_options: { message: string; default?: boolean }) => false,
    );
    vi.spyOn(prompts, "confirm").mockImplementation(confirmMock);

    const result = await import("../../src/shared/wizard.js").then((wizard) =>
      wizard.wizardConfirm(
        "Proceed?",
        {
          default: false,
          description: "Confirm the action",
        },
        { log },
      ),
    );

    expect(result).toBe(false);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock.mock.calls[0]?.[0]).toMatchObject({ default: false });
    expect(String(confirmMock.mock.calls[0]?.[0]?.message)).toContain(
      "? Proceed?",
    );
    expect(output[0]).toContain("Confirm the action");
  });

  test("wizardCheckbox maps choices and returns selected values", async () => {
    const checkboxMock = vi.fn(
      async (_options: { message: string; choices: readonly unknown[] }) => [
        "alpha",
        "beta",
      ],
    );
    vi.spyOn(prompts, "checkbox").mockImplementation(checkboxMock);

    const result = await import("../../src/shared/wizard.js").then((wizard) =>
      wizard.wizardCheckbox(
        "Choose items",
        [
          { name: "Alpha", value: "alpha" },
          { name: "Beta", value: "beta" },
        ],
        { description: "Pick all that apply" },
        { log },
      ),
    );

    expect(result).toEqual(["alpha", "beta"]);
    expect(checkboxMock).toHaveBeenCalledTimes(1);
    expect(
      checkboxMock.mock.calls[0]?.[0]?.choices as ReadonlyArray<{
        name: string;
        value: string;
      }>,
    ).toEqual([
      { name: "Alpha", value: "alpha" },
      { name: "Beta", value: "beta" },
    ]);
    expect(output[0]).toContain("Pick all that apply");
  });
});
