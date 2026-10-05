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
