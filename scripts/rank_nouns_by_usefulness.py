#!/usr/bin/env python3
"""Rank data/nouns.json by usefulness to a learner (and apply the 2026-09 gap fixes).

Why
---
`rank` decides what a learner meets first: index.html slices tiers with
`rank <= tier` (getNounsForTier), and the runners' "Top N" decks do the same.
Until 2026-09 the order was Leipzig web-corpus frequency, with course-list
nouns swapped in by CEFR band (rerank_nouns_*.js, add_cefr_levels_and_rerank.js).
That left three problems:

  * news/admin vocabulary at the head (Unternehmen 4, Verfügung 38, Maßnahme 82),
  * 1,909 corpus-frequent nouns stranded at ranks 24,001-25,947 by earlier
    appends (die Fraktion: leipzigRank 881, rank 25749),
  * everyday words that web text rarely uses sitting far down or missing
    (Zahnpasta 25676, Radiergummi 20995; Kita, Taube and Cola absent).

How the order is computed
-------------------------
Every row gets an *effective rank* (lower = more useful); `rank` is then 1..N
in that order.

1. Frequency rank, the geometric mean of two corpus ranks:
     - written: German-Words `frequency` (Leipzig web corpus, 2019);
     - spoken: OpenSubtitles 2018 word forms (FrequencyWords de_full), summed
       over the noun's singular, plural and case forms. When a form is also a
       verb or adjective form, or a function word (essen/Essen, liebe/Liebe,
       weg/Weg), the noun only gets the share of that form implied by the
       competing lemmas' written frequencies.
2. Curriculum anchor. A noun in a course deck gets an anchor rank by its
   lowest level. The Goethe exam lists (the official A1-B1 core) anchor
   earlier than textbook-only glossaries, and appearing in several deck
   collections pulls the anchor earlier. A course noun's effective rank is the
   geometric mean of its frequency rank and its anchor. A noun in no deck uses
   its frequency rank times NON_CURRICULUM_FACTOR.
3. Adjustments. Nouns in scripts/noun_everyday_core.txt move up. Austrian and
   Swiss variants move down. A derivable feminine -in form is placed just
   after its masculine. Retired duplicate rows go to the very end.

What else it does (idempotent)
------------------------------
  * appends the nouns in scripts/noun_additions_2026_09.json (skipping any
    word + article already present), with new stable ids, rule tags and help,
  * retires non-standard duplicate spellings as reference_only rows pointing
    at their canonical twin, and rewrites the deck word lists that used them,
  * repairs the split "Ja-" row into "Ja-Nein-Frage" and the "Ichs" gloss,
  * keeps the array order (new rows are appended) and every id, rewrites
    `rank` densely 1..N, realigns dual-gender-nouns.json ranks, and
    regenerates noun-help.json.

Usage
-----
  python scripts/rank_nouns_by_usefulness.py --dry-run   # report only
  python scripts/rank_nouns_by_usefulness.py             # write the data files
  node scripts/build_berlin_runner_decks.js              # then rebuild the runner bundle
and bump DATA_VERSION (and NOUNS_CORE_APPROX_BYTES) in index.html.

Inputs outside data/ live in the git-ignored sources/ folder (see SOURCES.md).
"""

from __future__ import annotations

import argparse
import bisect
import io
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SCRIPTS = ROOT / "scripts"
UPSTREAM_PATH = ROOT / "sources" / "German-Words" / "data" / "all.json"
SUBTITLES_PATH = ROOT / "sources" / "FrequencyWords-de-2018" / "de_full.txt"
ADDITIONS_PATH = SCRIPTS / "noun_additions_2026_09.json"
EVERYDAY_PATH = SCRIPTS / "noun_everyday_core.txt"
TODAY = date.today().isoformat()
RANKING_METHOD = "usefulness-v1 (scripts/rank_nouns_by_usefulness.py)"
FINDING_PREFIX = "noun-usefulness-2026-09:"
# Every reviewHistory entry this script writes is listed here, so
# validate_learner_quality.py can tell a documented change from a stray one.
MANIFEST_PATH = ROOT / "audit" / "noun-usefulness-2026-09.json"

# ── Tunables ────────────────────────────────────────────────────────────────
# Anchor ranks by curriculum level. Goethe lists are the official exam core;
# the other decks are textbook glossaries, which include many one-lesson words.
GOETHE_ANCHOR = {"A1": 250, "A2": 900, "B1": 2200}
DECK_ANCHOR = {"A1": 1200, "A2": 2000, "B1": 3000, "B2": 4500, "C1": 6500}
# Rows in no deck but with a reviewed or editorial cefrLevel (additions,
# cefrApproximate rows) get a slightly weaker anchor than deck words.
ESTIMATED_ANCHOR = {level: anchor * 1.3 for level, anchor in DECK_ANCHOR.items()}
MULTI_DECK_BONUS = 0.9          # anchor multiplier per extra deck collection
MULTI_DECK_FLOOR = 0.6          # ...but never below this multiplier
CURRICULUM_FREQ_WEIGHT = 0.5    # geometric weight of frequency vs anchor
NON_CURRICULUM_FACTOR = 1.6     # a noun on no course list must be this much more frequent
SPOKEN_WEIGHT = 0.5             # geometric weight of spoken vs written frequency
SPOKEN_MAX_GAIN = 4.0           # subtitles may lift a noun at most 4x above its written rank
NO_WRITTEN_FACTOR = 1.3         # rows missing from the written corpus rely on subtitles alone
AMBIGUITY_DOMINANCE = 10.0      # a homograph's subtitle count is trusted only if the noun reading dominates this much
EVERYDAY_FACTOR = 0.6
EVERYDAY_ANCHOR = 2000          # an everyday-list noun counts as at least an A2 course word
CURATED_UNKNOWN_FREQ = 6000     # frequency guess for a curated noun both corpora miss (Deutschlandticket postdates them)
REGIONAL_FACTOR = 4.0
DUBBING_FACTOR = 6.0            # address forms and genre words inflated by dubbed films
VULGAR_FACTOR = 5.0             # frequent in speech, but not what a learner should drill first
SECONDARY_SENSE_FACTOR = 4.0    # das Junge (cub) after der Junge (boy)
FEMININE_FACTOR = 1.25          # derivable -in form vs its own score...
FEMININE_AFTER_MASCULINE = 1.02  # ...and never ahead of its masculine

# English/French address forms and screen-genre words that dubbed films make
# look far more common in spoken German than they are.
DUBBING = {
    "Sir", "Madame", "Monsieur", "Miss", "Mister", "Lady", "Lord", "Gentleman",
    "Doc", "Sheriff", "Majestät", "Hoheit", "Lordschaft", "Amen", "Untertitel",
}
VULGAR = {"Scheiße", "Scheiß", "Arsch", "Arschloch", "Schlampe", "Penner", "Wichser", "Hure", "Miststück", "Mistkerl", "Drecksack"}
# Subtitle tokens that are mostly first names (Bob = bobsleigh, Kate = cottage,
# Ross = steed, but in films they are Bob, Kate and Ross) or colloquial clippings.
NAME_TOKENS = set("""
bob kate walker ross jack john mike max frank mark sam tom tim jim joe dan ben will bill ted ray jay lee
don ron rick nick pete peter paul ann anne rose grace hope lily amy eve may june holly joy dick chuck
ma pa mom mum dad daddy mommy werd
""".split())

