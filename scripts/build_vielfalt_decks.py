"""Build Vielfalt C1.1 deck JSON files under data/vielfalt-c1-1/.

Reads:
  audit/glossar_parsed.json   — every glossary entry (with kind, lemma, lesson)
  audit/vielfalt_lesson_roster.json — per-lesson lemma rosters built earlier

Writes:
  data/vielfalt-c1-1/manifest.json
  data/vielfalt-c1-1/lektion-01.json … lektion-12.json
  data/vielfalt-c1-1/all.json
"""
import json
import os
import re
from collections import OrderedDict

PARSED_PATH = "audit/glossar_parsed.json"
ROSTER_PATH = "audit/vielfalt_lesson_roster.json"
VERBS_PATH = "data/verbs.json"
OUT_DIR = "data/vielfalt-c1-1"

os.makedirs(OUT_DIR, exist_ok=True)

parsed = json.load(open(PARSED_PATH, encoding="utf-8"))
roster = json.load(open(ROSTER_PATH, encoding="utf-8"))
verbs_data = json.load(open(VERBS_PATH, encoding="utf-8"))
irregular_verbs = {v["word"] for v in verbs_data.get("verbs", []) if v.get("irregular")}

# Collect lesson titles in encounter order
title_by_lesson = OrderedDict()
for e in parsed:
    if e["lektion"] and e["lektion_title"] and e["lektion"] not in title_by_lesson:
        title_by_lesson[e["lektion"]] = e["lektion_title"]


def lesson_number(lektion_label):
    m = re.match(r"Lektion\s+(\d+)", lektion_label or "")
    return int(m.group(1)) if m else 0


def slug_for_lesson(lektion_label):
    n = lesson_number(lektion_label)
    return f"lektion-{n:02d}"


def deck_id_for_lesson(lektion_label):
    return f"vielfalt-c1.1-{slug_for_lesson(lektion_label)}"


# Build per-lesson deck files
deck_files = []
for lektion_label in sorted(roster.keys(), key=lesson_number):
    n = lesson_number(lektion_label)
    title = title_by_lesson.get(lektion_label, "")
    slug = slug_for_lesson(lektion_label)
    body = roster[lektion_label]
    deck = {
        "id": deck_id_for_lesson(lektion_label),
        "name": f"Lektion {n}{': ' + title if title else ''}",
        "shortName": f"Lektion {n}",
        "lektion": n,
        "lessonTitle": title,
        "nouns": body["nouns"],
        "verbs": body["verbs"],
        "adjectives": body["adjectives"],
    }
    path = os.path.join(OUT_DIR, f"{slug}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(deck, f, ensure_ascii=False, indent=2)
    deck_files.append({"file": f"{slug}.json", "id": deck["id"], "name": deck["name"]})

# Combined "all" deck — union of every lesson's words preserving first-encounter order
all_nouns, all_verbs, all_adj = [], [], []
seen_n, seen_v, seen_a = set(), set(), set()
for lektion_label in sorted(roster.keys(), key=lesson_number):
    body = roster[lektion_label]
    for w in body["nouns"]:
        if w not in seen_n:
            all_nouns.append(w); seen_n.add(w)
    for w in body["verbs"]:
        if w not in seen_v:
            all_verbs.append(w); seen_v.add(w)
    for w in body["adjectives"]:
        if w not in seen_a:
            all_adj.append(w); seen_a.add(w)

all_deck = {
    "id": "vielfalt-c1.1-all",
    "name": "Vielfalt C1.1 — Komplettes Glossar",
    "shortName": "Komplett",
    "lektion": None,
    "lessonTitle": "All lessons combined",
    "nouns": all_nouns,
    "verbs": all_verbs,
    "adjectives": all_adj,
}
with open(os.path.join(OUT_DIR, "all.json"), "w", encoding="utf-8") as f:
    json.dump(all_deck, f, ensure_ascii=False, indent=2)
deck_files.append({"file": "all.json", "id": all_deck["id"], "name": all_deck["name"]})

vielfalt_vp_keys = [
    "verweisen|auf",
    "bewundern|an",
    "übereinstimmen|in",
    "zurückführen|auf",
    "verstehen|unter",
    "verknüpfen|mit",
    "ausgehen|von",
    "anpassen|an",
    "sich einstellen|auf",
    "einhergehen|mit",
    "stoßen|auf",
    "hindeuten|auf",
    "sich beziehen|auf",
    "führen|zu",
    "aufkommen|für",
    "erfüllen|mit",
    "sich einschreiben|an",
    "sich einschreiben|für",
    "sich entfremden|von",
    "sich richten|an",
    "investieren|in",
    "erfahren|von",
    "geradestehen|für",
    "zeugen|von",
    "mangeln|an",
]
vp_deck = {
    "id": "vielfalt-c1.1-verb-prepositions",
    "name": "Vielfalt C1.1 - Verb + Preposition",
    "shortName": "Verb + Prep",
    "description": "All fixed verb-preposition combinations from the Vielfalt C1.1 glossary.",
    "source": "Vielfalt_C1-1_Glossar_blanko.pdf",
    "verbPrepositions": vielfalt_vp_keys,
}
with open(os.path.join(OUT_DIR, "verb-prepositions.json"), "w", encoding="utf-8") as f:
    json.dump(vp_deck, f, ensure_ascii=False, indent=2)
deck_files.append({
    "file": "verb-prepositions.json",
    "id": vp_deck["id"],
    "name": vp_deck["name"],
    "kind": "verb_prepositions",
})

irregular_seen = set()
vielfalt_irregulars = []
for e in parsed:
    if e.get("kind") != "verb":
        continue
    lemma = e.get("lemma")
    if lemma in irregular_verbs and lemma not in irregular_seen:
        irregular_seen.add(lemma)
        vielfalt_irregulars.append(lemma)

irregular_deck = {
    "id": "vielfalt-c1.1-irregular-verbs",
    "name": "Vielfalt C1.1 - Irregular Verbs",
    "shortName": "Irregular Verbs",
    "description": "All irregular verbs from the Vielfalt C1.1 glossary.",
    "source": "Vielfalt_C1-1_Glossar_blanko.pdf",
    "verbForms": vielfalt_irregulars,
}
with open(os.path.join(OUT_DIR, "irregular-verbs.json"), "w", encoding="utf-8") as f:
    json.dump(irregular_deck, f, ensure_ascii=False, indent=2)
deck_files.append({
    "file": "irregular-verbs.json",
    "id": irregular_deck["id"],
    "name": irregular_deck["name"],
    "kind": "verb_forms",
})

# Manifest
manifest = {
    "id": "vielfalt-c1.1",
    "name": "C1.1 Vielfalt Glossar",
    "description": "Hueber Vielfalt C1.1 textbook (ISBN 978-3-19-201038-2) — Lernwortschatz organised by lesson.",
    "source": "Vielfalt_C1-1_Glossar_blanko.pdf",
    "decks": deck_files,
}
with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(deck_files)} deck file(s) + manifest to {OUT_DIR}/")
print(f"Combined deck: {len(all_nouns)} nouns + {len(all_verbs)} verbs + {len(all_adj)} adjectives "
      f"= {len(all_nouns) + len(all_verbs) + len(all_adj)} words")
print(f"Irregular verb deck: {len(vielfalt_irregulars)} verbs")
