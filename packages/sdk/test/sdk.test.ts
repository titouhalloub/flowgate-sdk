import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BASE_URL, Flowgate, FlowgateError } from '../src/index.js';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface CapturedRequest {
  url: string;
  headers: Record<string, string>;
}

/** Extracts url/headers from the mock's last call (Request or url+init form). */
function lastFetchCall(): CapturedRequest {
  const mock = globalThis.fetch as unknown as FetchMock;
  const call = mock.mock.calls.at(-1);
  if (call === undefined) {
    throw new Error('fetch was not called');
  }
  const [input, init] = call as [unknown, RequestInit | undefined];
  if (input instanceof Request) {
    const headers: Record<string, string> = {};
    input.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { url: input.url, headers };
  }
  return { url: String(input), headers: (init?.headers ?? {}) as Record<string, string> };
}

describe('Flowgate SDK', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('constructor sets correct headers for apiKey', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    await flowgate.issuers.list();

    const { url, headers } = lastFetchCall();
    expect(url).toBe(`${DEFAULT_BASE_URL}/issuers`);
    // Headers arrive lowercased because openapi-fetch sends a Request object.
    expect(headers['x-api-key']).toBe('test-key-123');
    expect(headers['authorization']).toBeUndefined();
  });

  it('constructor sets correct headers for jwt', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    const flowgate = new Flowgate({ jwt: 'jwt-token-abc' });
    await flowgate.issuers.list();

    const { headers } = lastFetchCall();
    expect(headers['authorization']).toBe('Bearer jwt-token-abc');
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('get() throws FlowgateError on 404', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: 'issuer not found' }));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });

    try {
      await flowgate.capTable.get('Missing Corp');
      expect.unreachable('expected FlowgateError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(FlowgateError);
      const flowgateError = error as FlowgateError;
      expect(flowgateError.status).toBe(404);
      expect(flowgateError.detail).toBe('issuer not found');
      expect(flowgateError.endpoint).toBe('/cap-table/{issuer_name}');
    }
  });

  it('get() returns typed data on 200', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    const portfolio = {
      investor_id: 'inv-1',
      investor_name: 'Alice Angel',
      holdings: [],
    };
    fetchMock.mockResolvedValue(jsonResponse(200, portfolio));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    const data = await flowgate.investors.portfolio('inv-1');

    expect(data).toEqual(portfolio);
    const { url } = lastFetchCall();
    expect(url).toBe(`${DEFAULT_BASE_URL}/investors/inv-1/portfolio`);
  });

  it('capTable.history sends months and interval in the query string', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    fetchMock.mockResolvedValue(jsonResponse(200, { issuer_name: 'Acme', snapshots: [] }));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    await flowgate.capTable.history('Acme', { months: 3, interval: 'weekly' });

    const { url } = lastFetchCall();
    expect(url).toContain('/cap-table/Acme/history');
    expect(url).toContain('months=3');
    expect(url).toContain('interval=weekly');
  });

  it('capTable.history defaults to months=6 and interval=monthly', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    fetchMock.mockResolvedValue(jsonResponse(200, { issuer_name: 'Acme', snapshots: [] }));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    await flowgate.capTable.history('Acme');

    const { url } = lastFetchCall();
    expect(url).toContain('months=6');
    expect(url).toContain('interval=monthly');
  });

  it('capTable.history returns typed data on 200', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    const payload = {
      issuer_name: 'Acme',
      as_of: '2026-10-05T00:00:00Z',
      interval: 'monthly',
      snapshots: [
        {
          date: '2026-09-30',
          total_fully_diluted_shares: 1000,
          total_vested_shares: 1000,
          total_unvested_shares: 0,
          holder_count: 1,
          top_holders: [
            { holder_id: 'h1', holder_name: 'Ada', shares: 1000, ownership_percent: 100 },
          ],
          other_holders_total: 0,
        },
      ],
    };
    fetchMock.mockResolvedValue(jsonResponse(200, payload));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    const data = await flowgate.capTable.history('Acme', { months: 6 });

    expect(data).toEqual(payload);
    const { url } = lastFetchCall();
    expect(url).toBe(`${DEFAULT_BASE_URL}/cap-table/Acme/history?months=6&interval=monthly`);
  });

  it('dryRunGrant posts to the right URL with the right body', async () => {
    // openapi-fetch hands `fetch` a Request, so the method and body live on
    // the Request itself rather than in an init argument.
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    let captured: Request | undefined;
    fetchMock.mockImplementation((input: unknown) => {
      captured = input as Request;
      return Promise.resolve(jsonResponse(200, { compliant: true }));
    });

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    await flowgate.compliance.dryRunGrant({
      issuer_name: 'Acme',
      holder_id: 'h1',
      security_id: 's1',
      quantity: 100,
      price_per_share: 2.5,
      event_type: 'issuance',
    });

    expect(captured).toBeDefined();
    expect(captured?.url).toBe(`${DEFAULT_BASE_URL}/compliance/dry-run-grant`);
    expect(captured?.method.toUpperCase()).toBe('POST');
    const sent = JSON.parse(await captured!.clone().text()) as Record<string, unknown>;
    expect(sent).toEqual({
      issuer_name: 'Acme',
      holder_id: 'h1',
      security_id: 's1',
      quantity: 100,
      price_per_share: 2.5,
      event_type: 'issuance',
    });
  });

  it('dryRunGrant returns typed data on 200', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    const payload = {
      compliant: true,
      would_be_recorded: true,
      rejection_reason: null,
      rule_evaluations: [],
      current_fmv: 2.5,
      fmv_effective_date: '2026-08-01T00:00:00Z',
      fmv_stale: false,
      evaluated_at: '2026-10-05T00:00:00Z',
    };
    fetchMock.mockResolvedValue(jsonResponse(200, payload));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    const data = await flowgate.compliance.dryRunGrant({
      issuer_name: 'Acme', holder_id: 'h1', security_id: 's1',
      quantity: 100, price_per_share: 2.5, event_type: 'issuance',
    });

    expect(data).toEqual(payload);
    expect(data.compliant).toBe(true);
  });

  it('dryRunGrant surfaces a 200 with compliant=false as data, not an error', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    const payload = {
      compliant: false,
      would_be_recorded: false,
      rejection_reason: 'Strike price 1.0 is below the 409A fair market value of 2.5',
      rule_evaluations: [],
      current_fmv: 2.5,
      fmv_effective_date: '2026-08-01T00:00:00Z',
      fmv_stale: false,
      evaluated_at: '2026-10-05T00:00:00Z',
    };
    fetchMock.mockResolvedValue(jsonResponse(200, payload));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    // A non-compliant verdict is a successful 200 -- it must not throw.
    const data = await flowgate.compliance.dryRunGrant({
      issuer_name: 'Acme', holder_id: 'h1', security_id: 's1',
      quantity: 100, price_per_share: 1.0, event_type: 'issuance',
    });

    expect(data.compliant).toBe(false);
    expect(data.would_be_recorded).toBe(false);
    expect(data.rejection_reason).toContain('409A');
  });

  it('capTable.get sends no query param when asOf is omitted', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    fetchMock.mockResolvedValue(jsonResponse(200, { total_fully_diluted_shares: 1000000 }));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    await flowgate.capTable.get('Flowgate Systems Inc.');

    const { url } = lastFetchCall();
    expect(url).toBe(`${DEFAULT_BASE_URL}/cap-table/Flowgate%20Systems%20Inc.`);
    expect(url).not.toContain('as_of');
  });

  it('capTable.get sends as_of when asOf is supplied', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    fetchMock.mockResolvedValue(jsonResponse(200, { total_fully_diluted_shares: 650000 }));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    await flowgate.capTable.get('Flowgate Systems Inc.', { asOf: '2026-06-30T00:00:00Z' });

    const { url } = lastFetchCall();
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/cap-table/Flowgate%20Systems%20Inc.');
    expect(parsed.searchParams.get('as_of')).toBe('2026-06-30T00:00:00Z');
  });

  it('capTable.get accepts an empty options object without adding a query param', async () => {
    const fetchMock = globalThis.fetch as unknown as FetchMock;
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const flowgate = new Flowgate({ apiKey: 'test-key-123' });
    await flowgate.capTable.get('Acme', {});

    const { url } = lastFetchCall();
    expect(new URL(url).searchParams.has('as_of')).toBe(false);
  });
});
