# Flowgate Compliance — Claude Plugin

Full plugin package. Copy each file to the path shown above it.

---

## `README.md`

```markdown
# Flowgate Compliance for Claude

Compliance workflows for private capital. Verify grants before they hit the
ledger, scan every issuer for regulatory flags, brief LPs in one prompt, and
screen portfolios for Shariah compliance.

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
```

---

## `.claude-plugin/plugin.json`

```json
{
  "name": "flowgate-compliance",
  "displayName": "Flowgate Compliance",
  "description": "Compliance workflows for private capital: verify grants, scan issuers, brief LPs, screen for Shariah compliance. Built on the Flowgate governed execution layer.",
  "version": "0.1.0",
  "author": {
    "name": "Flowgate",
    "url": "https://flowgate2.onrender.com"
  },
  "homepage": "https://flowgate2.onrender.com/redoc",
  "repository": "https://github.com/titouhalloub/flowgate-sdk",
  "license": "Apache-2.0",
  "keywords": [
    "private-capital",
    "compliance",
    "regtech",
    "islamic-finance",
    "cap-table",
    "409a"
  ],
  "mcpServers": ["./mcp-servers/flowgate.json"],
  "commands": [
    "./commands/verify-grant.md",
    "./commands/health-scan.md",
    "./commands/lp-brief.md",
    "./commands/shariah-screen.md"
  ],
  "skills": [
    "./skills/grant-verification",
    "./skills/compliance-scan",
    "./skills/lp-briefing",
    "./skills/shariah-screening"
  ]
}
```

---

## `mcp-servers/flowgate.json`

```json
{
  "flowgate": {
    "command": "npx",
    "args": ["-y", "@iflowgate/mcp-server@^0.2"],
    "env": {
      "FLOWGATE_API_KEY": "${FLOWGATE_API_KEY}"
    },
    "description": "Flowgate API — cap tables, investors, capital calls, compliance rules"
  }
}
```

**Note:** `@iflowgate/mcp-server@0.2` doesn't exist yet. It will after Phase 1–4 add the four new tools. Until then, this plugin is a spec — not installable.

---

## Commands

Slash commands are explicit. The user types `/flowgate:verify-grant` and Claude runs a specific workflow. No guessing.

---

### `commands/verify-grant.md`

```markdown
---
description: Verify an option grant against the 409A gate before recording it
---

# Verify Grant

The user wants to check whether an option or warrant grant would pass
compliance before it hits the ledger.

## Inputs

Parse from `$ARGUMENTS`:

- **issuer** — the company name (required)
- **holder** — the person receiving the grant (required)
- **quantity** — number of shares (required)
- **price** — strike price per share (required)
- **security_class** — common, option, or warrant (default: option)

If any required field is missing, ask for it before proceeding. Do not guess.

## Steps

1. Call the `verify_grant_compliance` MCP tool with the parsed inputs.
2. If the response says the grant would pass:
   - Report: "Compliant. This grant would be recorded."
   - Show the applicable rules that were evaluated.
3. If the response says the grant would be rejected:
   - Report the rejection prominently.
   - Show the exact rule name, effective window, and reason from the API.
   - Do NOT soften or rephrase the compliance detail.
4. Show the current FMV and its effective date from the response.

## Output format

Use this exact structure:

**Grant Verification — [Issuer]**

| Field | Value |
|---|---|
| Holder | ... |
| Security | ... |
| Quantity | ... |
| Strike | ... |

**Result:** COMPLIANT / REJECTED

If rejected:
> [the exact detail message from the API]

**Applicable rules:**
- [rule name] — effective [date] — severity [level]

**Next step:** [what the user should do — adjust the price, update the 409A, or proceed]

Do not proceed to record the grant. This command is read-only. If the user
wants to record it, tell them to use `cap_table_events.create` explicitly.
```

---

### `commands/health-scan.md`

```markdown
---
description: Scan an issuer for every compliance flag
---

# Compliance Health Scan

The user wants a full compliance picture of one issuer.

## Inputs

Parse from `$ARGUMENTS`:

- **issuer** — the company name (required)

If missing, ask. If the user says "all" or names multiple issuers, run the
scan for each and merge the results.

## Steps

1. Call `compliance_health_scan` with the issuer name.
2. Call `get_cap_table` for the same issuer to get current state.
3. Call `list_compliance_rules` to get every active rule.
4. Run `scripts/aggregate_findings.py` on the responses (see script args
   in the script's docstring).

The script produces a structured summary. Do not compute aggregations yourself.

## Output format

**Compliance Health — [Issuer]**

**Status:** CLEAR / REVIEW NEEDED / BLOCKED

**Summary:**
- X rules evaluated
- Y rules fired
- Z open items

**Findings:**

| Severity | Rule | Effective | Detail |
|---|---|---|---|
| ... | ... | ... | ... |

**Rules expiring soon:**
- [rule name] closes on [date]

**Recommendation:** [what the compliance officer should do]

Do not include raw JSON. Format for a compliance officer, not an engineer.
```

