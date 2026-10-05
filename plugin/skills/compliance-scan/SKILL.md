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
