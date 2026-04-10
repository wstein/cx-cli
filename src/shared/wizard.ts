import { checkbox, confirm, input, select } from "@inquirer/prompts";
import kleur from "kleur";

/**
 * Wizard utility for creating interactive CLI experiences
 */

export interface WizardMessage {
  message: string;
  description?: string;
  default?: string | boolean;
}

/**
 * Ask a text input question with optional description
 */
export async function wizardInput(
  message: string,
  options: { default?: string; description?: string } = {},
): Promise<string> {
  if (options.description) {
    console.log(`${kleur.gray(options.description)}`);
  }
  const result = await input({
    message: kleur.cyan(`? ${message}`),
    default: options.default ?? "",
  });
  return result;
}

/**
 * Ask a selection question
 */
export async function wizardSelect<T>(
  message: string,
  choices: Array<{ name: string; value: T }>,
  options: { default?: T; description?: string } = {},
): Promise<T> {
  if (options.description) {
    console.log(`${kleur.gray(options.description)}`);
  }
  return select<T>({
    message: kleur.cyan(`? ${message}`),
    choices: choices.map((c) => ({
      name: c.name,
      value: c.value,
    })),
  });
}

/**
 * Ask a yes/no confirmation question
 */
export async function wizardConfirm(
  message: string,
  options: { default?: boolean; description?: string } = {},
): Promise<boolean> {
  if (options.description) {
    console.log(`${kleur.gray(options.description)}`);
  }
  return confirm({
    message: kleur.cyan(`? ${message}`),
    default: options.default ?? true,
  });
}

/**
 * Ask for multiple selections (checkbox)
 */
export async function wizardCheckbox<T>(
  message: string,
  choices: Array<{ name: string; value: T }>,
  options: { default?: T[]; description?: string } = {},
): Promise<T[]> {
  if (options.description) {
    console.log(`${kleur.gray(options.description)}`);
  }
  return checkbox<T>({
    message: kleur.cyan(`? ${message}`),
    choices: choices.map((c) => ({
      name: c.name,
      value: c.value,
    })),
  });
}

/**
 * Print wizard section title
 */
export function printWizardHeader(title: string): void {
  console.log(`\n${kleur.bold().cyan("=".repeat(50))}`);
  console.log(kleur.bold().cyan(`  ${title}`));
  console.log(`${kleur.bold().cyan("=".repeat(50))}\n`);
}

/**
 * Print wizard step counter
 */
export function printWizardStep(
  current: number,
  total: number,
  title: string,
): void {
  console.log(
    `${kleur.cyan(`[${current}/${total}]`)} ${kleur.bold().white(title)}`,
  );
}

/**
 * Print wizard tip/hint
 */
export function printWizardTip(tip: string): void {
  console.log(`${kleur.gray(`  💡 ${tip}`)}\n`);
}

/**
 * Print wizard completion
 */
export function printWizardComplete(title: string): void {
  console.log(`\n${kleur.green(`✓ ${title} complete`)}\n`);
}
