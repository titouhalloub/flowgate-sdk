/**
 * Shared CLI helpers: environment handling, spinner-wrapped execution,
 * pretty/compact JSON output, and red error rendering.
 */
import chalk from 'chalk';
import ora from 'ora';
import { Flowgate, FlowgateError } from '@iflowgate/sdk';

/** Exit code used when FLOWGATE_API_KEY is missing. */
export const MISSING_KEY_EXIT = 1;

/** Error with a message already rendered for the terminal. */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export interface CommandContext {
  client: Flowgate;
  json: boolean;
}

/**
 * Asserts FLOWGATE_API_KEY is present and builds the SDK client with it.
 * Throws {@link CliError} (red message) when the variable is missing.
 */
export function requireClient(json: boolean): CommandContext {
  const apiKey = process.env.FLOWGATE_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    throw new CliError(chalk.red('FLOWGATE_API_KEY is not set. Export it before running this command.'));
  }
  return { client: new Flowgate({ apiKey }), json };
}

/** Runs `task`, showing a spinner unless `--json` output was requested. */
export async function withSpinner<T>(json: boolean, text: string, task: () => Promise<T>): Promise<T> {
  if (json) {
    return task();
  }
  const spinner = ora(text).start();
  try {
    const result = await task();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/** Prints a value as pretty JSON (spinner mode) or compact JSON (pipe mode). */
export function printResult(json: boolean, value: unknown): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(value)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/** Prints an error in red and returns the exit code to use. */
export function handleError(error: unknown, json: boolean): number {
  let message: string;
  if (error instanceof FlowgateError) {
    const hint = error.status === 401 ? ' (check FLOWGATE_API_KEY)' : '';
    message = `${error.endpoint} -> ${error.status}: ${error.detail}${hint}`;
  } else if (error instanceof CliError) {
    message = error.message;
  } else {
    message = error instanceof Error ? error.message : String(error);
  }
  if (json) {
    process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  } else {
    process.stderr.write(`${chalk.red(message)}\n`);
  }
  return error instanceof CliError ? error.exitCode : 1;
}