LEVEL_ORDER = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5}
DECK_LEVELS = {
    "goethe-a1": "A1", "goethe-a2": "A2", "goethe-b1": "B1",
    "netzwerk-a1": "A1", "netzwerk-a2": "A2", "netzwerk-b1": "B1",
    "vielfalt-b1plus": "B1", "vielfalt-b2-1": "B2", "vielfalt-b2-2": "B2",
    "aspekte-b2": "B2", "vielfalt-c1-1": "C1", "vielfalt-c1-2": "C1",
    "aspekte-c1": "C1",
}
GOETHE_DIRS = {"goethe-a1", "goethe-a2", "goethe-b1"}

# Austrian (A) and Swiss (CH) words that the Goethe lists mark as regional
# alternatives to a standard German word. Useful in Vienna or Zurich, but a
# learner in Germany meets the standard word first.
REGIONAL = {
    "Jänner", "Feber", "Dekagramm", "Rappen", "Matura", "Marille", "Paradeiser",
    "Erdapfel", "Schwammerl", "Faschierte", "Jause", "Kuvert", "Couvert",
    "Ordination", "Stiege", "Stiegenhaus", "Pensionist", "Bankomat-Karte",
    "Schularbeit", "Zünder", "Eck", "Poulet", "Rüebli", "Brötli", "Coiffeur",
    "Coiffeuse", "Fauteuil", "Führerausweis", "Perron", "Trottoir", "Velo",
    "Zivilstand", "Topfen", "Obers", "Karfiol", "Sackerl", "Natel", "Billett",
    "Abwart", "Znüni", "Spital",
}

# Non-standard duplicate spellings → the canonical headword that stays.
# Canonical forms follow the Duden-recommended spelling.
RETIRE_DUPLICATES = [
    # (retired word, retired article, canonical word, canonical article)
    ("Online-Shop", "der", "Onlineshop", "der"),
    ("Fitness-Studio", "das", "Fitnessstudio", "das"),
    ("Wellness-Bereich", "der", "Wellnessbereich", "der"),
    ("Bio-Tonne", "die", "Biotonne", "die"),
    ("Ski-Urlaub", "der", "Skiurlaub", "der"),
    ("Bestseller-Liste", "die", "Bestsellerliste", "die"),
    ("Abend-Programm", "das", "Abendprogramm", "das"),
    ("Black-out", "der", "Blackout", "der"),
    ("Web-Adresse", "die", "Webadresse", "die"),
    ("Start-Up", "das", "Start-up", "das"),
    ("Burn-out", "der", "Burnout", "das"),
    ("AspergerSyndrom", "das", "Asperger-Syndrom", "das"),
    ("Preis-LeistungsVerhältnis", "das", "Preis-Leistungs-Verhältnis", "das"),
    ("Pro-KopfEinkommen", "das", "Pro-Kopf-Einkommen", "das"),
    ("Work-LifeBalance", "die", "Work-Life-Balance", "die"),
    ("Small", "der", "Smalltalk", "der"),          # "der Small Talk" split on import
    ("Parfum", "das", "Parfüm", "das"),
]

# The Bandwurmwörter deck (the same four tapeworm compounds the Berlin Runner
# deals from its inline MONSTER_WORDS). They are rows so the website can drill
# them like any noun, flagged `builtinDeck` so index.html builds the deck from
# the data. They rank after every other live noun: no Top-N tier deals them.
BANDWURM_DECK = "bandwurm"
BANDWURM_SOURCE = "bandwurm-deck"
BANDWURM_NOUNS = [
    {"word": "Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz", "article": "das",
     "plural": "Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetze",
     "english": "beef labelling supervision duties delegation act"},
    {"word": "Grundstücksverkehrsgenehmigungszuständigkeitsübertragungsverordnung", "article": "die",
     "plural": "Grundstücksverkehrsgenehmigungszuständigkeitsübertragungsverordnungen",
     "english": "ordinance delegating authority over land-conveyance permits"},
    {"word": "Donaudampfschifffahrtsgesellschaftskapitän", "article": "der",
     "plural": "Donaudampfschifffahrtsgesellschaftskapitäne",
     "english": "Danube steamship company captain"},
    {"word": "Kraftfahrzeughaftpflichtversicherung", "article": "die",
     "plural": "Kraftfahrzeughaftpflichtversicherungen",
     "english": "motor third-party liability insurance"},
]

# Plain plurals imported as plural-only rows (mostly from glossaries that list
# "die Getränke (Pl.)"). Each is exactly its singular row's plural field, so
# the plural drill already teaches it; retired onto the singular (2026-09-24).
# Kept as their own rows: plurals with a meaning of their own (Daten, Papiere,
# Nachrichten, Schulden, ...) and the normally-plural ones (Kopfschmerzen,
# Öffnungszeiten, Hausaufgaben, ...).
PLURAL_DUPLICATES = [
    # (retired plural, canonical singular, its article)
    ("Wohnungen", "Wohnung", "die"),
    ("Hinweise", "Hinweis", "der"),
    ("Senioren", "Senior", "der"),
    ("Steuern", "Steuer", "die"),
    ("Getränke", "Getränk", "das"),
    ("Zutaten", "Zutat", "die"),
    ("Kräuter", "Kraut", "das"),
    ("Fundsachen", "Fundsache", "die"),
    ("Ressourcen", "Ressource", "die"),
    ("Fachleute", "Fachmann", "der"),
    ("Feuerwehrleute", "Feuerwehrmann", "der"),
    ("Bergleute", "Bergmann", "der"),
    ("Landsleute", "Landsmann", "der"),
    ("Privatleute", "Privatmann", "der"),
]
# Same word, same article, same meaning: a corpus row plus a glossary import,
# or an import with a broken plural. The first id is retired onto the second.
RETIRE_BY_ID = {
    "noun-02882": "noun-00077",  # Blick, plural "plural", gloss "glances/views"
    "noun-24947": "noun-00587",  # Druck, plural "plural", gloss "prints"
    "noun-01974": "noun-00718",  # Auszubildende, plural "stored" (was drilled)
    "noun-22989": "noun-01489",  # Menü
    "noun-07759": "noun-02333",  # Arbeitsvertrag (aspekte-b2 import)
    "noun-16706": "noun-09079",  # Top, gloss "tops"
    "noun-22028": "noun-05456",  # Dachgeschoss
    "noun-12184": "noun-14494",  # Kerl, gloss "blokes/guys"
    "noun-04813": "noun-21759",  # Antiheld, plural "Anti-Helden"
}

