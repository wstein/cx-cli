import * as prompts from "@inquirer/prompts";
import kleur from "kleur";

/**
 * Wizard utility for creating interactive CLI experiences
 */

interface WizardIo {
  log?: (...args: unknown[]) => void;
}

interface WizardPromptAdapter {
  input: typeof prompts.input;
  select: typeof prompts.select;
  confirm: typeof prompts.confirm;
  checkbox: typeof prompts.checkbox;
}

let wizardPromptAdapter: WizardPromptAdapter = {
  input: prompts.input,
  select: prompts.select,
  confirm: prompts.confirm,
  checkbox: prompts.checkbox,
};

function getWizardPromptAdapter(): WizardPromptAdapter {
  return wizardPromptAdapter;
}

export function setWizardPromptAdapter(
  adapter: Partial<WizardPromptAdapter>,
): void {
  wizardPromptAdapter = {
    ...wizardPromptAdapter,
    ...adapter,
  };
}

export function resetWizardPromptAdapter(): void {
  wizardPromptAdapter = {
    input: prompts.input,
    select: prompts.select,
    confirm: prompts.confirm,
    checkbox: prompts.checkbox,
  };
}

function getWizardLogger(io: WizardIo = {}): (...args: unknown[]) => void {
  return io.log ?? console.log;
}

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
  io: WizardIo = {},
): Promise<string> {
  if (options.description) {
    getWizardLogger(io)(`${kleur.gray(options.description)}`);
  }
  const result = await getWizardPromptAdapter().input({
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
  io: WizardIo = {},
): Promise<T> {
  if (options.description) {
    getWizardLogger(io)(`${kleur.gray(options.description)}`);
  }
  return getWizardPromptAdapter().select<T>({
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
  io: WizardIo = {},
): Promise<boolean> {
  if (options.description) {
    getWizardLogger(io)(`${kleur.gray(options.description)}`);
  }
  return getWizardPromptAdapter().confirm({
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
  io: WizardIo = {},
): Promise<T[]> {
  if (options.description) {
    getWizardLogger(io)(`${kleur.gray(options.description)}`);
  }
  return getWizardPromptAdapter().checkbox<T>({
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
export function printWizardHeader(title: string, io: WizardIo = {}): void {
  const log = getWizardLogger(io);
  log(`\n${kleur.bold().cyan("=".repeat(50))}`);
  log(kleur.bold().cyan(`  ${title}`));
  log(`${kleur.bold().cyan("=".repeat(50))}\n`);
}

/**
 * Print wizard step counter
 */
export function printWizardStep(
  current: number,
  total: number,
  title: string,
  io: WizardIo = {},
): void {
  getWizardLogger(io)(
    `${kleur.cyan(`[${current}/${total}]`)} ${kleur.bold().white(title)}`,
  );
}

/**
 * Print wizard tip/hint
 */
export function printWizardTip(tip: string, io: WizardIo = {}): void {
  getWizardLogger(io)(`${kleur.gray(`  💡 ${tip}`)}\n`);
}

/**
 * Print wizard completion
 */
export function printWizardComplete(title: string, io: WizardIo = {}): void {
  getWizardLogger(io)(`\n${kleur.green(`✓ ${title} complete`)}\n`);
}
