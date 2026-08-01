#!/usr/bin/env python3
"""Normalize reviewed records after applying the editorial manifests."""

import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
def save(path, doc):
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_gloss(value):
    value = value.replace("`", "").replace("*", "")
    return re.sub(r"\s+", " ", value).strip()


noun_path = ROOT / "data" / "nouns.json"
noun_doc = json.loads(noun_path.read_text(encoding="utf-8"))
changed = 0
for row in noun_doc["nouns"]:
    if row.get("article") is None:
        row["article"] = "—"
        row["properNameOrArticleless"] = True
        row["active"] = False
        row["learnerSafe"] = False
        row["reviewStatus"] = "reference_only"
        row.pop("ruleId", None)
        row.pop("isException", None)
        row.pop("ruleConfidence", None)
        changed += 1
    row["english"] = clean_gloss(row["english"])

# Headword normalisation can make formerly different rows identical. Keep the
# highest-frequency reviewed row playable and preserve the rest as aliases.
groups = defaultdict(list)
for row in noun_doc["nouns"]:
    groups[(row["word"], row["english"])].append(row)
for duplicates in groups.values():
    if len(duplicates) < 2:
        continue
    canonical = min(duplicates, key=lambda row: row["rank"])
    for row in duplicates:
        if row is canonical:
            continue
        row["active"] = False
        row["learnerSafe"] = False
        row["reviewStatus"] = "reference_only"
        row["canonicalId"] = canonical["id"]

noun_doc["meta"]["learnerSafeCount"] = sum(
    row.get("learnerSafe") is not False and row.get("active") is not False
    for row in noun_doc["nouns"]
)
save(noun_path, noun_doc)

verb_path = ROOT / "data" / "verbs.json"
verb_doc = json.loads(verb_path.read_text(encoding="utf-8"))
forms = {
    "teilhaben": ("hatte teil", "teilgehabt", False),
    "anhaben": ("hatte an", "angehabt", False),
    "vorhaben": ("hatte vor", "vorgehabt", False),
    "innehaben": ("hatte inne", "innegehabt", False),
    "hauen": ("hieb", "gehauen", False),
    "zurückhaben": ("hatte zurück", "zurückgehabt", False),
    "draufhaben": ("hatte drauf", "draufgehabt", False),
    "wiederhaben": ("hatte wieder", "wiedergehabt", False),
    "beisammenhaben": ("hatte beisammen", "beisammengehabt", False),
    "draufhauen": ("hieb drauf", "draufgehauen", False),
    "hinauswollen": ("wollte hinaus", "hinausgewollt", False),
    "zusammenhaben": ("hatte zusammen", "zusammengehabt", False),
    "freihaben": ("hatte frei", "freigehabt", False),
    "zuhaben": ("hatte zu", "zugehabt", False),
}
for row in verb_doc["verbs"]:
    row["english"] = clean_gloss(row["english"])
    if row["word"] in forms:
        row["prateritum"], row["perfekt"], row["withSein"] = forms[row["word"]]
        row["irregular"] = True
    if row["word"] == "schliefen":
        row["active"] = False
        row["learnerSafe"] = False
        row["reviewStatus"] = "reference_only"
        row["canonicalForm"] = "schlafen"
verb_doc["meta"]["irregularCount"] = sum(bool(row.get("irregular")) for row in verb_doc["verbs"])
verb_doc["meta"]["learnerSafeCount"] = sum(row.get("learnerSafe") is not False and row.get("active") is not False for row in verb_doc["verbs"])
save(verb_path, verb_doc)

verb_prep_path = ROOT / "data" / "verbs-with-prepositions.json"
verb_prep_doc = json.loads(verb_prep_path.read_text(encoding="utf-8"))
# Convert retained review recommendations from editorial prose into concise,
# learner-facing glosses. The full audit wording remains in reviewHistory.
verb_prep_glosses = {
    "verb-prep-0301": "admire something about someone",
    "verb-prep-0365": "warm to; come around to; reconcile oneself to",
}
for row in verb_prep_doc["verbs"]:
    gloss = verb_prep_glosses.get(row.get("id"))
    if not gloss:
        continue
    row["english"] = gloss
    for sense in row.get("senses", []):
        if sense.get("default"):
            sense["english"] = gloss
        sense.pop("editorialSource", None)
save(verb_prep_path, verb_prep_doc)

adj_path = ROOT / "data" / "adjectives.json"
adj_doc = json.loads(adj_path.read_text(encoding="utf-8"))
for row in adj_doc["adjectives"]:
    row["english"] = clean_gloss(row["english"])
adj_groups = defaultdict(list)
for row in adj_doc["adjectives"]:
    adj_groups[(row["word"], row["english"])].append(row)
for duplicates in adj_groups.values():
    if len(duplicates) < 2:
        continue
    canonical = min(duplicates, key=lambda row: row["rank"])
    for row in duplicates:
        if row is canonical:
            continue
        row["active"] = False
        row["learnerSafe"] = False
        row["reviewStatus"] = "reference_only"
        row["canonicalId"] = canonical["id"]
adj_doc["meta"]["learnerSafeCount"] = sum(row.get("learnerSafe") is not False and row.get("active") is not False for row in adj_doc["adjectives"])
save(adj_path, adj_doc)

print(f"normalised {changed} articleless records; cleaned glosses, paradigms, and post-normalisation duplicates")