# Rows repaired in place: id → fields to set (the headword may change).
# "_clearReferenceOnly" re-enables drilling once the record is exact.
REPAIRS = {
    # "die Ja-/Nein-Frage" was split at the slash on import.
    "noun-08338": {"_expect": "Ja-", "word": "Ja-Nein-Frage", "plural": "Ja-Nein-Fragen", "english": "yes/no question", "_clearReferenceOnly": True},
    # The plural leaked into the gloss.
    "noun-03710": {"_expect": "Ich", "english": "self/ego"},
    # Import artefact plural "stored"; der Linke declines like an adjective.
    "noun-03859": {"_expect": "Linke", "plural": "Linken", "adjectivalNoun": True},
    # Musical note names are neuter (das As = A flat); plural artefact "plural".
    "noun-19850": {"_expect": "As", "article": "das", "plural": "As"},
    # Gloss was a note to the editor.
    "noun-19020": {"_expect": "Maß", "english": "litre of beer (Bavarian)", "plural": "Maß"},

    # Core nouns the 2026-08 audit parked as reference_only because its
    # recommendation could not be applied mechanically. Each record below is
    # now exact (editorial notes removed from the gloss, the audit's plural
    # advice applied), so they are drilled again.
    "noun-00221": {"_expect": "Spaß", "_clearReferenceOnly": True},                                   # der Spaß, —, fun
    "noun-00229": {"_expect": "Alltag", "_clearReferenceOnly": True},                                   # der Alltag, —, everyday life
    "noun-00552": {"_expect": "Ausweis", "english": "ID/identification document", "_clearReferenceOnly": True},  # der Ausweis
    "noun-02155": {"_expect": "Mond", "english": "moon", "_clearReferenceOnly": True},                # der Mond
    "noun-01696": {"_expect": "Lohn", "english": "wage/pay", "_clearReferenceOnly": True},            # der Lohn
    "noun-01861": {"_expect": "Neuigkeit", "english": "piece of news/news item", "_clearReferenceOnly": True},  # die Neuigkeit
    "noun-01863": {"_expect": "Kopfhörer", "english": "headphones/earphones", "_clearReferenceOnly": True},  # der Kopfhörer
    "noun-00633": {"_expect": "Nachfrage", "_clearReferenceOnly": True},                                   # die Nachfrage
    "noun-00853": {"_expect": "Aufmerksamkeit", "english": "attention; small gift", "_clearReferenceOnly": True},  # die Aufmerksamkeit
    "noun-03318": {"_expect": "Studierende", "english": "student", "adjectivalNoun": True, "_clearReferenceOnly": True},  # der Studierende
    "noun-01005": {"_expect": "Jurist", "english": "legal professional/jurist", "_clearReferenceOnly": True},  # der Jurist
    "noun-25470": {"_expect": "Benutzername", "english": "username/login name", "_clearReferenceOnly": True},  # der Benutzername
    "noun-02616": {"_expect": "Gemeinsamkeit", "english": "common feature/thing in common", "_clearReferenceOnly": True},  # die Gemeinsamkeit
    "noun-04567": {"_expect": "Föhn", "english": "hairdryer; foehn wind", "_clearReferenceOnly": True},  # der Föhn
    "noun-03407": {"_expect": "Sucht", "english": "addiction/dependency", "_clearReferenceOnly": True},  # die Sucht
    "noun-11174": {"_expect": "Kiwi", "english": "kiwi fruit", "_clearReferenceOnly": True},          # die Kiwi
    "noun-08692": {"_expect": "Hausordnung", "english": "house rules", "_clearReferenceOnly": True},         # die Hausordnung
    "noun-09337": {"_expect": "Festspiel", "english": "festival performance", "_clearReferenceOnly": True},  # das Festspiel
    "noun-01902": {"_expect": "Parfüm", "_clearReferenceOnly": True},                                   # das Parfüm (Parfum retired onto it)
    "noun-01381": {"_expect": "Zoll", "english": "customs/customs duty", "plural": "Zölle", "_clearReferenceOnly": True},  # der Zoll
    "noun-00474": {"_expect": "Rat", "english": "advice", "plural": "—", "_clearReferenceOnly": True},  # der Rat: advice has no plural
    "noun-00587": {"_expect": "Druck", "english": "pressure", "plural": "—", "_clearReferenceOnly": True},  # der Druck
    # Learners meet the plural-only die Geschwister; the neuter singular is technical.
    "noun-01916": {"_expect": "Geschwister", "article": "die", "pluraleTantum": True, "_clearReferenceOnly": True},
}
# Deck word lists that referenced a repaired headword.
DECK_WORD_RENAMES = {"Ja-": "Ja-Nein-Frage"}

# Function words, particles, pronouns and numerals: a subtitle token that is
# one of these is never counted towards a noun (Weg/weg, Morgen/morgen, ...).
FUNCTION_WORDS = set("""
ich du er sie es wir ihr mich dich sich uns euch mir dir ihm ihn ihnen man
mein meine meinen meinem meiner meines dein deine deinen deinem deiner deines
sein seine seinen seinem seiner seines ihre ihren ihrem ihrer ihres unser unsere
unseren unserem unserer unseres euer eure euren eurem eurer eures
der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner keines
dieser diese dieses diesen diesem jener jene jenes jenen jenem welcher welche welches welchen welchem
jeder jede jedes jeden jedem alle allen allem aller alles beide beiden manche mancher manches
jemand niemand etwas nichts viel viele vielen wenig wenige mehr weniger meisten
und oder aber denn sondern doch weil dass wenn als ob damit obwohl während bevor nachdem seit seitdem bis
in im ins an am ans auf aus bei beim mit nach von vom zu zum zur über unter vor hinter neben zwischen
durch für gegen ohne um wegen trotz statt außer gegenüber entlang ab
nicht noch schon nur auch sehr so wie wo wer was wann warum wieso weshalb woher wohin
hier da dort jetzt dann heute gestern morgen bald immer nie oft manchmal wieder
ja nein bitte danke gern gerne mal eben halt eigentlich vielleicht wirklich ganz genau gleich
weg los her hin raus rein rauf runter drin draußen drinnen oben unten vorne hinten links rechts
paar bisschen zusammen allein fast kaum sogar selbst zurück vorbei heim weiter lieber besser
hallo tschüss okay ok hey oh ah na tja ach nun also etwa leid schuld recht ernst klasse spitze
null eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf zwanzig hundert tausend
erst erste ersten zweite dritte mittag abend nacht
wohl gerade fort rum au aua super irre klar echt toll prima cool egal schade bereit fertig sicher gar
sowieso trotzdem deshalb darum dazu davon dabei dafür dagegen danach daran darauf daraus darin darüber
daher dahin irgendwie irgendwo irgendwas irgendwann jemals niemals sofort später früher zuerst endlich
plötzlich natürlich wahrscheinlich bestimmt übrigens ebenfalls genauso einmal nochmal einfach total voll
ziemlich besonders überhaupt ungefähr schließlich allerdings jedoch zwar außerdem sonst hm äh ähm wow
oje ups servus moin tschau ciao bye yeah yes no sorry please
""".split())

