#!/usr/bin/env node
/**
 * flowgate — command-line interface for the Flowgate API.
 *
 * Every command reads FLOWGATE_API_KEY from the environment, shows an ora
 * spinner while awaiting (unless `--json` is passed), and prints the result
 * as JSON (2-space indent, or compact with `--json`).
 */
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { Flowgate } from '@iflowgate/sdk';
import chalk from 'chalk';
import { CliError, handleError, printResult, requireClient, withSpinner } from './output.js';

/** Runs an async command body, converting thrown errors into exit codes. */
async function runAction(json: boolean, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const exitCode = handleError(error, json);
    throw new CliError('', exitCode);
  }
}

/** Builds the SDK client for a command invocation, or throws CliError. */
function makeClient(json: boolean): { client: Flowgate; json: boolean } {
  return requireClient(json);
}

/** Wires the CLI command tree. Exported for tests. */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name('flowgate')
    .description('Flowgate CLI — query issuers, cap tables, investors, capital calls, and compliance rules.')
    .version('0.1.0');

  const jsonOption = (cmd: Command): Command => cmd.option('--json', 'output compact JSON (no spinner)');

  jsonOption(
    program
      .command('issuers')
      .description('List issuers')
      .action(async (options: { json?: boolean }) => {
        const json = options.json ?? false;
        await runAction(json, async () => {
          const { client } = makeClient(json);
          const data = await withSpinner(json, 'Fetching issuers', () => client.issuers.list());
          printResult(json, data);
        });
      }),
  );


  const capTable = program.command('cap-table').description('Cap table operations');
  jsonOption(capTable.command('get').description('Get the cap table for an issuer').argument('<issuer>', 'issuer name')).action(
    async (issuer: string, options: { json?: boolean }) => {
      const json = options.json ?? false;
      await runAction(json, async () => {
        const { client } = makeClient(json);
        const data = await withSpinner(json, `Fetching cap table for ${issuer}`, () => client.capTable.get(issuer));
        printResult(json, data);
      });
    },
  );
  jsonOption(
    capTable
      .command('history')
      .description('Monthly or weekly snapshots of the cap table')
      .argument('<issuer>', 'issuer name')
      .option('-m, --months <n>', 'Number of months (1-24)', '6')
      .option('-i, --interval <type>', 'monthly or weekly', 'monthly'),
  ).action(
    async (issuer: string, options: { json?: boolean; months: string; interval: string }) => {
      const json = options.json ?? false;
      await runAction(json, async () => {
        const months = Number.parseInt(options.months, 10);
        if (!Number.isFinite(months) || months < 1 || months > 24) {
          throw new CliError(chalk.red('--months must be an integer between 1 and 24.'));
        }
        const interval = options.interval === 'weekly' ? 'weekly' : 'monthly';
        const { client } = makeClient(json);
        const data = await withSpinner(json, `Fetching cap table history for ${issuer}`, () =>
          client.capTable.history(issuer, { months, interval }),
        );
        printResult(json, data);
      });
    },
  );
  jsonOption(capTable.command('proposals').description('List cap-table proposals').option('--status <status>', 'filter by proposal status')).action(
    async (options: { json?: boolean; status?: string }) => {
      const json = options.json ?? false;
      await runAction(json, async () => {
        const { client } = makeClient(json);
        const query = options.status !== undefined ? { status: options.status } : undefined;
        const data = await withSpinner(json, 'Fetching cap-table proposals', () => client.capTable.proposals(query));
        printResult(json, data);
      });
    },
  );
  jsonOption(
    capTable
      .command('approve')
      .description('Approve a cap-table proposal')
      .argument('<id>', 'proposal id')
      .requiredOption('--reviewer <reviewer>', 'reviewer identity (sent as ?reviewer=)'),
  ).action(async (id: string, options: { json?: boolean; reviewer: string }) => {
    const json = options.json ?? false;
    await runAction(json, async () => {
      const { client } = makeClient(json);
      const data = await withSpinner(json, `Approving proposal ${id}`, () =>
        client.capTable.approveProposal(id, { reviewer: options.reviewer }),
      );
      printResult(json, data);
    });
  });
  jsonOption(
    capTable
      .command('reject')
      .description('Reject a cap-table proposal')
      .argument('<id>', 'proposal id')
      .requiredOption('--reviewer <reviewer>', 'reviewer identity (sent as ?reviewer=)'),
  ).action(async (id: string, options: { json?: boolean; reviewer: string }) => {
    const json = options.json ?? false;
    await runAction(json, async () => {
      const { client } = makeClient(json);
      const data = await withSpinner(json, `Rejecting proposal ${id}`, () =>
        client.capTable.rejectProposal(id, { reviewer: options.reviewer }),
      );
      printResult(json, data);
    });
  });

  const investors = program.command('investors').description('Investor operations');
  jsonOption(investors.command('list').description('List investors')).action(async (options: { json?: boolean }) => {
    const json = options.json ?? false;
    await runAction(json, async () => {
      const { client } = makeClient(json);
      const data = await withSpinner(json, 'Fetching investors', () => client.investors.list());
      printResult(json, data);
    });
  });
  jsonOption(investors.command('portfolio').description('Get an investor portfolio').argument('<id>', 'investor id')).action(
    async (id: string, options: { json?: boolean }) => {
      const json = options.json ?? false;
      await runAction(json, async () => {
        const { client } = makeClient(json);
        const data = await withSpinner(json, `Fetching portfolio for investor ${id}`, () => client.investors.portfolio(id));
        printResult(json, data);
      });
    },
  );

  const capitalCalls = program.command('capital-calls').description('Capital call operations');
  jsonOption(capitalCalls.command('list').description('List capital calls')).action(async (options: { json?: boolean }) => {
    const json = options.json ?? false;
    await runAction(json, async () => {
      const { client } = makeClient(json);
      const data = await withSpinner(json, 'Fetching capital calls', () => client.capitalCalls.list());
      printResult(json, data);
    });
  });
  jsonOption(capitalCalls.command('overdue').description('List overdue capital calls')).action(async (options: { json?: boolean }) => {
    const json = options.json ?? false;
    await runAction(json, async () => {
      const { client } = makeClient(json);
      const data = await withSpinner(json, 'Fetching overdue capital calls', () => client.capitalCalls.overdue());
      printResult(json, data);
    });
  });
  jsonOption(capitalCalls.command('payments').description('List payments for a capital call').argument('<id>', 'capital call id')).action(
    async (id: string, options: { json?: boolean }) => {
      const json = options.json ?? false;
      await runAction(json, async () => {
        const { client } = makeClient(json);
        const data = await withSpinner(json, `Fetching payments for capital call ${id}`, () => client.capitalCalls.payments(id));
        printResult(json, data);
      });
    },
  );

  const compliance = program.command('compliance').description('Compliance operations');
  jsonOption(compliance.command('rules').description('List compliance rules')).action(async (options: { json?: boolean }) => {
    const json = options.json ?? false;
    await runAction(json, async () => {
      const { client } = makeClient(json);
      const data = await withSpinner(json, 'Fetching compliance rules', () => client.compliance.rules());
      printResult(json, data);
    });
  });
  jsonOption(compliance.command('check').description('Show all compliance rules for review').argument('<issuer>', 'issuer name')).action(
    async (issuer: string, options: { json?: boolean }) => {
      const json = options.json ?? false;
      await runAction(json, async () => {
        const { client } = makeClient(json);
        const data = await withSpinner(json, `Fetching compliance rules for ${issuer}`, () => client.compliance.rules());
        printResult(json, data);
      });
    },
  );

  return program;
}

export interface RunCliOptions {
  argv: string[];
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

/**
 * Runs the CLI with the given argv and returns the process exit code.
 * Used by the bin entry and by tests (no `process.exit` inside).
 */
export async function runCli(opts: RunCliOptions): Promise<number> {
  const program = buildProgram();
  program.exitOverride();
  program.configureOutput({
    writeOut: opts.stdout,
    writeErr: opts.stderr,
  });
  try {
    await program.parseAsync(opts.argv);
    return 0;
  } catch (error) {
    const candidate = error as { exitCode?: number; code?: string | number; message?: string };
    if (candidate.code === 'commander.helpDisplayed' || candidate.code === 'commander.help') {
      return 0;
    }
    if (candidate.code === 'commander.version') {
      return 0;
    }
    if (typeof candidate.exitCode === 'number') {
      return candidate.exitCode;
    }
    const message = candidate.message ?? 'unexpected error';
    opts.stderr(message);
    return 1;
  }
}

const entry = process.argv[1];
const isDirectRun = entry !== undefined && import.meta.url === pathToFileURL(entry).href;

if (isDirectRun) {
  runCli({
    argv: process.argv,
    stdout: (line) => process.stdout.write(line),
    stderr: (line) => process.stderr.write(line),
  })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
