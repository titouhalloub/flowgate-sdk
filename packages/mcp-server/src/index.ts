#!/usr/bin/env node
/**
 * Flowgate MCP server — exposes read-only Flowgate API tools over stdio.
 *
 * Tools (mirroring openapi.json):
 *   get_cap_table, list_investors, get_investor_portfolio,
 *   list_capital_calls, list_compliance_rules, list_issuers
 *
 * Reads FLOWGATE_API_KEY at startup; exits 1 with a stderr message if missing.
 */
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Flowgate } from '@iflowgate/sdk';

/**
 * The subset of the SDK used by the MCP tools. Typed structurally so tests
 * can inject a fake without casting (production passes a real Flowgate).
 */
export interface FlowgateLike {
  capTable: {
    get: (issuerName: string) => Promise<unknown>;
    history: (issuerName: string, opts?: { months?: number; interval?: 'monthly' | 'weekly' }) => Promise<unknown>;
  };
  investors: { list: () => Promise<unknown>; portfolio: (id: string) => Promise<unknown> };
  capitalCalls: { list: () => Promise<unknown> };
  compliance: {
    rules: () => Promise<unknown>;
    dryRunGrant: (body: {
      issuer_name: string;
      holder_id: string;
      security_id: string;
      quantity: number;
      price_per_share: number;
      event_type: 'issuance' | 'exercise' | 'conversion';
      effective_date?: string;
    }) => Promise<unknown>;
  };
  issuers: { list: () => Promise<unknown> };
}

/** MCP tool result shape (content array plus optional isError flag). */
export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

function toToolResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toErrorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}


interface ToolSpec {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  run: (client: FlowgateLike, args: Record<string, unknown>) => Promise<ToolResult>;
}

const TOOLS: ToolSpec[] = [
  {
    name: 'verify_grant_compliance',
    description:
      'Dry-run an option or warrant grant against the 409A gate before ' +
      'recording it. Returns whether the grant would be accepted, the ' +
      'applicable fair market value, and -- if rejected -- the exact ' +
      'compliance reason. Use this before cap_table_events.create to ' +
      'avoid recording a non-compliant grant.',
    schema: {
      issuer_name: z.string().describe('Issuer name'),
      holder_id: z.string().describe('Investor receiving the grant'),
      security_id: z.string().describe('Security being granted'),
      quantity: z.number().positive().describe('Number of shares'),
      price_per_share: z.number().nonnegative().describe('Strike price per share'),
      event_type: z
        .enum(['issuance', 'exercise', 'conversion'])
        .describe('Type of event being proposed'),
      effective_date: z.string().optional().describe('Defaults to now'),
    },
    run: async (client, args) =>
      toToolResult(
        await client.compliance.dryRunGrant({
          issuer_name: String(args['issuer_name']),
          holder_id: String(args['holder_id']),
          security_id: String(args['security_id']),
          quantity: Number(args['quantity']),
          price_per_share: Number(args['price_per_share']),
          event_type: String(args['event_type']) as
            | 'issuance'
            | 'exercise'
            | 'conversion',
          ...(typeof args['effective_date'] === 'string'
            ? { effective_date: args['effective_date'] }
            : {}),
        }),
      ),
  },
  {
    name: 'get_cap_table',
    description: 'Get the cap table for an issuer.',
    schema: { issuer_name: z.string().describe('Issuer name, e.g. "Flowgate Systems Inc."') },
    run: async (client, args) => toToolResult(await client.capTable.get(String(args['issuer_name']))),
  },
  {
    name: 'get_cap_table_history',
    description:
      "Monthly or weekly snapshots of an issuer's cap table, showing how fully " +
      'diluted shares and top holders evolved over time. Useful for trends, ' +
      'investor reporting, and understanding the trajectory of a fund.',
    schema: {
      issuer_name: z.string().describe('Issuer name'),
      months: z.number().int().min(1).max(24).optional().describe('1-24, default 6'),
      interval: z.enum(['monthly', 'weekly']).optional().describe('default monthly'),
    },
    run: async (client, args) => {
      const opts: { months?: number; interval?: 'monthly' | 'weekly' } = {};
      if (typeof args['months'] === 'number') opts.months = args['months'];
      if (args['interval'] === 'weekly' || args['interval'] === 'monthly') {
        opts.interval = args['interval'];
      }
      return toToolResult(await client.capTable.history(String(args['issuer_name']), opts));
    },
  },
  {
    name: 'list_investors',
    description: 'List all investors.',
    schema: {},
    run: async (client) => toToolResult(await client.investors.list()),
  },
  {
    name: 'get_investor_portfolio',
    description: 'Get the portfolio for an investor.',
    schema: { investor_id: z.string().describe('Investor id') },
    run: async (client, args) => toToolResult(await client.investors.portfolio(String(args['investor_id']))),
  },
  {
    name: 'list_capital_calls',
    description: 'List all capital calls.',
    schema: {},
    run: async (client) => toToolResult(await client.capitalCalls.list()),
  },
  {
    name: 'list_compliance_rules',
    description: 'List all compliance rules.',
    schema: {},
    run: async (client) => toToolResult(await client.compliance.rules()),
  },
  {
    name: 'list_issuers',
    description: 'List all issuers.',
    schema: {},
    run: async (client) => toToolResult(await client.issuers.list()),
  },
];

/**
 * Executes a Flowgate tool by name. Never throws: unknown tools and API
 * failures return `{ isError: true }` results.
 */
export async function handleTool(client: FlowgateLike, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (tool === undefined) {
    return { content: [{ type: 'text', text: `Error: unknown tool "${name}"` }], isError: true };
  }
  try {
    const parsed = z.object(tool.schema).parse(args);
    return await tool.run(client, parsed);
  } catch (error) {
    return toErrorResult(error);
  }
}

/** Creates an McpServer with every Flowgate tool registered. */
export function buildServer(client: FlowgateLike): McpServer {
  const server = new McpServer({ name: 'flowgate', version: '0.1.0' });
  for (const tool of TOOLS) {
    // The SDK's ToolCallback generics are far stricter than the runtime
    // contract; our wrapper enforces the real contract (validate + never
    // throw), so the SDK-facing cast is intentional here.
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema } as never,
      (async (args: Record<string, unknown>) => handleTool(client, tool.name, args ?? {})) as never,
    );
  }
  return server;
}


/** Reads FLOWGATE_API_KEY, builds the client, connects stdio. 0 = success. */
export async function main(): Promise<number> {
  const apiKey = process.env.FLOWGATE_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    process.stderr.write('FLOWGATE_API_KEY is not set. Export it before starting the MCP server.\n');
    return 1;
  }
  const server = buildServer(new Flowgate({ apiKey }));
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // connect() resolves once the transport is wired up — it does NOT block.
  // Resuming stdin guarantees the event loop stays alive for the whole
  // session, so the process lingers until the client closes the connection.
  process.stdin.resume();
  return 0;
}

const entry = process.argv[1];
const isDirectRun = entry !== undefined && import.meta.url === pathToFileURL(entry).href;

if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) {
        process.exit(code);
      }
      // Success: do NOT exit. The StdioServerTransport keeps stdin open,
      // which keeps the Node event loop alive for the lifetime of the session.
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