VERB_FORM_WEIGHTS = {
    "infinitive": 0.35, "present:ich": 0.05, "present:du": 0.03, "present:es": 0.15,
    "present:ihr": 0.02, "present:Sie": 0.0, "simple:ich": 0.03, "simple:du": 0.005,
    "simple:es": 0.05, "simple:ihr": 0.005, "simple:Sie": 0.03, "imperative:du": 0.02,
    "imperative:ihr": 0.01, "perfect": 0.15, "gerund": 0.01,
}
ADJ_SUFFIX_WEIGHTS = {"": 0.4, "e": 0.2, "en": 0.2, "er": 0.08, "es": 0.05, "em": 0.04}
NOUN_FORM_WEIGHTS = {"singular": 0.65, "plural": 0.25, "dative_plural": 0.05, "genitive": 0.04, "weak": 0.05}


# ── I/O helpers that preserve each file's exact formatting ─────────────────
def read_json(path: Path):
    raw = io.open(path, encoding="utf-8", newline="").read()
    return json.loads(raw), raw


def dump_like(original_raw: str, value, *, compact: bool = False) -> str:
    if compact:
        text = json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    else:
        text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if "\r\n" in original_raw:
        text = text.replace("\n", "\r\n")
    return text


def write_text(path: Path, text: str) -> None:
    with io.open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)


# ── Rows ────────────────────────────────────────────────────────────────────
def is_retired(row: dict) -> bool:
    return row.get("active") is False or bool(row.get("canonicalId"))


def history(row: dict, action: str, disposition: str, recommendation: str, resolves: list[str] | None = None) -> None:
    entry: dict[str, object] = {
        "findingId": f"{FINDING_PREFIX}{row['id']}",
        "reviewedAt": TODAY,
        "severity": "low",
        "action": action,
        "disposition": disposition,
        "recommendation": recommendation,
    }
    if resolves:
        # Earlier findings that parked this row as reference_only; this entry closes them.
        entry["resolves"] = resolves
    row.setdefault("reviewHistory", []).append(entry)


def apply_repairs(rows: list[dict], log: list[str]) -> list[dict]:
    """Apply REPAIRS; returns the rows that changed (they are re-tagged)."""
    by_id = {row["id"]: row for row in rows}
    changed = []
    for row_id, spec in REPAIRS.items():
        fields = {k: v for k, v in spec.items() if not k.startswith("_")}
        row = by_id.get(row_id)
        if not row:
            raise SystemExit(f"repair target missing: {row_id}")
        if row["word"] not in (spec["_expect"], fields.get("word")):
            raise SystemExit(f"repair {row_id} expected {spec['_expect']!r}, found {row['word']!r}")
        clear = spec.get("_clearReferenceOnly") and row.get("learnerSafe") is False
        if all(row.get(k) == v for k, v in fields.items()) and not clear:
            continue
        before = {k: row.get(k) for k in fields}
        row.update(fields)
        resolves = None
        if clear:
            resolves = [h["findingId"] for h in row.get("reviewHistory", []) if h.get("disposition") == "reference_only"]
            for key in ("learnerSafe", "reviewStatus", "referenceOnlyReasons"):
                row.pop(key, None)
        note = f"{before} → {fields}" if fields else "record verified exact"
        if clear:
            note += "; re-enabled for drills"
        history(row, "update", "resolved" if clear else "corrected", note, resolves)
        log.append(f"repaired {row_id} {row['word']}: {note}")
        changed.append(row)
    return changed


SPELLING_DUPLICATE_REASON = "Duplicate of a canonical row with the standard spelling; retired so the word is drilled once."
PLURAL_DUPLICATE_REASON = "Plural form of the canonical row, which already carries it as its plural; retired so the word is drilled once."


def retire(row: dict, canonical: dict, log: list[str], reason_text: str = SPELLING_DUPLICATE_REASON) -> None:
    if row.get("canonicalId") == canonical["id"] and row.get("active") is False:
        return
    row["active"] = False
    row["learnerSafe"] = False
    row["reviewStatus"] = "reference_only"
    row["canonicalId"] = canonical["id"]
    reason = {
        "reason": reason_text,
        "recommendation": f"Use {canonical['article']} {canonical['word']} ({canonical['id']}).",
    }
    row["referenceOnlyReasons"] = [reason]
    history(row, "deactivate", "reference_only", reason["recommendation"])
    log.append(f"retired {row['article']} {row['word']} ({row['id']}) → {canonical['article']} {canonical['word']} ({canonical['id']})")


def apply_retirements(rows: list[dict], log: list[str]) -> dict[str, str]:
    """Retire duplicate rows. Returns {retired word: canonical word} for deck edits."""
    by_key = {}
    for row in rows:
        by_key.setdefault((row["word"], row["article"]), row)
    by_id = {row["id"]: row for row in rows}
    renames = {}
    for old_word, old_article, new_word, new_article in RETIRE_DUPLICATES:
        old = by_key.get((old_word, old_article))
        new = by_key.get((new_word, new_article))
        if not new:
            raise SystemExit(f"canonical row missing: {new_article} {new_word}")
        if old:
            retire(old, new, log)
        renames[old_word] = new_word
    for old_id, new_id in RETIRE_BY_ID.items():
        old, new = by_id[old_id], by_id[new_id]
        if old["word"] != new["word"] or old["article"] != new["article"]:
            raise SystemExit(f"RETIRE_BY_ID pairs different nouns: {old_id} {old['word']} / {new_id} {new['word']}")
        retire(old, new, log)
    for plural, singular, article in PLURAL_DUPLICATES:
        old = by_key.get((plural, "die"))
        new = by_key.get((singular, article))
        if not new:
            raise SystemExit(f"canonical row missing: {article} {singular}")
        if old and old.get("canonicalId") != new["id"]:
            # Only a true plural twin may be folded in: the singular must carry
            # exactly this plural, and the retired row must be plural-only.
            if (new.get("plural") or "").strip() != plural:
                raise SystemExit(f"{article} {singular} has plural {new.get('plural')!r}, not {plural!r}")
            if not (old.get("pluraleTantum") or old.get("plural") == plural):
                raise SystemExit(f"die {plural} ({old['id']}) is not a plural-only row")
        if old:
            retire(old, new, log, PLURAL_DUPLICATE_REASON)
        renames[plural] = singular
    return renames


def next_id(rows: list[dict]) -> int:
    numbers = [int(m.group(1)) for row in rows if (m := re.fullmatch(r"noun-(\d+)", row["id"]))]
    return max(numbers) + 1


