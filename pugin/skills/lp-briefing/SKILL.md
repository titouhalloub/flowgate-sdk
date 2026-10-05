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
