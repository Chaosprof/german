#!/usr/bin/env python3
"""Validate and consolidate the manual current-review reports."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "audit" / "current-review"


def load_manifests() -> list[dict]:
    primary = json.loads((BASE / "manifest.json").read_text(encoding="utf-8"))["batches"]
    supplemental = json.loads((BASE / "supplemental-manifest.json").read_text(encoding="utf-8"))["batches"]
    return primary + supplemental


def batch_rows(spec: dict) -> list[dict]:
    with (ROOT / spec["path"]).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def parse_report(spec: dict) -> tuple[list[dict], dict]:
    path = BASE / "findings" / f"{spec['batch']}.md"
    text = path.read_text(encoding="utf-8")
    rows = batch_rows(spec)

    header = re.search(r"^#\s+\S+\s+\(reviewed\s+(\d+)\s+entr(?:y|ies)", text, re.M)
    if not header:
        raise ValueError(f"{path}: malformed or missing reviewed-count header")
    reviewed = int(header.group(1))
    if reviewed != len(rows):
        raise ValueError(f"{path}: claims {reviewed} reviewed, batch has {len(rows)}")

    clean_match = re.search(r"^## Clean\s*\n(\d+)\s+entr(?:y|ies) had no issues", text, re.M)
    if not clean_match:
        raise ValueError(f"{path}: malformed or missing clean count")
    clean = int(clean_match.group(1))

    block_re = re.compile(
        r"^- \*\*(.+?)\*\* \| (.+?) \| severity=(high|medium|low) \| category=([^\r\n]+)\r?\n"
        r"(.*?)(?=^- \*\*|^## Clean)",
        re.M | re.S,
    )
    findings = []
    for match in block_re.finditer(text):
        word, field, severity, category, body = match.groups()
        field = field.replace("`", "")
        values = {}
        for key in ("current", "correct", "why"):
            item = re.search(rf"^\s{{2}}{key}:\s*(.*)$", body, re.M)
            values[key] = item.group(1).strip() if item else ""
        source_hits = [
            int(row["row"])
            for row in rows
            if row.get("word", row.get("verb", "")) == word
        ]
        findings.append(
            {
                "batch": spec["batch"],
                "bank": spec.get("bank", "dual_gender"),
                "source_rows": source_hits,
                "word": word,
                "field": field,
                "severity": severity,
                "category": category.strip(),
                **values,
            }
        )

    if clean + len(findings) != len(rows):
        raise ValueError(
            f"{path}: clean {clean} + affected {len(findings)} != reviewed {len(rows)}"
        )
    final_word = rows[-1].get("word", rows[-1].get("verb", ""))
    if "## Coverage attestation" not in text or final_word not in text.split("## Coverage attestation", 1)[1]:
        raise ValueError(f"{path}: missing final-row coverage attestation for {final_word!r}")

    return findings, {
        "batch": spec["batch"],
        "entries": len(rows),
        "affected": len(findings),
        "clean": clean,
        "severity": dict(Counter(item["severity"] for item in findings)),
    }


def main() -> None:
    findings = []
    reports = []
    missing = []
    errors = []
    for spec in load_manifests():
        path = BASE / "findings" / f"{spec['batch']}.md"
        if not path.exists():
            missing.append(spec["batch"])
            continue
        try:
            parsed, report = parse_report(spec)
            findings.extend(parsed)
            reports.append(report)
        except ValueError as exc:
            errors.append(str(exc))

    (BASE / "findings-consolidated.json").write_text(
        json.dumps(findings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    fields = ["batch", "bank", "source_rows", "word", "field", "severity", "category", "current", "correct", "why"]
    with (BASE / "findings-consolidated.tsv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fields, delimiter="\t")
        writer.writeheader()
        for finding in findings:
            writer.writerow({**finding, "source_rows": ",".join(map(str, finding["source_rows"]))})

    summary = {
        "reports": len(reports),
        "entries_reviewed": sum(x["entries"] for x in reports),
        "affected_entries": len(findings),
        "clean_entries": sum(x["clean"] for x in reports),
        "severity": dict(Counter(x["severity"] for x in findings)),
        "category": dict(Counter(x["category"] for x in findings)),
        "missing_reports": missing,
        "validation_errors": errors,
        "batches": reports,
    }
    (BASE / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
