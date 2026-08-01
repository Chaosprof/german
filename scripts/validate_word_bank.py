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

    for bank in BANKS:
        path = DATA / f"{bank}.json"
        doc = json.loads(path.read_text(encoding="utf-8"))
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

        exact_keys = [(row.get("word"), row.get("english")) for row in rows]
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

            if bank == "nouns":
                if row.get("article") not in ARTICLES:
                    errors.append(f"{path}: {word}: invalid article {row.get('article')!r}")
                plural = row.get("plural")
                if not isinstance(plural, str) or not plural.strip():
                    errors.append(f"{path}: {word}: blank or invalid plural")

        if bank == "verbs":
            irregular = [row for row in rows if row.get("irregular")]
            if doc.get("meta", {}).get("irregularCount") != len(irregular):
                errors.append(f"{path}: meta.irregularCount does not equal actual count")
            for row in irregular:
                if not row.get("prateritum") or not row.get("perfekt"):
                    errors.append(f"{path}: {row.get('word')}: incomplete irregular paradigm")
                if not isinstance(row.get("withSein"), bool):
                    errors.append(f"{path}: {row.get('word')}: irregular auxiliary is not explicit")

    help_path = DATA / "noun-help.json"
    help_doc = json.loads(help_path.read_text(encoding="utf-8"))
    help_rows = help_doc.get("help", {})
    noun_words = {row["word"] for row in json.loads((DATA / "nouns.json").read_text(encoding="utf-8"))["nouns"]}
    if help_doc.get("meta", {}).get("count") != len(help_rows):
        errors.append(f"{help_path}: meta.count does not equal help-entry count")
    obsolete_help = set(help_rows) - noun_words
    if obsolete_help:
        errors.append(f"{help_path}: help exists for removed nouns {sorted(obsolete_help)[:10]}")
    for word, pair in help_rows.items():
        if not isinstance(pair, list) or len(pair) != 2 or not all(isinstance(value, str) for value in pair):
            errors.append(f"{help_path}: {word}: expected [articleHelp, pluralHelp]")

    if errors:
        print(f"Word-bank validation failed with {len(errors)} error(s):")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Word-bank validation passed:", ", ".join(f"{bank}={count}" for bank, count in counts.items()))


if __name__ == "__main__":
    main()