def apply_additions(rows: list[dict], log: list[str]) -> list[dict]:
    doc = json.loads(ADDITIONS_PATH.read_text(encoding="utf-8"))
    source = doc["meta"]["source"]
    present = {(row["word"], row["article"]) for row in rows}
    counter = next_id(rows)
    added = []
    for spec in doc["nouns"]:
        if (spec["word"], spec["article"]) in present:
            continue
        level = spec["cefrLevel"]
        upper = {"A1": "A2", "A2": "B1", "B1": "B2", "B2": "C1", "C1": "C1"}[level]
        row = {
            "word": spec["word"],
            "article": spec["article"],
            "plural": spec["plural"],
            "english": spec["english"],
            "rank": 0,  # assigned below
            "leipzigRank": None,
            "manuallyAdded": True,
            "source": source,
        }
        for flag in ("pluraleTantum", "adjectivalNoun", "weak"):
            if spec.get(flag):
                row[flag] = True
        row["cefrLevel"] = level
        row["cefrApproximate"] = True
        row["cefrRange"] = [level, upper]
        row["id"] = f"noun-{counter:05d}"
        counter += 1
        history(row, "add", "added", "Learner-gap noun missing from the bank (see scripts/noun_additions_2026_09.json).")
        rows.append(row)
        added.append(row)
    if added:
        log.append(f"added {len(added)} nouns: " + ", ".join(f"{r['article']} {r['word']}" for r in added))
    return added


def apply_bandwurm_rows(rows: list[dict], log: list[str]) -> list[dict]:
    present = {(row["word"], row["article"]) for row in rows}
    counter = next_id(rows)
    added = []
    for spec in BANDWURM_NOUNS:
        if (spec["word"], spec["article"]) in present:
            continue
        row = {
            "word": spec["word"],
            "article": spec["article"],
            "plural": spec["plural"],
            "english": spec["english"],
            "rank": 0,  # assigned below
            "leipzigRank": None,
            "manuallyAdded": True,
            "source": BANDWURM_SOURCE,
            "builtinDeck": BANDWURM_DECK,
            "id": f"noun-{counter:05d}",
        }
        counter += 1
        history(row, "add", "added", "Bandwurmwörter deck noun (tapeworm compound); drilled only through its built-in deck.")
        rows.append(row)
        added.append(row)
    if added:
        log.append(f"added {len(added)} Bandwurmwörter: " + ", ".join(f"{r['article']} {r['word']}" for r in added))
    return added


def tag_rules(new_rows: list[dict]) -> None:
    """Tag rows with ruleId/isException/ruleConfidence exactly as the bank was.

    Runs scripts/tag-noun-rules.js on a temporary copy holding only these rows,
    then applies the per-row normalisation from
    migrate_learner_schema.normalise_article_rules (drop coincidental
    mismatches, keep curated exceptions, set ruleConfidence).
    """
    if not new_rows:
        return
    rules = json.loads((DATA / "article-rules.json").read_text(encoding="utf-8"))["rules"]
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / "scripts").mkdir()
        (tmp_path / "data").mkdir()
        (tmp_path / "scripts" / "tag-noun-rules.js").write_text(
            (SCRIPTS / "tag-noun-rules.js").read_text(encoding="utf-8"), encoding="utf-8")
        (tmp_path / "data" / "article-rules.json").write_text(
            (DATA / "article-rules.json").read_text(encoding="utf-8"), encoding="utf-8")
        subset = [{k: v for k, v in row.items() if k not in ("ruleId", "isException", "ruleConfidence")} for row in new_rows]
        (tmp_path / "data" / "nouns.json").write_text(json.dumps({"meta": {}, "nouns": subset}, ensure_ascii=False), encoding="utf-8")
        subprocess.run(["node", str(tmp_path / "scripts" / "tag-noun-rules.js")], check=True, capture_output=True)
        tagged = json.loads((tmp_path / "data" / "nouns.json").read_text(encoding="utf-8"))["nouns"]
    verb_words = {row["word"].casefold() for row in json.loads((DATA / "verbs.json").read_text(encoding="utf-8"))["verbs"]}
    false_chen = ("zeichen", "kuchen", "knochen", "brechen", "rechen", "rachen", "drachen", "rochen", "groschen")
    for row, result in zip(new_rows, tagged):
        for key in ("ruleId", "isException", "ruleConfidence"):
            row.pop(key, None)
        if row.get("adjectivalNoun"):
            row["ruleId"] = None  # as on every other nominalised adjective in the bank
            continue
        rule_id = result.get("ruleId")
        rule = rules.get(rule_id) if rule_id else None
        if not rule:
            continue
        if rule_id == "das.diminutives" and (row["article"] != "das" or row["word"].casefold() in verb_words or row["word"].casefold().endswith(false_chen)):
            continue
        curated = {(exc["word"], exc["article"]) for exc in rule.get("exceptions", [])}
        if row["article"] != rule["article"]:
            if (row["word"], row["article"]) not in curated:
                continue
            row["ruleId"] = rule_id
            row["isException"] = True
        else:
            row["ruleId"] = rule_id
            row["isException"] = False
        row["ruleConfidence"] = rule["confidence"]


# ── Decks ───────────────────────────────────────────────────────────────────
def deck_files():
    for dir_name in DECK_LEVELS:
        folder = DATA / dir_name
        manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        for ref in manifest.get("decks", []):
            path = folder / ref["file"]
            if path.exists():
                yield dir_name, path


def rewrite_decks(renames: dict[str, str], write: bool, log: list[str]) -> None:
    for dir_name, path in deck_files():
        deck, raw = read_json(path)
        nouns = deck.get("nouns")
        if not nouns or not any(word in renames for word in nouns):
            continue
        rewritten = []
        for word in nouns:
            word = renames.get(word, word)
            if word not in rewritten:
                rewritten.append(word)
        changed = [w for w in nouns if w in renames]
        deck["nouns"] = rewritten
        log.append(f"deck {dir_name}/{path.name}: " + ", ".join(f"{w} → {renames[w]}" for w in changed))
        if write:
            write_text(path, dump_like(raw, deck))


def deck_membership(renames: dict[str, str]) -> dict[str, set[str]]:
    membership: dict[str, set[str]] = defaultdict(set)
    for dir_name, path in deck_files():
        deck = json.loads(path.read_text(encoding="utf-8"))
        for word in deck.get("nouns", []):
            membership[str(renames.get(word, word))].add(dir_name)
    return membership


