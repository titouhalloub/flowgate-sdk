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
