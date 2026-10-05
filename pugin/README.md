# Flowgate Compliance for Claude

Compliance workflows for private capital. Verify grants before they hit the
ledger, scan every issuer for regulatory flags, brief LPs in one prompt, and
screen portfolios for Shariah compliance.

> **Status:** Scaffold only. The commands reference MCP tools
> (`verify_grant_compliance`, `compliance_health_scan`, `prepare_lp_brief`,
> `shariah_screening_report`) that are in development. The plugin will not
> install or run until `@iflowgate/mcp-server@0.2.0` is published.

## What it does

Four workflows, built on the Flowgate governed execution layer:

| Command | What it does |
|---|---|
| `/flowgate:verify-grant` | Dry-run an option grant against the 409A gate |
| `/flowgate:health-scan` | Scan an issuer for every compliance flag |
| `/flowgate:lp-brief` | One LP's full compliance picture |
| `/flowgate:shariah-screen` | Shariah compliance report for an Islamic fund |

## Install

Requires Node 20+ and an active Flowgate API key.

1. Generate a key at https://flowgate2.onrender.com → API Keys
2. Set it as an environment variable:
   ```
   export FLOWGATE_API_KEY=fg_live_...
   ```
3. Install the plugin in Claude Code / Claude Desktop

## Architecture

This plugin bundles:

- **1 MCP server** — `@iflowgate/mcp-server`, exposing the Flowgate API as 11 tools
- **4 skills** — markdown instructions that teach Claude how to run each workflow
- **4 slash commands** — explicit entry points for each workflow
- **3 deterministic scripts** — Python for aggregation and formatting that should not go through the LLM
- **1 optional micro-app** — a compliance dashboard for the four workflows

The engine is closed. The client is open. Interfaces are inspectable; implementation is not.

## License

Apache 2.0. The engine itself is proprietary.
