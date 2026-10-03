import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakeClient = {
  issuers: {
    list: vi
      .fn()
      .mockResolvedValue(['Flowgate Systems Inc.', 'A27 Labs']),
  },
  investors: {
    list: vi.fn().mockResolvedValue([]),
    portfolio: vi.fn(),
  },
  capTable: { get: vi.fn() },
  capitalCalls: { list: vi.fn().mockResolvedValue([]) },
  compliance: { rules: vi.fn().mockResolvedValue([]) },
};

vi.mock('@flowgate/sdk', () => {
  class FlowgateError extends Error {
    readonly status: number;
    readonly detail: string;
    readonly endpoint: string;

    constructor(args: { status: number; detail: string; endpoint: string }) {
      super(`Flowgate API error ${args.status} at ${args.endpoint}: ${args.detail}`);
      this.name = 'FlowgateError';
      this.status = args.status;
      this.detail = args.detail;
      this.endpoint = args.endpoint;
    }
  }
  return {
    FlowgateError,
    Flowgate: class {
      issuers = fakeClient.issuers;
      investors = fakeClient.investors;
      capTable = fakeClient.capTable;
      capitalCalls = fakeClient.capitalCalls;
      compliance = fakeClient.compliance;
    },
  };
});

import { runCli } from '../src/index.js';

interface Captured {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs the CLI capturing the real process streams. Command actions write via
 * process.stdout/stderr directly (spinner output goes to stderr too), so
 * spying on the streams captures everything regardless of write path.
 */
async function invoke(argv: string[]): Promise<Captured> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  });
  const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  });
  try {
    const code = await runCli({ argv, stdout: () => undefined, stderr: () => undefined });
    return { code, stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') };
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
}

function firstJsonLine(text: string, marker: string): string {
  const line = text
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.includes(marker));
  if (line === undefined) {
    throw new Error(`no output line contained ${marker}: ${text}`);
  }
  return line;
}

describe('flowgate CLI', () => {
  const originalKey = process.env['FLOWGATE_API_KEY'];

  beforeEach(() => {
    process.env['FLOWGATE_API_KEY'] = 'test-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env['FLOWGATE_API_KEY'];
    } else {
      process.env['FLOWGATE_API_KEY'] = originalKey;
    }
  });

  it('exits 1 with a red message when FLOWGATE_API_KEY is missing', async () => {
    delete process.env['FLOWGATE_API_KEY'];
    const result = await invoke(['node', 'flowgate', 'issuers']);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FLOWGATE_API_KEY is not set');
  });

  it('issuers prints pretty JSON and exits 0', async () => {
    const result = await invoke(['node', 'flowgate', 'issuers']);

    expect(result.code).toBe(0);
    const jsonStart = result.stdout.indexOf('[');
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    expect(JSON.parse(result.stdout.slice(jsonStart))).toEqual(['Flowgate Systems Inc.', 'A27 Labs']);
  });

  it('issuers --json prints compact single-line JSON', async () => {
    const result = await invoke(['node', 'flowgate', 'issuers', '--json']);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('["Flowgate Systems Inc.","A27 Labs"]');
  });

  it('investors portfolio returns typed JSON for the requested id', async () => {
    fakeClient.investors.portfolio.mockResolvedValue({
      investor_id: 'inv-1',
      investor_name: 'Alice Angel',
      holdings: [],
    });

    const result = await invoke(['node', 'flowgate', 'investors', 'portfolio', 'inv-1', '--json']);

    expect(result.code).toBe(0);
    const line = firstJsonLine(result.stdout, 'inv-1');
    expect(JSON.parse(line)).toEqual({ investor_id: 'inv-1', investor_name: 'Alice Angel', holdings: [] });
    expect(fakeClient.investors.portfolio).toHaveBeenCalledWith('inv-1');
  });
});
