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
