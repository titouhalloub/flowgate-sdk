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
  capTable: { get: (issuerName: string) => Promise<unknown> };
  investors: { list: () => Promise<unknown>; portfolio: (id: string) => Promise<unknown> };
  capitalCalls: { list: () => Promise<unknown> };
  compliance: { rules: () => Promise<unknown> };
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
    name: 'get_cap_table',
    description: 'Get the cap table for an issuer.',
    schema: { issuer_name: z.string().describe('Issuer name, e.g. "Flowgate Systems Inc."') },
    run: async (client, args) => toToolResult(await client.capTable.get(String(args['issuer_name']))),
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
