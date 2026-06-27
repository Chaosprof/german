#!/usr/bin/env python3
"""Audit active word-bank entries for visibly suspicious English glosses.

This report is intentionally conservative: it combines known DeepL-diff
proposals with a few targeted literal-fragment scans, then writes a reviewable
Markdown/JSON artifact. It does not modify the word bank.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
AUDIT = ROOT / "audit"
DEEPL_DIFF = AUDIT / "deepl_diff"
DEEPL = AUDIT / "deepl"

LANGUAGE_NAMES = {
    "Arabisch",
    "Chinesisch",
    "Dänisch",
    "Englisch",
    "Französisch",
    "Griechisch",
    "Hebräisch",
    "Italienisch",
    "Japanisch",
    "Polnisch",
    "Portugiesisch",
    "Russisch",
    "Spanisch",
    "Tschechisch",
    "Türkisch",
}

CHESS_LANGUAGE_TERMS = (
    "Ruy Lopez",
    "Giuoco Piano",
    "Spanish Game",
    "Spanish Opening",
    "Italian Game",
    "French Defence",
    "French Defense",
)

TARGETED_PATTERNS = [
    (
        "literal_current_for_strom",
        re.compile(
            r"\b(?:current arithmetic|current client|current appliance|current cable|"
            r"current combine|current delivery|current extraction|current need|"
            r"current production|cloth current|flatulence current|Sun current)\b",
            re.I,
        ),
    ),
    (
        "literal_fragment_multi_sense",
        re.compile(
            r"\b(?:shape ion|dot ion|draw ion|overseas dung|problem bed|"
            r"altitude bed|assurance bed|anticyclone bed|economics bed|"
            r"date bed|bed report|inclination bed|idea cage|cage chaser|"
            r"elf bank|humour bed|care bed|journey flatulence|angle bed|"
            r"act bed|fountain bed|fragment dung|cage background|evidence bed|"
            r"elf backbend|mixture bed|ruins dung|flatulence background|"
            r"elf estuary|cage attitude|boulder dung|voice bed|cage arc|"
            r"cage Mrs|rich in cage|low in cage|season anacrusis|anacrusis game|"
            r"check association)\b",
            re.I,
        ),
    ),
]

SUGGESTION_OVERRIDES = {
    ("adjective", "torarm"): "low-scoring/with few goals",
    ("noun", "Lagebericht"): "management report",
    ("noun", "Vorwerk"): "outwork/outer bailey",
    ("noun", "Windverhältnis"): "wind conditions",
    ("noun", "Torfrau"): "female goalkeeper/goalkeeper",
    ("noun", "Italienisch"): "Italian",
    ("noun", "Spanisch"): "Spanish",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def active_entries():
    specs = [
        ("noun", DATA / "nouns.json", "nouns"),
        ("verb", DATA / "verbs.json", "verbs"),
        ("adjective", DATA / "adjectives.json", "adjectives"),
    ]
    for kind, path, key in specs:
        for entry in load_json(path)[key]:
            yield kind, entry


def deep_lookup(kind: str):
    filename = {"noun": "nouns.json", "verb": "verbs.json", "adjective": "adjectives.json"}[kind]
    path = DEEPL / filename
    return load_json(path) if path.exists() else {}


def entry_key(kind: str, entry: dict) -> tuple:
    return (kind, entry.get("word"), entry.get("rank"))


def add_issue(issues: dict, kind: str, entry: dict, category: str, suggestion: str, reason: str):
    key = (kind, entry.get("word"), entry.get("rank"), category)
    issues[key] = {
        "kind": kind,
        "rank": entry.get("rank"),
        "article": entry.get("article") or "",
        "word": entry.get("word"),
        "current": entry.get("english") or "",
        "suggestion": suggestion or "",
        "category": category,
        "reason": reason,
    }


def same_gloss(left: str, right: str) -> bool:
    return (left or "").strip().lower() == (right or "").strip().lower()


def normalize_deepl(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if value[0].isupper() and not value.isupper():
        return value[0].lower() + value[1:]
    return value


def add_deepl_proposals(issues: dict, by_key: dict):
    fixes_path = DEEPL_DIFF / "proposed_fixes.json"
    if fixes_path.exists():
        fixes = load_json(fixes_path)
        for rows in fixes.values():
            for row in rows:
                entry = by_key.get(("noun", row["word"], row["rank"]))
                suggestion = row.get("deepl", "")
                if (
                    entry
                    and same_gloss(entry.get("english", ""), row.get("current", ""))
                    and not same_gloss(entry.get("english", ""), suggestion)
                ):
                    add_issue(
                        issues,
                        "noun",
                        entry,
                        "known_mt_failure",
                        suggestion,
                        row.get("reason", "Existing DeepL proposal"),
                    )

    reorders_path = DEEPL_DIFF / "proposed_reorderings.json"
    if reorders_path.exists():
        for row in load_json(reorders_path):
            entry = by_key.get(("noun", row["word"], row["rank"]))
            suggestion = row.get("proposed", "")
            if (
                entry
                and same_gloss(entry.get("english", ""), row.get("current", ""))
                and not same_gloss(entry.get("english", ""), suggestion)
            ):
                add_issue(
                    issues,
                    "noun",
                    entry,
                    "bad_first_sense",
                    suggestion,
                    "Current gloss leads with a wrong/distracting sense.",
                )

    tight_path = DEEPL_DIFF / "proposed_fixes_round2_tight.json"
    if tight_path.exists():
        for row in load_json(tight_path):
            entry = by_key.get(("noun", row["word"], row["rank"]))
            suggestion = row.get("deepl", "")
            if (
                entry
                and same_gloss(entry.get("english", ""), row.get("current", ""))
                and not same_gloss(entry.get("english", ""), suggestion)
            ):
                add_issue(
                    issues,
                    "noun",
                    entry,
                    row.get("class", "WORD_GARBAGE").lower(),
                    SUGGESTION_OVERRIDES.get(("noun", row["word"]), suggestion),
                    "Existing tight short-gloss garbage proposal.",
                )


def build_report():
    entries = list(active_entries())
    by_key = {entry_key(kind, entry): entry for kind, entry in entries}
    deepl_maps = {kind: deep_lookup(kind) for kind in ("noun", "verb", "adjective")}

    language_rows = []
    issues = {}

    for kind, entry in entries:
        word = entry.get("word", "")
        current = entry.get("english") or ""
        if kind == "noun" and word in LANGUAGE_NAMES:
            deepl = normalize_deepl(deepl_maps["noun"].get(word, ""))
            upstream = ""
            language_rows.append(
                {
                    "rank": entry.get("rank"),
                    "article": entry.get("article") or "",
                    "word": word,
                    "current": current,
                    "deepl": deepl,
                    "problem": "yes" if any(term in current for term in CHESS_LANGUAGE_TERMS) else "",
                    "note": "chess opening sense leaked in" if any(term in current for term in CHESS_LANGUAGE_TERMS) else "",
                }
            )
            if any(term in current for term in CHESS_LANGUAGE_TERMS):
                add_issue(
                    issues,
                    kind,
                    entry,
                    "language_chess_missense",
                    SUGGESTION_OVERRIDES.get((kind, word), deepl or re.sub(r"^(.*?/)?([^/]+)(/.*)?$", r"\2", current)),
                    "Language noun contains chess-opening senses.",
                )

        for category, pattern in TARGETED_PATTERNS:
            if pattern.search(current):
                suggestion = SUGGESTION_OVERRIDES.get((kind, word), normalize_deepl(deepl_maps[kind].get(word, "")))
                add_issue(
                    issues,
                    kind,
                    entry,
                    category,
                    suggestion,
                    "Literal fragment in the English gloss.",
                )

        if kind == "adjective" and word == "aber" and "Monday and Tuesday" in current:
            add_issue(
                issues,
                kind,
                entry,
                "parsed_context_as_translation",
                "but",
                "Netzwerk A1 context text was parsed into the English gloss.",
            )

    add_deepl_proposals(issues, by_key)

    language_rows.sort(key=lambda r: (r["rank"] is None, r["rank"] or 0, r["word"]))
    issue_rows = sorted(issues.values(), key=lambda r: (r["rank"] is None, r["rank"] or 0, r["kind"], r["word"]))

    out_json = {
        "summary": {
            "language_nouns": len(language_rows),
            "language_nouns_with_chess_missense": sum(1 for r in language_rows if r["problem"]),
            "weird_translation_candidates": len(issue_rows),
        },
        "language_nouns": language_rows,
        "issues": issue_rows,
    }
    (AUDIT / "word_bank_weird_translations.json").write_text(
        json.dumps(out_json, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    lines = [
        "# Word-bank weird translation audit",
        "",
        "Scope: active word bank files `data/nouns.json`, `data/verbs.json`, and `data/adjectives.json`.",
        "",
        "## Summary",
        "",
        f"- Language nouns checked: **{len(language_rows)}**",
        f"- Language nouns with chess-opening senses: **{out_json['summary']['language_nouns_with_chess_missense']}**",
        f"- Weird translation candidates: **{len(issue_rows)}**",
        "",
        "## Language nouns",
        "",
        "| rank | article | word | current English | DeepL/cache | problem |",
        "|---:|:---:|---|---|---|---|",
    ]
    for row in language_rows:
        lines.append(
            f"| {row['rank']} | {row['article']} | {row['word']} | {row['current']} | "
            f"{row['deepl']} | {row['note']} |"
        )

    lines.extend(
        [
            "",
            "## Weird translation candidates",
            "",
            "| rank | kind | article | word | current English | suggested English | category | reason |",
            "|---:|---|:---:|---|---|---|---|---|",
        ]
    )
    for row in issue_rows:
        lines.append(
            f"| {row['rank']} | {row['kind']} | {row['article']} | {row['word']} | "
            f"{row['current']} | {row['suggestion']} | {row['category']} | {row['reason']} |"
        )

    (AUDIT / "word_bank_weird_translations.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_json


def main():
    report = build_report()
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
