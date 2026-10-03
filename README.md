# Flowgate SDK

Typed clients for the Flowgate governed execution layer — a TypeScript SDK, a
command-line interface, and an MCP server for programmatic, shell, and
LLM-driven access to the Flowgate API.

This is a pnpm monorepo containing three packages:

| Package | Description |
| --- | --- |
| [`@flowgate/sdk`](packages/sdk) | Type-safe client generated from the OpenAPI spec |
| [`@flowgate/cli`](packages/cli) | The `flowgate` command-line interface |
| [`@flowgate/mcp-server`](packages/mcp-server) | Model Context Protocol server (stdio) |

## API access

Flowgate API access is provisioned per integrator. The demo deployment shown in
this README requires an API key that is not publicly distributed. To request
access for evaluation, contact reda.halloub@gmail.com.

## Installation

```bash
npm install @flowgate/sdk @flowgate/cli
```

> **Note:** these packages are not yet published to npm. They are currently
> available via the workspace / private registry. Publishing is a separate
> milestone. Until then, clone this repository and link the packages locally.

## SDK quickstart

```ts
import { Flowgate } from '@flowgate/sdk';

const fg = new Flowgate({ apiKey: process.env.FLOWGATE_API_KEY });

const issuers = await fg.issuers.list();
const capTable = await fg.capTable.get('Flowgate Systems Inc.');
console.log(capTable.total_fully_diluted_shares);
```

Every request and response type is generated from the committed OpenAPI spec
(`openapi.json`), so parameters, bodies, and results are checked at compile
time.

### Error handling

Non-2xx responses throw a `FlowgateError` carrying the HTTP `status`, the
parsed `detail` from the API, and the `endpoint` that was called.

```ts
import { Flowgate, FlowgateError } from '@flowgate/sdk';

try {
  await fg.capTable.get('Unknown Issuer');
} catch (error) {
  if (error instanceof FlowgateError) {
    console.error(error.status, error.detail, error.endpoint);
  }
}
```

## CLI quickstart

The CLI reads your API key from the `FLOWGATE_API_KEY` environment variable.
Substitute your own key for `<your-api-key>`:

```bash
export FLOWGATE_API_KEY=<your-api-key>

flowgate issuers
flowgate cap-table get "Flowgate Systems Inc."
flowgate compliance rules
```

Add `--json` to any command for compact single-line JSON on stdout with the
progress spinner disabled — useful for piping into `jq` or other scripts:

```bash
flowgate issuers --json
```

## SDK surface

| Group | Methods |
| --- | --- |
| `capTable` | `get`, `proposals`, `approveProposal`, `rejectProposal` |
| `capTableEvents` | `create` |
| `investors` | `list`, `portfolio` |
| `capitalCalls` | `list`, `overdue`, `payments` |
| `compliance` | `rules`, `getRule`, `createRule` |
| `issuers` | `list` |

> **Note:** `approveProposal(id, { reviewer })` and `rejectProposal(id, { reviewer })`
> accept a `reviewer` string and send it as the `?reviewer=` query parameter,
> matching the API specification — these endpoints take no request body.

## MCP server

`@flowgate/mcp-server` exposes Flowgate as read-only tools over stdio, so an
LLM client can query the API directly.

> **Note:** `@flowgate/mcp-server` is not yet published to npm. Until it is,
> run it from a local build (`node packages/mcp-server/dist/index.js`) instead
> of via npx.

Add it to your MCP client configuration:

```json
{
  "mcpServers": {
    "flowgate": {
      "command": "npx",
      "args": ["-y", "@flowgate/mcp-server"],
      "env": { "FLOWGATE_API_KEY": "<your-api-key>" }
    }
  }
}
```

Available tools:

| Tool | Description |
| --- | --- |
| `get_cap_table` | Get the cap table for an issuer |
| `list_investors` | List all investors |
| `get_investor_portfolio` | Get the portfolio for an investor |
| `list_capital_calls` | List all capital calls |
| `list_compliance_rules` | List all compliance rules |
| `list_issuers` | List all issuers |

The server requires `FLOWGATE_API_KEY` and exits with a stderr message if it is
not set.

## API reference

Full API documentation is available at
<https://flowgate2.onrender.com/redoc>.

## Development

Requires Node 20+ and pnpm.

```bash
pnpm install       # install workspace dependencies
pnpm -r regen       # regenerate packages/sdk/src/schema.d.ts from openapi.json
pnpm -r typecheck   # type-check every package
pnpm -r test        # run the test suites
pnpm -r build       # build every package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).