---

### `commands/lp-brief.md`

```markdown
---
description: One LP's full compliance picture across every fund
---

# LP Compliance Brief

The user is preparing for a meeting with an LP and needs the compliance
picture, not just the financial position.

## Inputs

Parse from `$ARGUMENTS`:

- **investor** — the LP's name (required)

## Steps

1. Call `list_investors` to find the investor ID matching the name.
2. Call `get_investor_portfolio` with that ID.
3. Call `prepare_lp_brief` with the same ID (see script note below).
4. Run `scripts/render_brief.py` on the responses.

## Output format

**LP Brief — [Investor Name]**

**Position:**
- Total across funds: $X
- Funds: N
- Tracks: Traditional / Islamic / Both

**Holdings:**

| Fund | Track | Stake | Ownership % | Status |
|---|---|---|---|---|

**Capital obligations:**
- Outstanding calls: N
- Total outstanding: $X
- Next due date: [date]

**Compliance flags:**
- [any rule that fired on this LP's holdings]

**Talking points:**
- [3 bullet points the partner can use in the meeting]

Keep it under one page. If the LP is fully compliant with nothing outstanding,
say so plainly — do not pad the brief.
```

---

### `commands/shariah-screen.md`

```markdown
---
description: Shariah compliance screening for an Islamic fund
---

# Shariah Screening Report

The user wants a Shariah compliance report for an Islamic fund or portfolio.

## Inputs

Parse from `$ARGUMENTS`:

- **issuer** — the fund or issuer name (required)

## Steps

1. Call `get_cap_table` for the issuer.
2. Call `list_compliance_rules` filtered to `package_name=islamic` (if the
   backend supports the filter; otherwise fetch all and filter locally).
3. Call `shariah_screening_report` with the issuer name.
4. Run `scripts/aggregate_findings.py` with `--mode=shariah`.

## Output format

**Shariah Compliance Report — [Issuer]**
**As of:** [date from the API response]

**Screen criteria:**
- Riba (interest) prohibition — [status]
- Gharar (uncertainty) — [status]
- Asset backing — [status]
- Speculative activity — [status]

**Holdings screened:** N
**Pass:** N
**Review needed:** N
**Fail:** N

**Findings:**

| Holding | Criterion | Status | Detail |
|---|---|---|---|

**Fatwa references:**
- [any rule that cites a fatwa or Shariah standard]

**Recommendation:** [what the Shariah officer should do next]

Do not invent fatwa references. If the rule doesn't cite one, say "no fatwa
reference on file."
```

---

## Skills

Skills are longer, context-aware instructions. Claude invokes them automatically based on the `description` in the frontmatter — the user doesn't have to type a slash command.

---

### `skills/grant-verification/SKILL.md`

```markdown
---
name: grant-verification
description: Use when the user mentions verifying, checking, or validating an option grant, warrant, or equity issuance against compliance rules or the 409A gate. Also use when the user asks whether a grant "would pass", "is compliant", or "will be rejected."
---

# Grant Verification

You help compliance officers and finance teams verify that an equity grant
would pass the Flowgate compliance engine before it is recorded to the
append-only ledger.

## Why this matters

Once an event is in the ledger, it cannot be deleted. Mistakes are corrected
with compensating events, but the original entry remains forever. Verifying
before recording avoids the compensating-event cycle.

## When to invoke

- User asks "would this pass?"
- User mentions 409A, FMV, strike price, or below-market grants
- User is about to record an issuance and asks about compliance
- User shares grant details and asks whether they're fine

## What to do

1. Extract: issuer, holder, quantity, price, security class.
   If any are missing, ask. Do not guess.
2. Call `verify_grant_compliance`.
3. Present the result using the format in `/flowgate:verify-grant`.
4. Never record the grant yourself. This skill is read-only.

## Rules to remember

- Option and warrant grants below FMV are **rejected** at the API boundary.
- Common stock below FMV is **allowed** — an issuance price and an exercise
  price are not the same thing.
- The rejection detail comes from the API. Show it verbatim. Do not paraphrase.
- If the user disagrees with the rejection, do not override it. Explain that
  the gate is enforced by the engine, not the interface, and that changing the
  outcome requires updating the 409A valuation.
```

