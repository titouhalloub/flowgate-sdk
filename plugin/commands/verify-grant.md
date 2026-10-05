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
   - Report the rules that were actually evaluated. If `rule_evaluations` is
     empty, say so explicitly — do not list rules that did not run.
3. If the response says the grant would be rejected:
   - Report the rejection prominently.
   - If `rule_evaluations` is empty (as it is today), report only the 409A
     gate result and the FMV used. Do not claim other rules were evaluated.
     Do not reference a rule name or effective window — they are not present
     in the response.
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
- If `rule_evaluations` is non-empty, list them:
  - [rule name] — effective [date] — severity [level]
- If `rule_evaluations` is empty, write exactly:
  - Only the 409A gate is applied to grants today.

Never claim a rule was evaluated when it is not present in
`rule_evaluations`. Also report the FMV the gate used and its effective
date, read from `current_fmv` and `fmv_effective_date`.

**Next step:** [what the user should do — adjust the price, update the 409A, or proceed]

Do not proceed to record the grant. This command is read-only. If the user
wants to record it, tell them to use `cap_table_events.create` explicitly.
