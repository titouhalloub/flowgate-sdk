/**
 * Flowgate SDK — typed TypeScript client for the Flowgate API.
 *
 * Only endpoints present in the committed OpenAPI spec (openapi.json) are
 * exposed. Request/response shapes come from src/schema.d.ts, regenerated
 * with `pnpm regen` (openapi-typescript).
 */
import createClient from 'openapi-fetch';
import type { paths } from './schema.js';

export type * from './schema.js';

/** Default base URL of the public Flowgate API. */
export const DEFAULT_BASE_URL = 'https://flowgate2.onrender.com';

/** Options accepted by the {@link Flowgate} constructor. */
export interface FlowgateOptions {
  /** Sent as the `X-API-Key` header. */
  apiKey?: string;
  /** Sent as the `Authorization: Bearer <jwt>` header. */
  jwt?: string;
  /** Override the API base URL (useful for local development). */
  baseUrl?: string;
}

/**
 * Error thrown for any non-2xx response from the Flowgate API.
 *
 * `status` is the HTTP status code, `detail` is the parsed error body
 * (non-JSON bodies are stringified), and `endpoint` is the request path.
 */
export class FlowgateError extends Error {
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

/** Path of each endpoint used by this client (mirrors openapi.json). */
/** Defaults applied by ``capTable.history`` when the caller omits them. */
export const DEFAULT_HISTORY_MONTHS = 6;
export const DEFAULT_HISTORY_INTERVAL = 'monthly' as const;

const ENDPOINTS = {
  capTable: '/cap-table/{issuer_name}',
  capTableHistory: '/cap-table/{issuer_name}/history',
  proposals: '/cap-table-proposals',
  approveProposal: '/cap-table-proposals/{proposal_id}/approve',
  rejectProposal: '/cap-table-proposals/{proposal_id}/reject',
  capTableEvents: '/cap-table-events',
  investors: '/investors',
  investorPortfolio: '/investors/{investor_id}/portfolio',
  capitalCalls: '/capital-calls',
  capitalCallsOverdue: '/capital-calls/overdue',
  capitalCallPayments: '/capital-calls/{call_id}/payments',
  complianceRules: '/compliance/rules',
  complianceRule: '/compliance/rules/{package_name}/{rule_name}',
  issuers: '/issuers',
} as const;


/** Query params accepted by `GET /cap-table-proposals`. */
export interface ListProposalsQuery {
  status?: string;
}

/** Options for ``capTable.history``. */
export interface CapTableHistoryOptions {
  months?: number;
  interval?: 'monthly' | 'weekly';
}

/**
 * POST /cap-table-proposals/{proposal_id}/approve and /reject require a
 * `reviewer` query parameter (the spec defines no request body for either).
 */
export interface ProposalReviewOptions {
  reviewer: string;
}

/**
 * Minimal structural view of the openapi-fetch client used internally.
 * Declared locally so the SDK does not depend on openapi-fetch internals
 * (and so no `any` is needed anywhere in this file).
 */
interface ApiResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

interface ClientLike {
  GET: (...args: unknown[]) => Promise<ApiResult>;
  POST: (...args: unknown[]) => Promise<ApiResult>;
}

/** Fallback used when the runtime lacks global fetch (Node <18). */
function fallbackFetch(): Promise<Response> {
  return Promise.resolve(
    new Response('{"detail":"fetch is not available in this runtime"}', {
      status: 500,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

/** Creates the typed openapi-fetch client with auth headers applied. */
function createApiClient(baseUrl: string, headers: Record<string, string>): ClientLike {
  // openapi-fetch reads globalThis.fetch lazily; capture it now so tests that
  // stub globalThis.fetch keep working regardless of when the client is used.
  const fetchImpl: typeof fetch | undefined = globalThis.fetch;
  const client = createClient<paths>({
    baseUrl,
    headers,
    fetch: fetchImpl ?? fallbackFetch,
  });
  return client as unknown as ClientLike;
}

/**
 * Extracts the `detail` field from the parsed error body. openapi-fetch
 * consumes the response body to populate `error`, so this must never read
 * the response again (it would throw "Body has already been read").
 */
function detailFromError(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'detail' in error) {
    const detail: unknown = (error as { detail: unknown }).detail;
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  }
  if (typeof error === 'string') {
    return error;
  }
  return JSON.stringify(error);
}


/**
 * Client for the Flowgate public API.
 *
 * ```ts
 * const flowgate = new Flowgate({ apiKey: process.env.FLOWGATE_API_KEY });
 * const issuers = await flowgate.issuers.list();
 * ```
 */
export class Flowgate {
  /** Raw openapi-fetch client, typed with the generated `paths`. */
  readonly raw: ClientLike;

  /** Cap-table reads and proposal review. */
  readonly capTable: {
    get: (issuerName: string) => Promise<paths['/cap-table/{issuer_name}']['get']['responses']['200']['content']['application/json']>;
    history: (issuerName: string, opts?: CapTableHistoryOptions) => Promise<paths['/cap-table/{issuer_name}/history']['get']['responses']['200']['content']['application/json']>;
    proposals: (query?: ListProposalsQuery) => Promise<paths['/cap-table-proposals']['get']['responses']['200']['content']['application/json']>;
    approveProposal: (id: string, opts: ProposalReviewOptions) => Promise<paths['/cap-table-proposals/{proposal_id}/approve']['post']['responses']['200']['content']['application/json']>;
    rejectProposal: (id: string, opts: ProposalReviewOptions) => Promise<paths['/cap-table-proposals/{proposal_id}/reject']['post']['responses']['200']['content']['application/json']>;
  };

  /** Cap-table event writes (issuance, transfer, ...). */
  readonly capTableEvents: {
    create: (body: paths['/cap-table-events']['post']['requestBody']['content']['application/json']) => Promise<paths['/cap-table-events']['post']['responses']['201']['content']['application/json']>;
  };

  /** Investor reads. */
  readonly investors: {
    list: () => Promise<paths['/investors']['get']['responses']['200']['content']['application/json']>;
    portfolio: (id: string) => Promise<paths['/investors/{investor_id}/portfolio']['get']['responses']['200']['content']['application/json']>;
  };

  /** Capital-call reads. */
  readonly capitalCalls: {
    list: () => Promise<paths['/capital-calls']['get']['responses']['200']['content']['application/json']>;
    overdue: () => Promise<paths['/capital-calls/overdue']['get']['responses']['200']['content']['application/json']>;
    payments: (id: string) => Promise<paths['/capital-calls/{call_id}/payments']['get']['responses']['200']['content']['application/json']>;
  };

  /** Compliance rule reads and writes. */
  readonly compliance: {
    rules: () => Promise<paths['/compliance/rules']['get']['responses']['200']['content']['application/json']>;
    getRule: (pkg: string, rule: string) => Promise<paths['/compliance/rules/{package_name}/{rule_name}']['get']['responses']['200']['content']['application/json']>;
    createRule: (body: paths['/compliance/rules']['post']['requestBody']['content']['application/json']) => Promise<paths['/compliance/rules']['post']['responses']['201']['content']['application/json']>;
  };

  /** Issuer reads. */
  readonly issuers: {
    list: () => Promise<paths['/issuers']['get']['responses']['200']['content']['application/json']>;
  };


  constructor(opts: FlowgateOptions = {}) {
    const headers: Record<string, string> = {};
    if (opts.apiKey !== undefined && opts.apiKey !== '') {
      headers['X-API-Key'] = opts.apiKey;
    }
    if (opts.jwt !== undefined && opts.jwt !== '') {
      headers['Authorization'] = `Bearer ${opts.jwt}`;
    }

    const client = createApiClient(opts.baseUrl ?? DEFAULT_BASE_URL, headers);
    this.raw = client;

    /** Runs a request, returning typed data on 2xx and throwing otherwise. */
    const wrap = async <T>(endpoint: string, call: Promise<ApiResult>): Promise<T> => {
      let result: ApiResult;
      try {
        result = await call;
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        throw new FlowgateError({ status: 0, detail, endpoint });
      }
      if (result.data !== undefined) {
        return result.data as T;
      }
      const status = result.response.status;
      const detail = detailFromError(result.error);
      throw new FlowgateError({ status, detail, endpoint });
    };

    this.capTable = {
      get: (issuerName) =>
        wrap(ENDPOINTS.capTable, client.GET(ENDPOINTS.capTable, { params: { path: { issuer_name: issuerName } } })),
      history: (issuerName, opts) =>
        wrap(
          ENDPOINTS.capTableHistory,
          client.GET(ENDPOINTS.capTableHistory, {
            params: {
              path: { issuer_name: issuerName },
              query: {
                months: opts?.months ?? DEFAULT_HISTORY_MONTHS,
                interval: opts?.interval ?? DEFAULT_HISTORY_INTERVAL,
              },
            },
          }),
        ),
      proposals: (query) =>
        wrap(ENDPOINTS.proposals, client.GET(ENDPOINTS.proposals, query !== undefined ? { params: { query } } : undefined)),
      approveProposal: (id, reviewOpts) =>
        wrap(
          ENDPOINTS.approveProposal,
          client.POST(ENDPOINTS.approveProposal, {
            params: { path: { proposal_id: id }, query: { reviewer: reviewOpts.reviewer } },
          }),
        ),
      rejectProposal: (id, reviewOpts) =>
        wrap(
          ENDPOINTS.rejectProposal,
          client.POST(ENDPOINTS.rejectProposal, {
            params: { path: { proposal_id: id }, query: { reviewer: reviewOpts.reviewer } },
          }),
        ),
    };

    this.capTableEvents = {
      create: (body) => wrap(ENDPOINTS.capTableEvents, client.POST(ENDPOINTS.capTableEvents, { body })),
    };

    this.investors = {
      list: () => wrap(ENDPOINTS.investors, client.GET(ENDPOINTS.investors)),
      portfolio: (id) =>
        wrap(ENDPOINTS.investorPortfolio, client.GET(ENDPOINTS.investorPortfolio, { params: { path: { investor_id: id } } })),
    };

    this.capitalCalls = {
      list: () => wrap(ENDPOINTS.capitalCalls, client.GET(ENDPOINTS.capitalCalls)),
      overdue: () => wrap(ENDPOINTS.capitalCallsOverdue, client.GET(ENDPOINTS.capitalCallsOverdue)),
      payments: (id) =>
        wrap(ENDPOINTS.capitalCallPayments, client.GET(ENDPOINTS.capitalCallPayments, { params: { path: { call_id: id } } })),
    };

    this.compliance = {
      rules: () => wrap(ENDPOINTS.complianceRules, client.GET(ENDPOINTS.complianceRules)),
      getRule: (pkg, rule) =>
        wrap(
          ENDPOINTS.complianceRule,
          client.GET(ENDPOINTS.complianceRule, { params: { path: { package_name: pkg, rule_name: rule } } }),
        ),
      createRule: (body) => wrap(ENDPOINTS.complianceRules, client.POST(ENDPOINTS.complianceRules, { body })),
    };

    this.issuers = {
      list: () => wrap(ENDPOINTS.issuers, client.GET(ENDPOINTS.issuers)),
    };
  }
}

export default Flowgate;
