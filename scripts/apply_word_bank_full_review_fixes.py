#!/usr/bin/env python3
"""Apply the high-confidence fixes from audit/word_bank_full_review.md."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


TRANSLATION_FIXES = {
    "nouns": {
        "Hose": "trousers/pants",
        "Feder": "feather/spring",
        "Flüchtlingskind": "refugee child",
        "Kreditgeber": "lender/creditor",
        "Frauenzeitschrift": "women's magazine",
        "Frauensache": "women's issue/matter for women",
        "Bettflüchter": "early riser",
        "Flüchtlingsarbeit": "refugee work",
        "Startelf": "starting eleven/starting lineup",
        "Eingangstor": "entrance gate",
        "Flüchtlingszahl": "number of refugees",
        "Flüchtlingsrat": "Refugee Council/refugee council",
        "Frauenfigur": "female figure/woman's figure",
        "Flüchtlingsfrage": "refugee issue/refugee question",
        "Flüchtlingskonvention": "Refugee Convention",
        "Frauenberuf": "women's profession/female-dominated occupation",
        "Ordensfrau": "nun/religious sister",
        "Lizenzgeber": "licensor",
        "Elbvertiefung": "deepening of the Elbe",
        "Schieflage": "imbalance/skewed position",
        "Flüchtlingsheim": "refugee shelter/refugee center",
        "Gottvertrauen": "trust in God",
        "Torerfolg": "goal scored/scoring success",
        "Dienstgeber": "employer",
        "Frauengruppe": "women's group",
        "Hintermann": "backer/mastermind",
        "Mittelsmann": "middleman/intermediary",
        "Privatmann": "private individual",
        "Etagenbett": "bunk bed",
        "Flüchtlingsbewegung": "refugee movement",
        "Flüchtlingsinitiative": "refugee initiative",
        "Frauenchor": "women's choir",
        "Arbeitsgeber": "employer",
        "Flüchtlingseigenschaft": "refugee status",
        "Flüchtlingssituation": "refugee situation",
        "Frauenpower": "female empowerment/women power",
        "Gottesmutter": "Mother of God",
        "Kriegsflüchtling": "war refugee",
        "Leihgeber": "lender",
        "Nationalelf": "national team",
        "Ballermann": "Ballermann/Mallorca party area",
        "Elbe": "Elbe",
        "Flüchtlingsfrau": "refugee woman",
        "Flüchtlingsschutz": "refugee protection",
        "Frauenmannschaft": "women's team",
        "Gefolgsmann": "follower/henchman",
        "Ombudsfrau": "ombudswoman",
        "Einzelbett": "single bed",
    },
    "verbs": {
        "einsperren": "lock up/imprison",
        "düngen": "fertilize/manure",
    },
    "adjectives": {
        "untreu": "disloyal/unfaithful",
        "höchstpersönlich": "in person/personal",
    },
}


REMOVE_ADJECTIVES = {"sich", "selbst"}


REMOVE_VERB_PREPOSITION_RANKS = {
    110,  # sich einer Sache entziehen
    192,  # sich einer Sache bemächtigen
    280,  # sich erbarmen: current prepositional pattern is not a good model
    298,  # misstrauen: dative object is the core pattern, not gegenüber
}


SPECIAL_PLURAL_HELP = {
    "Risiko": "-en (die Risiken). Note: das Risiko commonly forms the plural die Risiken. The +s form Risikos also exists, but this word bank stores Risiken, so learn that form here.",
    "Reis": "No plural (—). Reis is normally used as a mass noun: der Reis.",
    "Picknick": "+s (die Picknicks). Rule: Many recent loanwords and short borrowed nouns take -s in the plural.",
    "Komma": "Learned plural (die Kommata). Kommas also exists, but this word bank stores Kommata, so learn that form here.",
    "Trauma": "Learned plural (die Traumata). Traumen/Traumas may appear in some contexts, but this word bank stores Traumata, so learn that form here.",
    "Tournee": "-en (die Tourneen). Feminine borrowed nouns ending in -ee often take -n/-en in the plural.",
    "Vollmilch": "No plural (—). Vollmilch is normally used as a mass noun.",
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, doc):
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_translations(path: Path, key: str, fixes: dict[str, str]) -> int:
    doc = load(path)
    changed = 0
    for row in doc[key]:
        word = row.get("word")
        if word in fixes and row.get("english") != fixes[word]:
            row["english"] = fixes[word]
            changed += 1
    save(path, doc)
    return changed


def remove_bad_adjectives() -> int:
    path = DATA / "adjectives.json"
    doc = load(path)
    before = len(doc["adjectives"])
    doc["adjectives"] = [row for row in doc["adjectives"] if row.get("word") not in REMOVE_ADJECTIVES]
    removed = before - len(doc["adjectives"])
    doc["meta"]["count"] = len(doc["adjectives"])
    save(path, doc)
    return removed


def fix_plural_help() -> int:
    path = DATA / "nouns.json"
    doc = load(path)
    changed = 0
    for noun in doc["nouns"]:
        plural = noun.get("plural")
        plural_help = noun.get("pluralHelp") or ""
        if not plural or not plural_help:
            continue
        updated = SPECIAL_PLURAL_HELP.get(
            noun.get("word"),
            re.sub(r"\(die [^)]+\)", f"(die {plural})", plural_help, count=1),
        )
        if updated != plural_help:
            noun["pluralHelp"] = updated
            changed += 1
    save(path, doc)
    return changed


def fix_verb_prepositions() -> tuple[int, int]:
    path = DATA / "verbs-with-prepositions.json"
    doc = load(path)
    before = len(doc["verbs"])
    doc["verbs"] = [row for row in doc["verbs"] if row.get("rank") not in REMOVE_VERB_PREPOSITION_RANKS]
    removed = before - len(doc["verbs"])
    changed = 0
    for row in doc["verbs"]:
        if row.get("rank") == 356 and row.get("verb") == "ausrichten":
            row["verb"] = "sich ausrichten"
            row["english"] = "align/orient oneself with"
            row["example"] = "Das Konzept richtet sich an den Bedürfnissen der Lernenden aus."
            changed += 1
    doc["meta"]["count"] = len(doc["verbs"])
    save(path, doc)
    return removed, changed


def main():
    results = {
        "noun_translations": update_translations(DATA / "nouns.json", "nouns", TRANSLATION_FIXES["nouns"]),
        "verb_translations": update_translations(DATA / "verbs.json", "verbs", TRANSLATION_FIXES["verbs"]),
        "adjective_translations": update_translations(
            DATA / "adjectives.json", "adjectives", TRANSLATION_FIXES["adjectives"]
        ),
        "adjectives_removed": remove_bad_adjectives(),
        "plural_help_rows_touched": fix_plural_help(),
    }
    removed, changed = fix_verb_prepositions()
    results["verb_preposition_rows_removed"] = removed
    results["verb_preposition_rows_changed"] = changed
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
