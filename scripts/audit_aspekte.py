"""Audit a parsed Aspekte glossary against the local word banks.

Usage: audit_aspekte.py <level> (b2 or c1)
"""
import io
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


LEVELS = {
    "b2": {
        "parsed": "audit/aspekte_b2_parsed.json",
        "summary": "audit/aspekte_b2_summary.md",
        "missing": "audit/aspekte_b2_missing.md",
        "label": "Aspekte neu B2",
        "pdf": "aspekte-neu-b2-lb-kapitelwortschatz.pdf",
    },
    "c1": {
        "parsed": "audit/aspekte_c1_parsed.json",
        "summary": "audit/aspekte_c1_summary.md",
        "missing": "audit/aspekte_c1_missing.md",
        "label": "Aspekte neu C1",
        "pdf": "aspekte-neu-c1-lb-kapitelwortschatz.pdf",
    },
}


def main():
    level = sys.argv[1].lower()
    cfg = LEVELS[level]
    parsed = load(cfg["parsed"])
    bank_n = {n["word"]: n for n in load("data/nouns.json")["nouns"]}
    bank_v = {v["word"]: v for v in load("data/verbs.json")["verbs"]}
    bank_a = {a["word"].lower(): a for a in load("data/adjectives.json")["adjectives"]}

    found = Counter()
    missing = defaultdict(list)
    for e in parsed:
        kind = e["kind"]
        lemma = e["lemma"]
        if kind in ("noun", "noun_pair"):
            if lemma in bank_n:
                found["noun"] += 1
            else:
                missing["noun"].append(e)
            if kind == "noun_pair":
                # Check female partner
                fem = lemma + "in"
                if not lemma.endswith("e"):
                    pass  # Handle later
                # Don't double count missing for partner
        elif kind == "verb":
            if lemma in bank_v:
                found["verb"] += 1
            elif lemma.lower() in bank_a:
                found["adj"] += 1
            else:
                missing["verb"].append(e)
        elif kind == "adj":
            if lemma.lower() in bank_a:
                found["adj"] += 1
            elif lemma in bank_v:
                found["verb"] += 1
            else:
                missing["adj"].append(e)
        else:
            missing["expression"].append(e)

    totals = Counter(e["kind"] for e in parsed)
    Path(cfg["summary"]).write_text(_write_summary(cfg, parsed, totals, found, missing), encoding="utf-8")
    Path(cfg["missing"]).write_text(_write_missing(cfg, missing), encoding="utf-8")
    print(f"Parsed {len(parsed)} entries")
    print("Kinds:", dict(totals))
    print("Found:", dict(found))
    print("Missing:", {k: len(v) for k, v in missing.items()})


def _write_summary(cfg, parsed, totals, found, missing):
    out = [f"# {cfg['label']} Glossar audit summary", ""]
    out.append(f"PDF: `{cfg['pdf']}` — {len(parsed)} entries parsed.")
    out.append("")
    out.append("## Coverage by kind")
    out.append("")
    out.append("| Kind | In PDF | Found | Missing |")
    out.append("|---|---:|---:|---:|")
    for kind, label in [("noun", "Nouns"), ("noun_pair", "Person noun pairs"),
                        ("verb", "Verbs"), ("adj", "Adjectives/adverbs"),
                        ("expression", "Expressions")]:
        miss = len(missing.get("noun" if kind == "noun_pair" else kind, []))
        in_pdf = totals[kind]
        if kind == "noun_pair":
            # noun_pair entries are checked against bank_n same as nouns
            f = sum(1 for e in parsed if e["kind"] == "noun_pair" and e["lemma"] in {n["word"] for n in load("data/nouns.json")["nouns"]})
            out.append(f"| {label} | {in_pdf} | {f} | {in_pdf - f} |")
        else:
            f = found.get(kind if kind != "adj" else "adj", 0)
            out.append(f"| {label} | {in_pdf} | {f} | {miss} |")
    out.append("")
    return "\n".join(out)


def _write_missing(cfg, missing):
    out = [f"# {cfg['label']} missing entries", ""]
    for kind in ["noun", "verb", "adj", "expression"]:
        items = missing.get(kind, [])
        out.append(f"## {kind} missing ({len(items)})")
        out.append("")
        if not items:
            out.append("_None._")
            out.append("")
            continue
        for e in items:
            loc = f"K{e['chapter']}/M{e['module']}/§{e['section']}" if e.get("module") else f"K{e['chapter']}/§{e['section']}"
            out.append(f"- **{e['lemma']}** — `{e['text']}` [{loc}]")
        out.append("")
    return "\n".join(out)


if __name__ == "__main__":
    main()