# ── Frequency signals ───────────────────────────────────────────────────────
def noun_forms(row: dict) -> dict[str, float]:
    """Lower-cased surface forms of a noun with the share of its use each carries."""
    word, plural = row["word"], (row.get("plural") or "").strip()
    forms: dict[str, float] = defaultdict(float)
    forms[word.lower()] += NOUN_FORM_WEIGHTS["singular"]
    if plural and plural not in ("—", "-") and plural != word:
        forms[plural.lower()] += NOUN_FORM_WEIGHTS["plural"]
        if not plural.endswith(("n", "s")):
            forms[(plural + "n").lower()] += NOUN_FORM_WEIGHTS["dative_plural"]
    if row["article"] in ("der", "das") and not row.get("adjectivalNoun"):
        if not word.endswith(("s", "ß", "x", "z")):
            forms[(word + "s").lower()] += NOUN_FORM_WEIGHTS["genitive"]
        else:
            forms[(word + "es").lower()] += NOUN_FORM_WEIGHTS["genitive"]
    if row.get("weak") or row.get("adjectivalNoun"):
        suffix = "n" if word.endswith("e") else "en"
        forms[(word + suffix).lower()] += NOUN_FORM_WEIGHTS["weak"]
    if row.get("adjectivalNoun"):
        forms[(word + "r").lower()] += NOUN_FORM_WEIGHTS["weak"]
    return forms


def load_upstream():
    upstream = json.loads(UPSTREAM_PATH.read_text(encoding="utf-8"))
    noun_freq: dict[str, float] = {}
    plural_freq: dict[str, float] = {}  # nominative plural → its lemma's frequency (Unterlagen → Unterlage)
    competitors: dict[str, float] = defaultdict(float)  # form → weighted frequency of verbs/adjectives
    for entry in upstream:
        kind, lemma, freq = entry.get("type"), entry.get("lemma"), entry.get("frequency") or 0.0
        if kind == "noun":
            noun_freq[lemma] = max(noun_freq.get(lemma, 0.0), freq)
            plural = ((entry.get("cases") or {}).get("nominative") or {}).get("plural")
            if plural and plural != lemma:
                plural_freq[plural] = max(plural_freq.get(plural, 0.0), freq)
        elif kind == "verb":
            forms: dict[str, float] = defaultdict(float)
            forms[lemma.lower()] += VERB_FORM_WEIGHTS["infinitive"]
            for tense in ("present", "simple", "imperative"):
                for person, form in (entry.get(tense) or {}).items():
                    if form:
                        forms[form.split()[0].lower()] += VERB_FORM_WEIGHTS.get(f"{tense}:{person}", 0.01)
            for key in ("perfect", "gerund"):
                if entry.get(key):
                    forms[entry[key].split()[-1].lower()] += VERB_FORM_WEIGHTS[key]
            for form, weight in forms.items():
                competitors[form] += freq * weight
        elif kind == "adjective":
            forms = {lemma.lower(): ADJ_SUFFIX_WEIGHTS[""]}
            for table in ("strong", "weak", "mixed"):
                for case in (entry.get(table) or {}).values():
                    for form in case.values():
                        if not form:
                            continue
                        form = form.lower()
                        suffix = form[len(lemma):] if form.startswith(lemma.lower()) else "?"
                        forms[form] = max(forms.get(form, 0.0), ADJ_SUFFIX_WEIGHTS.get(suffix, 0.05))
            for form, weight in forms.items():
                competitors[form] += freq * weight
    return noun_freq, plural_freq, competitors


def written_frequency(rows: list[dict], noun_freq: dict[str, float], plural_freq: dict[str, float]) -> dict[str, float]:
    """Written frequency per row id; rows missing upstream fall back on leipzigRank."""
    out: dict[str, float] = {}
    for row in rows:
        word = row["word"]
        freq = noun_freq.get(word)
        if freq is None and row.get("adjectivalNoun"):
            freq = noun_freq.get(word + "r")
        if freq is None:
            freq = plural_freq.get(word)  # plural-only rows are stored under their plural
        if freq:
            out[row["id"]] = freq
    # leipzigRank is the same corpus's order, so map it onto frequency.
    pairs = sorted((row["leipzigRank"], out[row["id"]]) for row in rows if row["id"] in out and row.get("leipzigRank"))
    ranks = [p[0] for p in pairs]
    for row in rows:
        if row["id"] in out or not row.get("leipzigRank"):
            continue
        i = min(bisect.bisect_left(ranks, row["leipzigRank"]), len(pairs) - 1)
        out[row["id"]] = pairs[i][1]
    return out