---

### `skills/compliance-scan/SKILL.md`

```markdown
---
name: compliance-scan
description: Use when the user wants a compliance overview of an issuer, asks about regulatory flags, mentions "open items", "compliance health", "what's firing", or wants to review everything that needs attention across a fund.
---

# Compliance Health Scan

You produce a compliance officer's view of one issuer's regulatory state.

## What a good scan shows

A compliance officer needs three things in order:

1. **What requires action today** — blocking findings
2. **What requires review this week** — non-blocking findings with open items
3. **What's about to change** — rules with effective windows closing

Everything else is noise. Do not pad the report.

## Steps

1. Call `compliance_health_scan` for the issuer.
2. Call `get_cap_table` for current state.
3. Run `scripts/aggregate_findings.py` on the responses.
4. Present using the format in `/flowgate:health-scan`.

## Interpretation guidance

- **Blocking findings** are hard stops. The engine refused to record the
  event. These are the ones the user must resolve before anything else.
- **Review findings** are soft. They require a named human to look and decide.
  The system records the event, but flags it.
- **Info findings** are informational. Mention them once, do not dwell.

## Multi-issuer scans

If the user names multiple issuers or says "the whole portfolio," run the
scan per issuer and produce a summary table with one row per issuer, sorted
by severity. Detail sections come after the table.
```

---

### `skills/lp-briefing/SKILL.md`

```markdown
---
name: lp-briefing
description: Use when the user is preparing for an LP meeting, asks for an investor brief, wants to know an LP's current position or compliance status, or mentions preparing talking points for a limited partner conversation.
---

# LP Briefing

You prepare a partner for a meeting with a specific LP.

## The framing

The partner walks into the room needing three answers ready:

1. **Where does this LP stand?** — position, ownership, stake across funds
2. **What does the LP owe or is owed?** — capital calls, distributions
3. **Is there anything I need to be careful about?** — compliance flags

A brief that answers all three in one page is worth more than a ten-page
report that answers none of them.

## Steps

1. Find the investor ID via `list_investors`.
2. Call `get_investor_portfolio`.
3. Call `prepare_lp_brief` (once Phase 3 is live).
4. Run `scripts/render_brief.py`.

## What to include

- Position summary (one line)
- Holdings table (only if more than one fund)
- Outstanding obligations (only if any)
- Compliance flags (only if any)
- Three talking points

## What to leave out

- Historical performance (the CRM has it, this is compliance)
- Document lists
- Anything that requires the user to ask a follow-up question

If the LP is clean — no flags, nothing outstanding — say so in one line and
stop. Do not pad.
```

---

### `skills/shariah-screening/SKILL.md`

```markdown
---
name: shariah-screening
description: Use when the user mentions Shariah, Islamic finance, riba, gharar, sukuk, fatwa, or asks for a Shariah compliance review of a fund or portfolio.
---

# Shariah Screening

You produce a Shariah compliance report for an Islamic fund.

## What makes this different from a general compliance scan

Traditional compliance checks investor eligibility and AML. Shariah screening
checks the nature of the underlying assets and contracts. The criteria are
different, the regulators are different, and the audit trail needs to cite
Shariah standards, not just internal rules.

## The four criteria

1. **Riba** — interest-based earnings. Prohibited.
2. **Gharar** — excessive uncertainty in contract terms. Restricted.
3. **Asset backing** — the investment must be tied to real economic activity,
   not pure financial speculation.
4. **Speculative activity** — pure gambling (maysir) and excessive speculation.

## Steps

1. Call `shariah_screening_report` for the issuer.
2. Fetch the active Islamic compliance rules.
3. Run `scripts/aggregate_findings.py --mode=shariah`.
4. Present using the format in `/flowgate:shariah-screen`.

## Handling fatwa references

If a rule cites a fatwa or Shariah standard, include the reference verbatim.
If a rule does not cite one, say so — do not invent one. Shariah officers
will check.

## Language

Use the terminology the user's Shariah officer uses. If they say "screening,"
use "screening." If they say "purification," use "purification." Match the
register of the user's input.

## When to refuse

If the user asks you to override a Shariah finding, decline and explain that
Shariah rulings are made by the fund's Shariah board, not by the compliance
system. The system reports findings; it does not rule on them.
```

---

## Deterministic Scripts

