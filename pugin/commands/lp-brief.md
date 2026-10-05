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
