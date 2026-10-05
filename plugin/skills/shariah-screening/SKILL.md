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
