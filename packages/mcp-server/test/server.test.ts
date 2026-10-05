import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockTransport {
  kind: string;
}

/** Captures every tool registration and the stdio connection call. */
const serverState: {
  tools: string[];
  connected: MockTransport | null;
} = { tools: [], connected: null };

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: class {
      registerTool = (name: string): void => {
        serverState.tools.push(name);
      };
      connect = async (transport: MockTransport): Promise<void> => {
        serverState.connected = transport;
      };
    },
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: class {
      kind = 'stdio';
    },
  };
});

import { handleTool, buildServer, main } from '../src/index.js';

function fakeClient(issuers: string[]) {
  return {
    issuers: { list: vi.fn().mockResolvedValue(issuers) },
    investors: {
      list: vi.fn().mockResolvedValue([]),
      portfolio: vi.fn().mockImplementation((id: string) => Promise.resolve({ investor_id: id, holdings: [] })),
    },
    capTable: { get: vi.fn().mockImplementation((name: string) => Promise.resolve({ issuer_name: name })) },
    capitalCalls: { list: vi.fn().mockResolvedValue([]) },
    compliance: { rules: vi.fn().mockResolvedValue([]) },
  };
}

describe('flowgate MCP server', () => {
  beforeEach(() => {
    serverState.tools = [];
    serverState.connected = null;
    vi.restoreAllMocks();
    delete process.env['FLOWGATE_API_KEY'];
  });

  afterEach(() => {
    delete process.env['FLOWGATE_API_KEY'];
  });

  it('main() exits 1 and writes to stderr when FLOWGATE_API_KEY is missing', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const code = await main();

    expect(code).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('FLOWGATE_API_KEY is not set'));
  });

  it('main() connects stdio when FLOWGATE_API_KEY is set', async () => {
    process.env['FLOWGATE_API_KEY'] = 'test-key';

    const code = await main();

    expect(code).toBe(0);
    expect(serverState.connected?.kind).toBe('stdio');
    expect(serverState.tools).toEqual([
      'get_cap_table',
      'get_cap_table_history',
      'list_investors',
      'get_investor_portfolio',
      'list_capital_calls',
      'list_compliance_rules',
      'list_issuers',
    ]);
  });

  it('handleTool returns pretty JSON for list_issuers', async () => {
    const client = fakeClient(['Flowgate Systems Inc.']);

    const result = await handleTool(client, 'list_issuers');

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.type).toBe('text');
    expect(JSON.parse(result.content[0]?.text ?? '')).toEqual(['Flowgate Systems Inc.']);
    expect(client.issuers.list).toHaveBeenCalledTimes(1);
  });

  it('buildServer registers all seven tools', () => {
    const server = buildServer(fakeClient([]));
    expect(server).toBeDefined();
    expect(serverState.tools).toHaveLength(7);
  });

  it('handleTool validates input and rejects wrong types without throwing', async () => {
    const client = fakeClient([]);

    const result = await handleTool(client, 'get_cap_table', { issuer_name: 42 });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/^Error: /);
    expect(client.capTable.get).not.toHaveBeenCalled();
  });

  it('handleTool reports API failures as isError without throwing', async () => {
    const client = fakeClient([]);
    client.issuers.list.mockRejectedValue(new Error('boom'));

    const result = await handleTool(client, 'list_issuers');

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('Error: boom');
  });

  it('handleTool reports unknown tools as isError without throwing', async () => {
    const result = await handleTool(fakeClient([]), 'not_a_tool', {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('unknown tool "not_a_tool"');
  });

  // Regression test for 0.1.0: main() resolved after connect(), and the entry
  // point's .then() called process.exit(0), killing the process before any
  // client could send a message. Spawns the real built binary and drives a
  // genuine MCP initialize handshake over stdio.
  it('spawned server responds to MCP initialize and stays alive', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const bin = path.resolve(here, '..', 'dist', 'index.js');

    const child = spawn(process.execPath, [bin], {
      env: { ...process.env, FLOWGATE_API_KEY: 'test-key' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    const init =
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }) + '\n';

    child.stdin.write(init);

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('No response within 15s — server likely exited')),
          15000,
        );
        const check = (): void => {
          if (stdout.includes('"id":1') || stdout.includes('"id": 1')) {
            clearTimeout(timer);
            resolve();
          }
        };
        child.stdout.on('data', check);
        child.on('exit', (code) => {
          if (!stdout.includes('"id"')) {
            clearTimeout(timer);
            reject(new Error(`Server exited (code ${code}) before responding`));
          }
        });
      });

      // Still running after answering — this is the actual 0.1.0 regression.
      expect(child.exitCode).toBeNull();
      expect(child.killed).toBe(false);
    } finally {
      child.kill();
    }
  });
});
