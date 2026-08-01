#!/usr/bin/env python3
"""Fail-fast structural checks for the exercise word banks."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BANKS = ("nouns", "verbs", "adjectives")
ARTICLES = {"der", "die", "das"}
REVIEWER_TEXT = re.compile(
    r"\b(?:better:|current gloss|delete from|drop as|lemma is|mark register|remove from (?:the )?(?:bank|deck)|why:)\b",
    re.I,
)


def main() -> None:
    errors: list[str] = []
    counts: dict[str, int] = {}
    docs: dict[str, dict] = {}

    for bank in BANKS:
        path = DATA / f"{bank}.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
        docs[bank] = doc
        rows = doc.get(bank)
        if not isinstance(rows, list):
            errors.append(f"{path}: missing {bank} array")
            continue
        counts[bank] = len(rows)

        if doc.get("meta", {}).get("count") != len(rows):
            errors.append(f"{path}: meta.count does not equal row count")

        ranks = [row.get("rank") for row in rows]
        duplicate_ranks = [rank for rank, count in Counter(ranks).items() if count > 1]
        if duplicate_ranks:
            errors.append(f"{path}: duplicate ranks {duplicate_ranks[:10]}")

        playable_rows = [row for row in rows if row.get("learnerSafe") is not False and row.get("active") is not False]
        exact_keys = [(row.get("word"), row.get("english")) for row in playable_rows]
        duplicate_rows = [key for key, count in Counter(exact_keys).items() if count > 1]
        if duplicate_rows:
            errors.append(f"{path}: duplicate word/gloss rows {duplicate_rows[:10]}")

        for row in rows:
            word = row.get("word")
            english = row.get("english")
            if not isinstance(word, str) or not word.strip():
                errors.append(f"{path}: blank or invalid word")
                continue
            if not isinstance(english, str) or not english.strip():
                errors.append(f"{path}: {word}: blank or invalid English gloss")
            elif "\n" in english or "`" in english or "*" in english:
                errors.append(f"{path}: {word}: Markdown/newline leaked into gloss")
            elif REVIEWER_TEXT.search(english):
                errors.append(f"{path}: {word}: reviewer instruction leaked into gloss")

            entry_id = row.get("id")
            if not isinstance(entry_id, str) or not entry_id.strip():
                errors.append(f"{path}: {word}: missing stable id")
            if "learnerSafe" in row and not isinstance(row["learnerSafe"], bool):
                errors.append(f"{path}: {word}: learnerSafe must be boolean")

            if bank == "nouns":
                if row.get("article") not in ARTICLES and not (
                    row.get("article") == "—"
                    and row.get("learnerSafe") is False
                    and row.get("properNameOrArticleless") is True
                ):
                    errors.append(f"{path}: {word}: invalid article {row.get('article')!r}")
                plural = row.get("plural")
                if not isinstance(plural, str) or not plural.strip():
                    errors.append(f"{path}: {word}: blank or invalid plural")

        if bank == "verbs":
            irregular = [row for row in rows if row.get("irregular")]
            if doc.get("meta", {}).get("irregularCount") != len(irregular):
                errors.append(f"{path}: meta.irregularCount does not equal actual count")
            for row in irregular:
                if row.get("learnerSafe") is False or row.get("active") is False:
                    continue
                if not row.get("prateritum") or not row.get("perfekt"):
                    errors.append(f"{path}: {row.get('word')}: incomplete irregular paradigm")
                if not isinstance(row.get("withSein"), bool):
                    errors.append(f"{path}: {row.get('word')}: irregular auxiliary is not explicit")

        ids = [row.get("id") for row in rows]
        duplicate_ids = [entry_id for entry_id, count in Counter(ids).items() if count > 1]
        if duplicate_ids:
            errors.append(f"{path}: duplicate stable ids {duplicate_ids[:10]}")

    help_path = DATA / "noun-help.json"
    help_doc = json.loads(help_path.read_text(encoding="utf-8"))
    help_rows = help_doc.get("help", {})
    noun_rows = docs["nouns"]["nouns"]
    noun_ids = {row["id"] for row in noun_rows}
    if help_doc.get("meta", {}).get("count") != len(help_rows):
        errors.append(f"{help_path}: meta.count does not equal help-entry count")
    obsolete_help = set(help_rows) - noun_ids
    if obsolete_help:
        errors.append(f"{help_path}: help exists for removed noun IDs {sorted(obsolete_help)[:10]}")
    missing_help = noun_ids - set(help_rows)
    if missing_help:
        errors.append(f"{help_path}: missing help for noun IDs {sorted(missing_help)[:10]}")
    for entry_id, pair in help_rows.items():
        if not isinstance(pair, list) or len(pair) != 2 or not all(isinstance(value, str) for value in pair):
            errors.append(f"{help_path}: {entry_id}: expected [articleHelp, pluralHelp]")

    rules_path = DATA / "article-rules.json"
    rules_doc = json.loads(rules_path.read_text(encoding="utf-8"))
    rules = rules_doc.get("rules", {})
    noun_exact = {(row["word"], row["article"]) for row in noun_rows if row.get("learnerSafe") is not False}
    for row in noun_rows:
        rule_id = row.get("ruleId")
        if not rule_id:
            if row.get("isException"):
                errors.append(f"{DATA / 'nouns.json'}: {row['id']}: isException without ruleId")
            continue
        rule = rules.get(rule_id)
        if not rule:
            errors.append(f"{DATA / 'nouns.json'}: {row['id']}: unknown ruleId {rule_id}")
            continue
        predicted = rule.get("article")
        if row.get("isException"):
            if row["article"] == predicted:
                errors.append(f"{DATA / 'nouns.json'}: {row['id']}: exception article equals rule article")
        elif row["article"] != predicted:
            errors.append(f"{DATA / 'nouns.json'}: {row['id']}: rule article contradicts noun")
    for rule_id, rule in rules.items():
        if rule.get("confidence") not in {"categorical", "strong", "heuristic", "semantic"}:
            errors.append(f"{rules_path}: {rule_id}: missing/invalid confidence")
        for exception in rule.get("exceptions", []):
            if (exception.get("word"), exception.get("article")) not in noun_exact:
                errors.append(f"{rules_path}: {rule_id}: stale exception {exception}")

    vp_path = DATA / "verbs-with-prepositions.json"
    vp_doc = json.loads(vp_path.read_text(encoding="utf-8"))
    vp_rows = vp_doc.get("verbs", [])
    if vp_doc.get("meta", {}).get("count") != len(vp_rows):
        errors.append(f"{vp_path}: meta.count does not equal row count")
    vp_ids = [row.get("id") for row in vp_rows]
    if len(vp_ids) != len(set(vp_ids)) or any(not value for value in vp_ids):
        errors.append(f"{vp_path}: stable IDs are missing or duplicated")

    if errors:
        print(f"Word-bank validation failed with {len(errors)} error(s):")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Word-bank validation passed:", ", ".join(f"{bank}={count}" for bank, count in counts.items()))


if __name__ == "__main__":
    main()