def spoken_frequency(rows, written, noun_freq, competitors):
    """Estimated subtitle count per row id, and whether the estimate is reliable."""
    forms_by_row = {row["id"]: noun_forms(row) for row in rows}
    needed = {form for forms in forms_by_row.values() for form in forms}
    counts: dict[str, int] = {}
    with io.open(SUBTITLES_PATH, encoding="utf-8") as handle:
        for line in handle:
            token, _, count = line.rstrip("\n").rpartition(" ")
            if token in needed:
                counts[token] = counts.get(token, 0) + int(count)
    # Noun-vs-noun competition: several lemmas can share a surface form
    # (Arme = plural of Arm and the nominalised adjective "the poor one").
    noun_claims: dict[str, float] = defaultdict(float)
    default_prior = sorted(written.values())[len(written) // 2]
    seen_words = set()
    for row in rows:
        if row["word"] in seen_words or is_retired(row):
            continue
        seen_words.add(row["word"])
        prior = noun_freq.get(row["word"]) or written.get(row["id"]) or default_prior
        for form, weight in forms_by_row[row["id"]].items():
            noun_claims[form] += prior * weight
    spoken: dict[str, float] = {}
    reliable: dict[str, bool] = {}
    for row in rows:
        prior = noun_freq.get(row["word"]) or written.get(row["id"]) or default_prior
        singular = row["word"].lower()
        total = 0.0
        trusted = True
        for form, weight in forms_by_row[row["id"]].items():
            mine = prior * weight
            others = competitors.get(form, 0.0) + max(noun_claims.get(form, 0.0) - mine, 0.0)
            if form in FUNCTION_WORDS or form in NAME_TOKENS:
                share = 0.0
            else:
                share = mine / (mine + others) if mine > 0 else 0.0
            if form == singular:
                # Subtitles are lower-cased, so a noun whose singular is also a
                # verb form, adjective form, function word or name (Essen,
                # Liebe, Weg, Bob) cannot be counted: written text is the
                # better witness. Only a clearly dominant noun reading is kept.
                if form in FUNCTION_WORDS or form in NAME_TOKENS:
                    trusted = False
                elif others > 0 and mine < AMBIGUITY_DOMINANCE * others:
                    trusted = False
            total += counts.get(form, 0) * share
        spoken[row["id"]] = total
        reliable[row["id"]] = trusted
    return spoken, reliable


def rank_positions(values: dict[str, float]) -> dict[str, int]:
    ordered = sorted((v, k) for k, v in values.items() if v > 0)
    ordered.reverse()
    return {key: i + 1 for i, (_, key) in enumerate(ordered)}


# ── Scoring ─────────────────────────────────────────────────────────────────
def load_everyday() -> set[str]:
    words = set()
    for line in EVERYDAY_PATH.read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            continue
        words.update(line.split())
    return words


def masculine_of(word: str, words: set[str]) -> str | None:
    if not word.endswith("in") or len(word) < 5:
        return None
    stem = word[:-2]
    candidates = [stem, stem + "e", stem[:-1] if stem.endswith("e") else None]
    # Umlaut undone: Ärztin → Arzt, Köchin → Koch, Französin → Franzose
    for a, b in (("ä", "a"), ("ö", "o"), ("ü", "u"), ("Ä", "A"), ("Ö", "O"), ("Ü", "U")):
        if a in stem:
            i = stem.rfind(a)
            plain = stem[:i] + b + stem[i + 1:]
            candidates += [plain, plain + "e"]
    for candidate in candidates:
        if candidate and candidate in words:
            return candidate
    return None


def score(rows, membership, written, spoken, reliable):
    web_rank = rank_positions(written)
    spoken_rank = rank_positions(spoken)
    spoken_floor = max(len(spoken_rank), 20000) + 1
    everyday = load_everyday()
    additions_source = json.loads(ADDITIONS_PATH.read_text(encoding="utf-8"))["meta"]["source"]
    effective: dict[str, float] = {}
    detail: dict[str, dict] = {}
    def blend(written_rank: float, spoken_rank_: float) -> float:
        return math.exp((1 - SPOKEN_WEIGHT) * math.log(written_rank) + SPOKEN_WEIGHT * math.log(spoken_rank_))

    for row in rows:
        rid = row["id"]
        wr = web_rank.get(rid)
        raw_sr = spoken_rank.get(rid)
        sr = raw_sr if reliable[rid] else None
        if wr and sr:
            freq_rank = max(blend(wr, sr), wr / SPOKEN_MAX_GAIN)
        elif wr and reliable[rid]:
            freq_rank = blend(wr, spoken_floor)  # never heard in films or TV at all
        elif wr:
            freq_rank = wr  # homograph: written text only
        elif sr:
            freq_rank = sr * NO_WRITTEN_FACTOR
        elif raw_sr:
            freq_rank = raw_sr * NO_WRITTEN_FACTOR * 2  # only an ambiguous subtitle count
        elif row["word"] in everyday or row.get("source") == additions_source:
            freq_rank = CURATED_UNKNOWN_FREQ  # unknown to both corpora, not rare
        else:
            freq_rank = spoken_floor * 2
        dirs = membership.get(row["word"], set())
        goethe = sorted((DECK_LEVELS[d] for d in dirs & GOETHE_DIRS), key=LEVEL_ORDER.__getitem__)
        levels = sorted((DECK_LEVELS[d] for d in dirs), key=LEVEL_ORDER.__getitem__)
        if goethe:
            anchor = GOETHE_ANCHOR[goethe[0]]
        elif levels:
            anchor = DECK_ANCHOR[levels[0]]
        elif row.get("cefrLevel") in ESTIMATED_ANCHOR:
            anchor = ESTIMATED_ANCHOR[row["cefrLevel"]]
        else:
            anchor = None
        if anchor and len(dirs) > 1:
            anchor *= max(MULTI_DECK_FLOOR, MULTI_DECK_BONUS ** (len(dirs) - 1))
        if row["word"] in everyday:
            anchor = min(anchor or math.inf, EVERYDAY_ANCHOR)
        if anchor:
            eff = math.exp(CURRICULUM_FREQ_WEIGHT * math.log(freq_rank) + (1 - CURRICULUM_FREQ_WEIGHT) * math.log(anchor))
        else:
            eff = freq_rank * NON_CURRICULUM_FACTOR
        if row["word"] in everyday:
            eff *= EVERYDAY_FACTOR
        if row["word"] in REGIONAL:
            eff *= REGIONAL_FACTOR
        if row["word"] in DUBBING:
            eff *= DUBBING_FACTOR
        if row["word"] in VULGAR:
            eff *= VULGAR_FACTOR
        effective[rid] = eff
        detail[rid] = {"web": wr, "spoken": raw_sr, "reliable": reliable[rid], "freq": round(freq_rank), "anchor": round(anchor) if anchor else None, "decks": len(dirs)}
    # A word with several live senses: the main sense keeps its place and the
    # others follow it (der Junge "boy" before das Junge "cub").
    senses: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if not is_retired(row):
            senses[row["word"]].append(row)
    for group in senses.values():
        if len(group) < 2:
            continue
        group.sort(key=lambda r: (r.get("learnerSafe") is False, r.get("leipzigRank") or 10**9, r["id"]))
        primary = effective[group[0]["id"]]
        for row in group[1:]:
            effective[row["id"]] = max(effective[row["id"]] * SECONDARY_SENSE_FACTOR, primary * FEMININE_AFTER_MASCULINE)
            detail[row["id"]]["secondarySense"] = True
    # Derivable feminine forms go just after their masculine.
    active_words = {row["word"]: row for row in rows if not is_retired(row)}
    best_by_word: dict[str, float] = {}
    for row in rows:
        if not is_retired(row):
            best_by_word[row["word"]] = min(best_by_word.get(row["word"], math.inf), effective[row["id"]])
    for row in rows:
        if row["article"] != "die" or is_retired(row):
            continue
        masc = masculine_of(row["word"], set(active_words))
        if masc and active_words[masc]["article"] == "der":
            effective[row["id"]] = max(effective[row["id"]] * FEMININE_FACTOR, best_by_word[masc] * FEMININE_AFTER_MASCULINE)
            detail[row["id"]]["feminineOf"] = masc
    return effective, detail


def write_manifest(rows: list[dict]) -> None:
    """List every reviewHistory entry this script owns (derived from the data, so re-runs agree)."""
    items = []
    for row in rows:
        for entry in row.get("reviewHistory", []):
            if str(entry.get("findingId", "")).startswith(FINDING_PREFIX):
                item = {"id": entry["findingId"], "rowId": row["id"], "word": row["word"], "article": row["article"]}
                item.update({k: entry[k] for k in ("reviewedAt", "action", "disposition", "recommendation", "resolves") if k in entry})
                items.append(item)
    items.sort(key=lambda item: item["id"])
    manifest = {
        "meta": {
            "description": "Changes made by scripts/rank_nouns_by_usefulness.py: learner-gap additions, duplicate retirements, record repairs and re-enabled reference-only rows. validate_learner_quality.py accepts these finding ids alongside the remediation manifests.",
            "findingPrefix": FINDING_PREFIX,
            "count": len(items),
        },
        "items": items,
    }
    with io.open(MANIFEST_PATH, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


# ── Main ────────────────────────────────────────────────────────────────────
def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # the report prints umlauts and arrows
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="report only; write nothing")
    parser.add_argument("--report", type=Path, help="write a TSV of the new order (word, article, rank, signals)")
    args = parser.parse_args()
    write = not args.dry_run

    nouns_path = DATA / "nouns.json"
    doc, nouns_raw = read_json(nouns_path)
    rows = doc["nouns"]
    old_rank = {row["id"]: row["rank"] for row in rows}
    log: list[str] = []

    repaired = apply_repairs(rows, log)
    renames = apply_retirements(rows, log)
    renames.update(DECK_WORD_RENAMES)
    added = apply_additions(rows, log) + apply_bandwurm_rows(rows, log)
    retag = [row for row in repaired if any(k in REPAIRS[row["id"]] for k in ("word", "article", "adjectivalNoun"))]
    tag_rules(added + retag)
    rewrite_decks(renames, write, log)
    membership = deck_membership(renames)

    # Canonical rows that inherit a deck from a retired spelling also inherit its level.
    for row in rows:
        if is_retired(row) or row["word"] not in renames.values():
            continue
        levels = sorted((DECK_LEVELS[d] for d in membership.get(row["word"], ())), key=LEVEL_ORDER.__getitem__)
        if levels and (not row.get("cefrLevel") or LEVEL_ORDER[levels[0]] < LEVEL_ORDER.get(row["cefrLevel"], 9)):
            log.append(f"cefrLevel {row['word']}: {row.get('cefrLevel')} → {levels[0]} (deck inherited from retired spelling)")
            row["cefrLevel"] = levels[0]
            row.pop("cefrApproximate", None)
            row.pop("cefrRange", None)

    noun_freq, plural_freq, competitors = load_upstream()
    written = written_frequency(rows, noun_freq, plural_freq)
    spoken, reliable = spoken_frequency(rows, written, noun_freq, competitors)
    effective, detail = score(rows, membership, written, spoken, reliable)

    # Retired rows last; deck-only rows (Bandwurmwörter) just before them.
    order = sorted(rows, key=lambda r: (is_retired(r), r.get("builtinDeck") is not None, effective[r["id"]], -(written.get(r["id"]) or 0), r["word"], r["id"]))
    for position, row in enumerate(order, start=1):
        row["rank"] = position

    report(rows, order, old_rank, membership, detail, log)
    if args.report:
        with io.open(args.report, "w", encoding="utf-8") as handle:
            handle.write("rank\told\tarticle\tword\tcefr\tdecks\tweb\tspoken\tfreq\tanchor\teffective\n")
            for row in order:
                d = detail[row["id"]]
                handle.write(f"{row['rank']}\t{old_rank.get(row['id'], '')}\t{row['article']}\t{row['word']}\t{row.get('cefrLevel') or ''}\t{d['decks']}\t{d['web'] or ''}\t{d['spoken'] or ''}\t{d['freq']}\t{d['anchor'] or ''}\t{effective[row['id']]:.0f}\n")
    if not write:
        print("\n(dry run: nothing written)")
        return

    meta = doc["meta"]
    meta["count"] = len(rows)
    meta["learnerSafeCount"] = sum(1 for row in rows if row.get("learnerSafe") is not False)
    meta["rankingMethod"] = RANKING_METHOD
    meta["rankedAt"] = TODAY
    write_text(nouns_path, dump_like(nouns_raw, doc))
    write_manifest(rows)

    dual_path = DATA / "dual-gender-nouns.json"
    dual, dual_raw = read_json(dual_path)
    best = {}
    for row in rows:
        if not is_retired(row):
            best[row["word"]] = min(best.get(row["word"], math.inf), row["rank"])
    realigned = 0
    for entry in dual["nouns"]:
        new = best.get(entry["word"])
        if new and entry.get("rank") != new:
            entry["rank"] = new
            realigned += 1
    write_text(dual_path, dump_like(dual_raw, dual))

    sys.path.insert(0, str(SCRIPTS))
    import migrate_learner_schema  # noqa: E402  (regenerates help from the exact row values)
    help_count = migrate_learner_schema.regenerate_noun_help()
    print(f"\nwrote data/nouns.json ({len(rows)} rows), realigned {realigned} dual-gender ranks, regenerated {help_count} help entries")


CHECKPOINTS = """
Mann Frau Kind Mama Papa Oma Opa Hund Katze Brot Wasser Tisch Stuhl Tür Fenster Handy Schlüssel
Unternehmen Verfügung Maßnahme Umsetzung Einrichtung Förderung Anbieter Standort Nutzung
Zahnpasta Zahnbürste Toaster Kühlschrank Korkenzieher Radiergummi Lineal Erdbeere Frosch Ameise
Kita Bürgeramt Taube Cola Deutschlandticket Probezeit Kontoauszug Kindergeld Facharzt Jura Wohngeld
Lehrerin Freundin Ärztin Sir Scheiße Arsch Wohl Liebe Essen Weg Morgen Jänner Rappen Junge Fraktion
""".split()


def report(rows, order, old_rank, membership, detail, log):
    for line in log:
        print(line)
    active = [row for row in order if not is_retired(row) and row.get("learnerSafe") is not False]
    print(f"\nrows {len(rows)}, retired {sum(1 for r in rows if is_retired(r))}, drillable {len(active)}")
    first = {}
    for row in order:
        first.setdefault(row["word"], row)
    print("\nCheckpoints (old → new):")
    cells = []
    for word in CHECKPOINTS:
        row = first.get(word)
        cells.append(f"{word} {old_rank.get(row['id'], 'new') if row else '-'}→{row['rank'] if row else '-'}")
    for i in range(0, len(cells), 6):
        print("  " + " | ".join(cells[i:i + 6]))
    print("\nTop 150:")
    print("  " + ", ".join(f"{r['word']}" for r in order[:150]))
    for lo in (500, 1000, 2000, 5000, 9950):
        print(f"\nAround {lo}:")
        print("  " + ", ".join(f"{r['word']}" for r in order[lo:lo + 30]))
    goethe = defaultdict(list)
    for row in order:
        for d in membership.get(row["word"], ()):
            if d in GOETHE_DIRS and not is_retired(row):
                goethe[DECK_LEVELS[d]].append(row["rank"])
    for level in ("A1", "A2", "B1"):
        ranks = sorted(set(goethe[level]))
        if ranks:
            pct = lambda p: ranks[min(len(ranks) - 1, int(p * len(ranks)))]
            print(f"\nGoethe {level}: {len(ranks)} nouns, median rank {pct(0.5)}, 90% by {pct(0.9)}, last {ranks[-1]}")
    course = [r for r in order if membership.get(r["word"]) and not is_retired(r)]
    print(f"course nouns ranked beyond 10000: {sum(1 for r in course if r['rank'] > 10000)} of {len(course)}")
    top = {r["id"] for r in order[:10000]}
    left = sorted((r for r in rows if old_rank.get(r["id"], 10**9) <= 10000 and r["id"] not in top), key=lambda r: old_rank[r["id"]])
    joined = [r for r in order[:10000] if old_rank.get(r["id"], 10**9) > 10000]
    print(f"\nleft the top 10000: {len(left)}; joined: {len(joined)}")
    print("  left (sample): " + ", ".join(r["word"] for r in left[:60]))
    print("  joined (sample): " + ", ".join(r["word"] for r in joined[:60]))


if __name__ == "__main__":
    main()
