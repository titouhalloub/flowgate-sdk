---
name: grant-verification
description: Use when the user mentions verifying, checking, or validating an option grant, warrant, or equity issuance against the 409A gate. Also use when the user asks whether a grant "would pass", "is compliant", or "will be rejected."
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

## Rules applied

Today, the 409A gate is the only rule applied to grants. A grant is checked
against the latest FMV 409A valuation in effect on the effective date. If
the strike is below FMV, the grant is rejected with the exact regulatory
reason from the engine.

`rule_evaluations` is an empty array in the current phase. Additional
grant-specific rules will be added in a future phase; when they are, this
skill will surface them.

Do not claim rules were evaluated when the list is empty. Report only the
409A result and the FMV used.

The gate applies to option and warrant **issuances** that carry a strike
price. Common and preferred issuances are not strikes and are never gated,
and `exercise` or `conversion` events are not gated either.

## Rules to remember

- Option and warrant grants below FMV are **rejected** at the API boundary.
- Common stock below FMV is **allowed** — an issuance price and an exercise
  price are not the same thing.
- The rejection detail comes from the API. Show it verbatim. Do not paraphrase.
- If the user disagrees with the rejection, do not override it. Explain that
  the gate is enforced by the engine, not the interface, and that changing the
  outcome requires updating the 409A valuation.