These run locally. They do not go through the LLM. The reason: numbers and
aggregations must be exact, and the same input must produce the same output
every time. An LLM that "summarizes" a rule count is a liability in a
compliance context.

---

### `scripts/aggregate_findings.py`

```python
#!/usr/bin/env python3
"""
Aggregate compliance findings into a structured summary.

Usage:
  python aggregate_findings.py --mode=standard
  python aggregate_findings.py --mode=shariah

Input: reads a JSON blob from stdin containing:
  {
    "scan": { ... },        # output of compliance_health_scan
    "cap_table": { ... },   # output of get_cap_table
    "rules": [ ... ]        # output of list_compliance_rules
  }

Output: structured JSON summary with counts, groupings, and sorted findings.
"""
import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone

SEVERITY_ORDER = {"blocking": 0, "review": 1, "info": 2}


def parse_date(s):
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def days_until(date_str):
    d = parse_date(date_str)
    if not d:
        return None
    return (d - datetime.now(timezone.utc)).days


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["standard", "shariah"], default="standard")
    args = ap.parse_args()

    data = json.load(sys.stdin)
    findings = data.get("scan", {}).get("findings", [])
    rules = data.get("rules", [])

    # Count by severity
    severity_counts = Counter(f.get("severity", "info") for f in findings)
    total = sum(severity_counts.values())

    # Sort findings by severity
    sorted_findings = sorted(
        findings,
        key=lambda f: SEVERITY_ORDER.get(f.get("severity", "info"), 99),
    )

    # Find rules expiring within 30 days
    expiring = []
    for r in rules:
        end = r.get("effective_to")
        if not end:
            continue
        d = days_until(end)
        if d is not None and 0 <= d <= 30:
            expiring.append({
                "rule_name": r.get("rule_name"),
                "package": r.get("package_name"),
                "closes_on": end,
                "days_remaining": d,
            })
    expiring.sort(key=lambda x: x["days_remaining"])

    # Determine overall status
    if severity_counts.get("blocking", 0) > 0:
        status = "BLOCKED"
    elif severity_counts.get("review", 0) > 0:
        status = "REVIEW NEEDED"
    else:
        status = "CLEAR"

    # Mode-specific output
    if args.mode == "shariah":
        by_criterion = {}
        for f in findings:
            c = f.get("criterion") or f.get("rule_name", "unknown")
            by_criterion.setdefault(c, []).append(f)
        output = {
            "status": status,
            "total_findings": total,
            "severity_counts": dict(severity_counts),
            "criteria": {
                k: len(v) for k, v in by_criterion.items()
            },
            "expiring_rules": expiring,
            "sorted_findings": sorted_findings,
        }
    else:
        output = {
            "status": status,
            "total_rules_evaluated": len(rules),
            "total_findings": total,
            "severity_counts": dict(severity_counts),
            "expiring_rules": expiring,
            "sorted_findings": sorted_findings,
        }

    print(json.dumps(output, indent=2, default=str))


if __name__ == "__main__":
    main()
```

---

### `scripts/render_brief.py`

```python
#!/usr/bin/env python3
"""
Render an LP brief from portfolio + compliance data.

Usage:
  python render_brief.py < portfolio.json > brief.md

Reads a JSON blob from stdin:
  {
    "investor": { "id": "...", "name": "..." },
    "portfolio": { ... },
    "compliance": { ... }
  }

Writes Markdown to stdout.
"""
import json
import sys


def fmt_money(v):
    if v is None:
        return "—"
    return f"${v:,.0f}"


def fmt_pct(v):
    if v is None:
        return "—"
    return f"{v:.2f}%"


def main():
    data = json.load(sys.stdin)
    inv = data["investor"]
    portfolio = data.get("portfolio", {})
    compliance = data.get("compliance", {})

    lines = []
    lines.append(f"# LP Brief — {inv['name']}")
    lines.append("")

    holdings = portfolio.get("holdings", [])
    total_stake = sum(h.get("stake", 0) or 0 for h in holdings)

    lines.append("## Position")
    lines.append(f"- Total across funds: {fmt_money(total_stake)}")
    lines.append(f"- Funds: {len(holdings)}")

    tracks = set(h.get("track", "Traditional") for h in holdings)
    lines.append(f"- Tracks: {', '.join(tracks)}")
    lines.append("")

    if holdings:
        lines.append("## Holdings")
        lines.append("")
        lines.append("| Fund | Track | Stake | Ownership |")
        lines.append("|---|---|---|---|")
        for h in holdings:
            lines.append(
                f"| {h.get('fund_name', '—')} "
                f"| {h.get('track', 'Traditional')} "
                f"| {fmt_money(h.get('stake'))} "
                f"| {fmt_pct(h.get('ownership_percent'))} |"
            )
        lines.append("")

    flags = compliance.get("flags", [])
    if flags:
        lines.append("## Compliance flags")
        for f in flags:
            lines.append(f"- **{f.get('rule_name')}** — {f.get('detail', '')}")
        lines.append("")

    obligations = portfolio.get("outstanding_calls", [])
    if obligations:
        lines.append("## Outstanding obligations")
        total_owed = sum(o.get("amount", 0) or 0 for o in obligations)
        lines.append(f"- Total outstanding: {fmt_money(total_owed)}")
        lines.append(f"- Next due: {obligations[0].get('due_date', '—')}")
        lines.append("")

    if not flags and not obligations:
        lines.append("_Clean. No compliance flags, no outstanding obligations._")

    print("\n".join(lines))


if __name__ == "__main__":
    main()
```

