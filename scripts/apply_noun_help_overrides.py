#!/usr/bin/env python3
"""Apply curated article/plural help overrides to data/nouns.json."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NOUNS_PATH = ROOT / "data" / "nouns.json"
OVERRIDES_PATH = ROOT / "data" / "noun-help-overrides.json"


def resolve_help(bank: dict, kind: str, override: dict) -> str | None:
    direct = override.get(kind)
    if direct is not None:
        return direct
    key = override.get(f"{kind}Key")
    if key is None:
        return None
    try:
        return bank[kind][key]
    except KeyError as exc:
        raise KeyError(f"Unknown {kind} key: {key}") from exc


def apply_override(noun: dict, override: dict, bank: dict) -> bool:
    if override.get("onlyIfArticle") and noun.get("article") != override["onlyIfArticle"]:
        return False

    changed = False

    for field in ("article", "plural", "english"):
        if field in override and noun.get(field) != override[field]:
            noun[field] = override[field]
            changed = True

    for help_field in ("articleHelp", "pluralHelp"):
        value = resolve_help(bank, help_field, override)
        if value is not None and noun.get(help_field) != value:
            noun[help_field] = value
            changed = True

    if "ruleId" in override:
        value = override["ruleId"]
        if value is None:
            if "ruleId" in noun:
                del noun["ruleId"]
                changed = True
        elif noun.get("ruleId") != value:
            noun["ruleId"] = value
            changed = True

    if "isException" in override:
        value = override["isException"]
        if value:
            if noun.get("isException") is not True:
                noun["isException"] = True
                changed = True
        elif "isException" in noun:
            del noun["isException"]
            changed = True

    if "pluraleTantum" in override:
        value = override["pluraleTantum"]
        if value:
            if noun.get("pluraleTantum") is not True:
                noun["pluraleTantum"] = True
                changed = True
        elif "pluraleTantum" in noun:
            del noun["pluraleTantum"]
            changed = True

    return changed


def main() -> None:
    nouns_doc = json.loads(NOUNS_PATH.read_text(encoding="utf-8"))
    bank = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    by_word: dict[str, list[dict]] = {}
    for noun in nouns_doc["nouns"]:
        by_word.setdefault(noun["word"], []).append(noun)

    touched = 0
    missing: list[str] = []
    for word, override in bank["overrides"].items():
        matches = by_word.get(word, [])
        if not matches:
            missing.append(word)
            continue
        applied = False
        for noun in matches:
            if override.get("onlyIfArticle") and noun.get("article") != override["onlyIfArticle"]:
                continue
            if apply_override(noun, override, bank):
                touched += 1
            applied = True
            if not override.get("onlyIfArticle"):
                applied = True
        if not applied:
            missing.append(f"{word} (no matching article)")

    nouns_doc["meta"]["count"] = len(nouns_doc["nouns"])
    NOUNS_PATH.write_text(
        json.dumps(nouns_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Applied noun help overrides to {touched} entries.")
    if missing:
        print("Missing overrides:")
        for word in missing:
            print(f"  - {word}")


if __name__ == "__main__":
    main()
