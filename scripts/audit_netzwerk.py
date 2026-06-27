"""Audit a parsed Netzwerk glossary against the local word banks.

Uses the English translations already present in the parsed entries
(no DeepL needed). Writes audit/<slug>_missing.json with metadata.

Usage: audit_netzwerk.py <parsed_json> <missing_json> <summary_md>
"""
import io
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def main():
    parsed_path = sys.argv[1]
    missing_path = sys.argv[2]
    summary_path = sys.argv[3]

    parsed = load(parsed_path)
    bank_n = {n["word"]: n for n in load("data/nouns.json")["nouns"]}
    bank_v = {v["word"]: v for v in load("data/verbs.json")["verbs"]}
    bank_a = {a["word"]: a for a in load("data/adjectives.json")["adjectives"]}
    bank_a_lower = {a["word"].lower(): a for a in load("data/adjectives.json")["adjectives"]}

    found = Counter()
    missing = defaultdict(list)
    for e in parsed:
        kind = e["kind"]
        lemma = e["lemma"]
        if kind == "noun":
            if lemma in bank_n: found["noun"] += 1
            else: missing["noun"].append(e)
        elif kind == "verb":
            if lemma in bank_v: found["verb"] += 1
            elif lemma.lower() in bank_a_lower: found["adj"] += 1
            else: missing["verb"].append(e)
        elif kind == "adj":
            if lemma in bank_a: found["adj"] += 1
            elif lemma.lower() in bank_a_lower: found["adj"] += 1
            elif lemma in bank_v: found["verb"] += 1
            elif lemma in bank_n: found["noun"] += 1
            else: missing["adj"].append(e)
        else:
            missing["expression"].append(e)

    Path(missing_path).write_text(json.dumps(dict(missing), ensure_ascii=False, indent=2), encoding="utf-8")

    totals = Counter(e["kind"] for e in parsed)
    out = []
    out.append(f"# Netzwerk neu audit summary\n")
    out.append(f"\nParsed: {len(parsed)} entries.\n")
    out.append("## Coverage by kind\n")
    out.append("| Kind | In PDF | Found | Missing |")
    out.append("|---|---:|---:|---:|")
    for kind, label in [("noun", "Nouns"), ("verb", "Verbs"), ("adj", "Adjectives/adverbs"), ("expression", "Expressions")]:
        out.append(f"| {label} | {totals[kind]} | {found[kind]} | {len(missing[kind])} |")
    Path(summary_path).write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"Parsed: {len(parsed)} entries")
    print("Found:", dict(found))
    print("Missing:", {k: len(v) for k, v in missing.items()})


if __name__ == "__main__":
    main()