---

### `scripts/format_rule.py`

```python
#!/usr/bin/env python3
"""
Format a single compliance rule for display.

Usage:
  echo '{"rule_name": "409A-FMV", ...}' | python format_rule.py

Reads a rule JSON from stdin, writes a one-paragraph description to stdout.
"""
import json
import sys
from datetime import datetime, timezone


def main():
    r = json.load(sys.stdin)
    name = r.get("rule_name", "Unnamed rule")
    severity = r.get("severity", "info").upper()
    label = r.get("label", "")
    start = r.get("effective_from", "—")
    end = r.get("effective_to") or "present"
    package = r.get("package_name", "—")

    print(f"**{name}** ({severity})")
    print(f"Package: {package}")
    print(f"Effective: {start} → {end}")
    if label:
        print(f"Purpose: {label}")
    if r.get("condition"):
        print(f"Condition: {json.dumps(r['condition'])}")


if __name__ == "__main__":
    main()
```

---

## Optional Micro-App: Compliance Dashboard

A minimal HTML page rendered as an artifact. Useful when the user wants to
share a compliance view without pasting JSON.

**Location:** `micro-apps/compliance-dashboard/`

**What it shows:**
- Issuer name and last-updated timestamp
- Three status cards: Blocking findings, Review findings, Expiring rules
- A sortable findings table
- A Shariah screening section (only if the fund has an Islamic track)
- Export to PDF button (browser print)

**When Claude should render it:**
- User says "show me" or "visualize"
- User wants to share the result with someone else
- Multiple issuers are being compared

**When to skip it:**
- The user just wants an answer to a specific question
- The output is a single finding

**Implementation:** A single self-contained HTML file with inlined CSS and
vanilla JS. No build step. Data is injected as a JSON blob before the file
is rendered as an artifact. Colors match the Flowgate brand (indigo #6366F1,
slate background, monospace numbers).

---

## Package Summary

```
flowgate-compliance/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── mcp-servers/
│   └── flowgate.json
├── commands/
│   ├── verify-grant.md
│   ├── health-scan.md
│   ├── lp-brief.md
│   └── shariah-screen.md
├── skills/
│   ├── grant-verification/SKILL.md
│   ├── compliance-scan/SKILL.md
│   ├── lp-briefing/SKILL.md
│   └── shariah-screening/SKILL.md
├── scripts/
│   ├── aggregate_findings.py
│   ├── render_brief.py
│   └── format_rule.py
└── micro-apps/
    └── compliance-dashboard/
        └── index.html
```

---

## What still needs to exist before this ships

The plugin references four MCP tools that aren't in `@iflowgate/mcp-server@0.1.2`:

| Tool | Status | Where |
|---|---|---|
| `get_cap_table` | ✅ exists | v0.1.2 |
| `list_compliance_rules` | ✅ exists | v0.1.2 |
| `get_investor_portfolio` | ✅ exists | v0.1.2 |
| `verify_grant_compliance` | ❌ needs backend + MCP | Phase 1 |
| `compliance_health_scan` | ❌ needs backend + MCP | Phase 2 |
| `prepare_lp_brief` | ❌ needs backend + MCP | Phase 3 |
| `shariah_screening_report` | ❌ needs backend + MCP | Phase 4 |

**The plugin is the packaging. The tools are the product.** Build Phase 1–4, publish `@iflowgate/mcp-server@0.2.0`, then this plugin becomes installable. Until then, it's a spec — and a very good one, because it forces the tool design to be workflow-first rather than endpoint-first.

