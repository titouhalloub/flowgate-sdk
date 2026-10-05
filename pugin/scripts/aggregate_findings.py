#!/usr/bin/env python3
"""
Aggregate compliance findings into a structured summary.

Usage:
  python aggregate_findings.py --mode=standard
  python aggregate_findings.py --mode=shariah

Input: reads a JSON blob from stdin containing:
  {
    "scan": { ... },        # output of compliance_health_scan
    "cap_table": { ... },   # output of get_cap_table
    "rules": [ ... ]        # output of list_compliance_rules
  }

Output: structured JSON summary with counts, groupings, and sorted findings.
"""
import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone

SEVERITY_ORDER = {"blocking": 0, "review": 1, "info": 2}


def parse_date(s):
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def days_until(date_str):
    d = parse_date(date_str)
    if not d:
        return None
    return (d - datetime.now(timezone.utc)).days


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["standard", "shariah"], default="standard")
    args = ap.parse_args()

    data = json.load(sys.stdin)
    findings = data.get("scan", {}).get("findings", [])
    rules = data.get("rules", [])

    # Count by severity
    severity_counts = Counter(f.get("severity", "info") for f in findings)
    total = sum(severity_counts.values())

    # Sort findings by severity
    sorted_findings = sorted(
        findings,
        key=lambda f: SEVERITY_ORDER.get(f.get("severity", "info"), 99),
    )

    # Find rules expiring within 30 days
    expiring = []
    for r in rules:
        end = r.get("effective_to")
        if not end:
            continue
        d = days_until(end)
        if d is not None and 0 <= d <= 30:
            expiring.append({
                "rule_name": r.get("rule_name"),
                "package": r.get("package_name"),
                "closes_on": end,
                "days_remaining": d,
            })
    expiring.sort(key=lambda x: x["days_remaining"])

    # Determine overall status
    if severity_counts.get("blocking", 0) > 0:
        status = "BLOCKED"
    elif severity_counts.get("review", 0) > 0:
        status = "REVIEW NEEDED"
    else:
        status = "CLEAR"

    # Mode-specific output
    if args.mode == "shariah":
        by_criterion = {}
        for f in findings:
            c = f.get("criterion") or f.get("rule_name", "unknown")
            by_criterion.setdefault(c, []).append(f)
        output = {
            "status": status,
            "total_findings": total,
            "severity_counts": dict(severity_counts),
            "criteria": {
                k: len(v) for k, v in by_criterion.items()
            },
            "expiring_rules": expiring,
            "sorted_findings": sorted_findings,
        }
    else:
        output = {
            "status": status,
            "total_rules_evaluated": len(rules),
            "total_findings": total,
            "severity_counts": dict(severity_counts),
            "expiring_rules": expiring,
            "sorted_findings": sorted_findings,
        }

    print(json.dumps(output, indent=2, default=str))


if __name__ == "__main__":
    main()
