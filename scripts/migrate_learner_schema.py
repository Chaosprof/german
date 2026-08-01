#!/usr/bin/env python3
"""Migrate the word bank to a sense-aware, learner-safe schema.

This migration is intentionally conservative. It adds stable IDs without
removing legacy top-level fields, normalises article-rule metadata, filters
stale exception lists, and regenerates noun help from exact final values rather
than guessing morphology from spelling tails. The static website remains able
to consume the old fields while using IDs when present.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TODAY = date.today().isoformat()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, value, *, compact: bool = False) -> None:
    if compact:
        text = json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    else:
        text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")


def stable_id(prefix: str, rank: int, width: int = 5) -> str:
    return f"{prefix}-{rank:0{width}d}"


def add_ids() -> dict[str, int]:
    counts: dict[str, int] = {}
    for filename, key, prefix in (
        ("nouns.json", "nouns", "noun"),
        ("verbs.json", "verbs", "verb"),
        ("adjectives.json", "adjectives", "adj"),
    ):
        path = DATA / filename
        doc = load(path)
        rows = doc[key]
        for row in rows:
            row.setdefault("id", stable_id(prefix, int(row["rank"])))
            if key == "verbs" and row.get("irregular"):
                mixed = {"brennen", "bringen", "denken", "kennen", "nennen", "rennen", "senden", "wenden", "wissen"}
                rule_ids = ["mixed" if row["word"] in mixed else "strong", "auxiliary"]
                perfekt = row.get("perfekt", "")
                if re.search(r"^[a-zäöüß]+ge[a-zäöüß]+", perfekt, re.I):
                    rule_ids.append("separable")
                elif row["word"].startswith(("be", "emp", "ent", "er", "miss", "ver", "zer")):
                    rule_ids.append("inseparable")
                row.setdefault("formRuleIds", rule_ids)
        ids = [row["id"] for row in rows]
        if len(ids) != len(set(ids)):
            raise ValueError(f"duplicate IDs in {filename}")
        doc.setdefault("meta", {})["schemaVersion"] = 3
        doc["meta"]["reviewedAt"] = TODAY
        doc["meta"]["count"] = len(rows)
        if key == "verbs":
            doc["meta"]["irregularCount"] = sum(bool(row.get("irregular")) for row in rows)
        save(path, doc)
        counts[key] = len(rows)

    vp_path = DATA / "verbs-with-prepositions.json"
    vp_doc = load(vp_path)
    for row in vp_doc["verbs"]:
        row.setdefault("id", stable_id("verb-prep", int(row["rank"]), 4))
    vp_doc.setdefault("meta", {})["schemaVersion"] = 2
    vp_doc["meta"]["reviewedAt"] = TODAY
    vp_doc["meta"]["count"] = len(vp_doc["verbs"])
    save(vp_path, vp_doc)
    counts["verb_prepositions"] = len(vp_doc["verbs"])

    dual_path = DATA / "dual-gender-nouns.json"
    dual_doc = load(dual_path)
    for index, row in enumerate(dual_doc["nouns"], 1):
        row.setdefault("id", f"dual-{index:04d}")
        for gender_index, sense in enumerate(row.get("genders", []), 1):
            sense.setdefault("id", f"{row['id']}-{gender_index}")
    dual_doc.setdefault("meta", {})["schemaVersion"] = 2
    dual_doc["meta"]["reviewedAt"] = TODAY
    dual_doc["meta"]["count"] = len(dual_doc["nouns"])
    save(dual_path, dual_doc)
    counts["dual_gender"] = len(dual_doc["nouns"])
    return counts


def confidence_for_rule(rule_id: str) -> str:
    categorical = {
        "der.suffix_ismus", "der.suffix_ling", "der.suffix_eur",
        "die.suffix_heit", "die.suffix_keit", "die.suffix_schaft",
        "die.suffix_ung", "die.suffix_ei", "die.suffix_erei",
        "die.suffix_in", "das.diminutives", "das.nominalized_infinitive",
        "das.nominalized_adjective", "die.plural_only",
    }
    strong = {
        "der.suffix_ant", "der.suffix_ner", "der.suffix_or",
        "die.suffix_ade", "die.suffix_age", "die.suffix_anz",
        "die.suffix_enz", "die.suffix_ik", "die.suffix_ion",
        "die.suffix_taet", "die.suffix_ur", "die.suffix_ie",
        "das.suffix_ial", "das.suffix_ment", "das.suffix_nis",
        "das.suffix_tum", "das.suffix_um_latin", "das.greek_ion_neuter",
    }
    heuristic = {"der.suffix_er", "die.suffix_e", "das.suffix_o", "das.prefix_ge"}
    if rule_id in categorical:
        return "categorical"
    if rule_id in strong:
        return "strong"
    if rule_id in heuristic:
        return "heuristic"
    return "semantic"


def normalise_rule_description(rule_id: str, description: str) -> str:
    replacements = {
        "All nouns ending in -ung": "Nouns genuinely formed with the productive suffix -ung",
        "Nouns ending in -ung": "Nouns genuinely formed with the productive suffix -ung",
        "Nouns ending in -ling": "Nouns genuinely formed with the suffix -ling",
        "Nouns ending in -schaft": "Nouns genuinely formed with the suffix -schaft",
        "Nouns ending in -heit": "Nouns genuinely formed with the suffix -heit",
        "Nouns ending in -keit": "Nouns genuinely formed with the suffix -keit",
        "Nouns ending in -chen or -lein": "True diminutives formed with -chen or -lein",
        "always masculine": "masculine in this productive pattern",
        "always feminine": "feminine in this productive pattern",
        "always neuter": "neuter in this productive pattern",
    }
    for old, new in replacements.items():
        description = description.replace(old, new)
    if rule_id == "der.precipitations":
        return "Several common weather phenomena are masculine, including der Regen, der Schnee, der Hagel, der Nebel, and der Tau. Fog and dew are included as weather phenomena, not classified as precipitation. Treat this as a semantic memory group, not a productive rule."
    if rule_id == "das.chemical_elements":
        description = re.sub(r"~?112", "118", description)
    if rule_id == "die.country_with_article":
        return "Feminine singular country names with a fixed article take die, for example die Schweiz, die Türkei, and die Ukraine. Other fixed-article country names form separate groups: masculine der Iran/der Irak (usage varies) and plural die Niederlande/die USA."
    return description


def normalise_article_rules() -> dict[str, int]:
    nouns_path = DATA / "nouns.json"
    rules_path = DATA / "article-rules.json"
    nouns_doc = load(nouns_path)
    rules_doc = load(rules_path)
    nouns = nouns_doc["nouns"]
    rules = rules_doc["rules"]

    # The broad plant/tree claim was shown by the audit to be too weak and
    # misleading to keep as a drill rule.
    rules.pop("die.plants_trees", None)

    exact = {(row["word"], row["article"]) for row in nouns if row.get("learnerSafe") is not False}
    for rule_id, rule in rules.items():
        rule["confidence"] = confidence_for_rule(rule_id)
        rule["source"] = "Curated learner rule; manually reviewed 2026-08-01"
        rule["description"] = normalise_rule_description(rule_id, rule.get("description", ""))
        seen: set[tuple[str, str]] = set()
        filtered = []
        for exception in rule.get("exceptions", []):
            key = (exception.get("word"), exception.get("article"))
            if key not in exact or key in seen:
                continue
            seen.add(key)
            filtered.append(exception)
        rule["exceptions"] = filtered

    verb_words = {row["word"].casefold() for row in load(DATA / "verbs.json")["verbs"]}
    false_chen_tails = (
        "zeichen", "kuchen", "knochen", "brechen", "rechen", "rachen",
        "drachen", "rochen", "groschen",
    )
    removed_mismatch = 0
    removed_false_morphology = 0
    fixed_exception_flag = 0
    for row in nouns:
        rule_id = row.get("ruleId")
        if not rule_id:
            row.pop("isException", None)
            continue
        rule = rules.get(rule_id)
        if not rule:
            row.pop("ruleId", None)
            row.pop("isException", None)
            removed_mismatch += 1
            continue
        if rule_id == "das.diminutives":
            folded = row["word"].casefold()
            false_analysis = (
                row["article"] != "das"
                or folded in verb_words
                or folded.endswith(false_chen_tails)
            )
            if false_analysis:
                row.pop("ruleId", None)
                row.pop("isException", None)
                removed_false_morphology += 1
                continue
        if row["article"] != rule["article"]:
            # A spelling coincidence is not a useful learner "exception" unless
            # it is curated in the rule's validated exception list.
            if (row["word"], row["article"]) not in {
                (exc["word"], exc["article"]) for exc in rule.get("exceptions", [])
            }:
                row.pop("ruleId", None)
                row.pop("isException", None)
                removed_mismatch += 1
                continue
            if not row.get("isException"):
                row["isException"] = True
                fixed_exception_flag += 1
        elif row.get("isException"):
            row["isException"] = False
            fixed_exception_flag += 1
        row["ruleConfidence"] = rule["confidence"]

    rules_doc.setdefault("meta", {})["version"] = 2
    rules_doc["meta"]["reviewedAt"] = TODAY
    rules_doc["meta"]["description"] = "Curated German noun-gender patterns with confidence labels and validated exceptions."
    save(rules_path, rules_doc)
    save(nouns_path, nouns_doc)
    return {
        "rules": len(rules),
        "removed_mismatched_tags": removed_mismatch,
        "removed_false_morphology_tags": removed_false_morphology,
        "fixed_exception_flags": fixed_exception_flag,
    }


def curated_help_for(row: dict, overrides_doc: dict) -> tuple[str | None, str | None]:
    override = overrides_doc.get("overrides", {}).get(row["word"])
    if override and override.get("onlyIfArticle") not in (None, row["article"]):
        override = None
    article_help = None
    plural_help = None
    if override:
        article_help = override.get("articleHelp")
        if not article_help and override.get("articleHelpKey"):
            article_help = overrides_doc.get("articleHelp", {}).get(override["articleHelpKey"])
        if override.get("pluralHelpKey"):
            plural_help = overrides_doc.get("pluralHelp", {}).get(override["pluralHelpKey"])
    return article_help, plural_help


def regenerate_noun_help() -> int:
    nouns_doc = load(DATA / "nouns.json")
    overrides = load(DATA / "noun-help-overrides.json")
    help_map: dict[str, list[str]] = {}
    for row in nouns_doc["nouns"]:
        article_help, plural_help = curated_help_for(row, overrides)
        if not article_help:
            if row.get("pluraleTantum"):
                article_help = f"Plural-only noun: learn it with die — die {row['word']}."
            elif row.get("adjectivalNoun"):
                article_help = f"Nominalised adjective: the article belongs to this represented gender and sense. Learn the complete unit {row['article']} {row['word']}."
            elif row.get("isException") and row.get("ruleId"):
                article_help = f"This sense is a documented exception to the linked learner pattern. Memorise the complete unit: {row['article']} {row['word']}."
            else:
                article_help = f"Learn the noun as a complete unit: {row['article']} {row['word']}."
            if row.get("weak"):
                article_help += " It is a weak masculine noun and takes -(e)n outside the nominative singular."

        if not plural_help:
            plural = row.get("plural", "—")
            if row.get("pluraleTantum"):
                plural_help = f"Plural-only form: die {plural if plural != '—' else row['word']}. No singular is taught for this sense."
            elif plural == "—":
                plural_help = "Normally singular-only, uncountable, or without a learner-useful plural in this recorded sense."
            elif row.get("adjectivalNoun"):
                plural_help = f"With the definite plural article, use die {plural}. Nominalised adjectives take adjective endings, so the displayed form is context-sensitive."
            else:
                plural_help = f"Plural: die {plural}. Learn the pair together: {row['article']} {row['word']} → die {plural}."
        help_map[row["id"]] = [article_help, plural_help]

    if len(help_map) != len(nouns_doc["nouns"]):
        raise ValueError("noun-help ID collision")
    help_doc = {
        "meta": {
            "version": 3,
            "schemaVersion": 2,
            "keyedBy": "noun sense ID",
            "count": len(help_map),
            "generatedAt": TODAY,
            "description": "Conservative, sense-aware article and plural help generated from exact reviewed values; no spelling-tail morphology inference.",
        },
        "help": help_map,
    }
    save(DATA / "noun-help.json", help_doc, compact=True)
    return len(help_map)


def main() -> None:
    counts = add_ids()
    rule_stats = normalise_article_rules()
    help_count = regenerate_noun_help()
    print(json.dumps({"ids": counts, "article_rules": rule_stats, "noun_help": help_count}, indent=2))


if __name__ == "__main__":
    main()
