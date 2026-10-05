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
