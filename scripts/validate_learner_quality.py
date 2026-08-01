#!/usr/bin/env python3
"""Semantic/regression guards for the reviewed learner-facing word bank."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
REMEDIATION = ROOT / "audit" / "current-review" / "remediation"


def load(path: Path, encoding: str = "utf-8"):
    return json.loads(path.read_text(encoding=encoding))


def active(row: dict) -> bool:
    safety = row.get("learnerSafety") or {}
    return (
        row.get("active") is not False
        and row.get("learnerSafe") is not False
        and safety.get("excludeFromCoreDrills") is not True
        and safety.get("excludeFromCoreLemmaDrills") is not True
        and safety.get("excludeFromAdjectiveDrills") is not True
    )


def main() -> None:
    errors: list[str] = []
    noun_doc = load(DATA / "nouns.json")
    verb_doc = load(DATA / "verbs.json")
    adj_doc = load(DATA / "adjectives.json")
    vp_doc = load(DATA / "verbs-with-prepositions.json")
    dual_doc = load(DATA / "dual-gender-nouns.json")
    collections = {
        "nouns": noun_doc["nouns"],
        "verbs": verb_doc["verbs"],
        "adjectives": adj_doc["adjectives"],
        "verb_preps": vp_doc["verbs"],
        "dual_gender": dual_doc["nouns"],
    }

    expected_ids = set()
    noun_manifest = load(REMEDIATION / "noun-fixes.json", "utf-8-sig")
    expected_ids.update(item["id"] for item in noun_manifest["items"])
    verb_manifest = load(REMEDIATION / "verb-fixes.json")
    expected_ids.update(item["fix_id"] for item in verb_manifest["fixes"])
    adj_manifest = load(REMEDIATION / "adjective-dual-fixes.json")
    expected_ids.update(item["id"] for item in adj_manifest["fixes"])
    if len(expected_ids) != 3280:
        errors.append(f"remediation manifests contain {len(expected_ids)} unique retained findings, expected 3280")

    observed = Counter()
    for bank, rows in collections.items():
        active_keys = Counter()
        for row in rows:
            for history in row.get("reviewHistory", []):
                observed[history.get("findingId")] += 1
                if history.get("disposition") == "reference_only" and active(row):
                    errors.append(f"{bank}:{row.get('id')}: reference-only finding remains playable")
            if row.get("reviewStatus") == "reference_only" and active(row):
                errors.append(f"{bank}:{row.get('id')}: reference-only row remains playable")
            if active(row):
                word = row.get("word", row.get("verb"))
                gloss = row.get("english", "")
                # The same verb/gloss can legitimately occur with different
                # governed prepositions and cases.
                if bank == "verb_preps":
                    key = (word, row.get("preposition"), row.get("case"), gloss)
                else:
                    key = (word, gloss)
                active_keys[key] += 1
                if any(token in gloss for token in ("`", "*", "\n")):
                    errors.append(f"{bank}:{row.get('id')}: markup leaked into playable gloss")
        duplicates = [key for key, count in active_keys.items() if count > 1]
        if duplicates:
            errors.append(f"{bank}: duplicate playable word/gloss rows {duplicates[:5]}")

    missing = expected_ids - set(observed)
    extra = set(observed) - expected_ids
    if missing:
        errors.append(f"missing remediation history for {len(missing)} findings: {sorted(missing)[:5]}")
    if extra:
        errors.append(f"unexpected remediation history IDs: {sorted(extra)[:5]}")
    # One finding can intentionally annotate both sides of a merge or two
    # homographic senses. Presence is the invariant; add_review_history keeps
    # it unique within each individual record.

    for row in noun_doc["nouns"]:
        if active(row) and row.get("article") not in {"der", "die", "das"}:
            errors.append(f"nouns:{row['id']}: playable noun has no drillable article")
    for row in verb_doc["verbs"]:
        if active(row) and row.get("irregular"):
            if not row.get("prateritum") or not row.get("perfekt") or not isinstance(row.get("withSein"), bool):
                errors.append(f"verbs:{row['id']}: playable irregular paradigm incomplete")

    help_doc = load(DATA / "noun-help.json")
    help_text = "\n".join(value for pair in help_doc["help"].values() for value in pair)
    banned_help = {
        "~90%": "unsupported -e percentage",
        "~60%": "unsupported monosyllable percentage",
        "#1 rule": "unverified compound segmentation claim",
        "Compound noun — gender follows": "legacy unverified compound parser",
        "-chen (diminutive) → always": "raw spelling-tail diminutive inference",
    }
    for phrase, reason in banned_help.items():
        if phrase in help_text:
            errors.append(f"noun-help: {reason} remains ({phrase!r})")

    prep_doc = load(DATA / "preposition-rules.json")
    prep_text = json.dumps(prep_doc, ensure_ascii=False)
    for phrase in ("Akk for direction", "Dat for static location", "direction/movement"):
        if phrase in prep_text:
            errors.append(f"preposition rules retain misleading wording {phrase!r}")
    als_rule = prep_doc["prepositions"].get("als", {}).get("rule", "")
    if "subject-related" not in als_rule or "object-related" not in als_rule:
        errors.append("als rule does not distinguish subject- and object-related constructions")

    article_doc = load(DATA / "article-rules.json")
    article_text = json.dumps(article_doc, ensure_ascii=False)
    for phrase in ("~112", "Most plants and trees"):
        if phrase in article_text:
            errors.append(f"article rules retain audited false claim {phrase!r}")

    counts = {bank: sum(active(row) for row in rows) for bank, rows in collections.items()}
    if errors:
        print(f"Learner-quality validation failed with {len(errors)} error(s):")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print("Learner-quality validation passed")
    print(json.dumps({
        "retained_findings_accounted_for": len(expected_ids),
        "playable_counts": counts,
        "reference_only_counts": {bank: sum(not active(row) for row in rows) for bank, rows in collections.items()},
    }, indent=2))


if __name__ == "__main__":
    main()
