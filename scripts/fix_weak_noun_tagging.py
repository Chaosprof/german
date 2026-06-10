#!/usr/bin/env python3
"""Fix weak-noun (n-Deklination) tagging in data/nouns.json.

The June 2026 audit found the weak-noun help text was applied by suffix
matching, producing three classes of error:

1. FALSE POSITIVES - words claimed weak that decline strong:
   - "-ist" hint applied to stem words (Mist, Geist + compounds, Zwist, Twist)
   - "-ent/-ant often weak" hint on strong loans (Moment, Cent, Kontinent,
     Akzent, Client, Orient, Content, Advent, Wisent, Proviant, Consultant,
     Volant, Leutnant compounds)
   - outright wrong weak markers (Autor, Käse, Mähroboter, Verarbeiter,
     Tempomat, Diakon)
2. FALSE NEGATIVES - genuinely weak nouns missing the "⚠ Weak noun" marker
   that feeds the Weak Nouns deck (Patient, Experte, Junge, Graf, Jude, ...).
3. IMPRECISE TEXT for the mixed -ns class (Name, Gedanke, Glaube, Wille,
   Friede, Buchstabe, Funke, Same, Haufe + compounds: genitive is des
   Namens, not des Namen) and for Herr (singular -n: den Herrn, plural -en:
   die Herren).

Also clears bogus suffix ruleIds (der.suffix_er / der.suffix_ner) from
adjectival nouns ("der Deutsche") that do not end in -er: the app shows the
rule text INSTEAD of the correct adjectival explanation and the wrong words
flood the "-er" rule deck.

Standalone and idempotent: re-running makes no further changes.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
NOUNS_PATH = ROOT / "data" / "nouns.json"

MARKER = "⚠ Weak noun"
SEP = " · "

GENERIC_WEAK_AH = (
    "⚠ Weak noun (n-Deklination): This noun takes -(e)n in ALL cases except "
    "nominative singular. den Menschen, dem Menschen, des Menschen. "
    "Recognizing weak nouns is crucial for correct case usage beyond just the article."
)
IST_HINT = (
    "Suffix pattern: -ist → usually der (denotes a person). E.g. Optimist, "
    "Journalist, Polizist. Also a weak noun (n-Deklination)."
)
ENT_HINT = (
    "Suffix pattern: -ent → usually der (Latin). Often a weak noun. E.g. "
    "Student→Studenten, Präsident→Präsidenten, Patient→Patienten."
)
ANT_HINT = (
    "Suffix pattern: -ant → usually der (Latin). Often also a weak noun. "
    "E.g. Elefant→Elefanten, Kandidat→Kandidaten."
)


def weak_marker_for(oblique: str) -> str:
    return (
        f"⚠ Weak noun (n-Deklination): This noun takes -(e)n in ALL cases "
        f"except nominative singular. den {oblique}, dem {oblique}, des {oblique}. "
        f"Recognizing weak nouns is crucial for correct case usage beyond just the article."
    )


def mixed_marker_for(oblique: str) -> str:
    return (
        f"⚠ Weak noun (n-Deklination), mixed type: accusative and dative add "
        f"-(e)n (den {oblique}, dem {oblique}), but the genitive adds -ns: "
        f"des {oblique}s — NOT des {oblique}. The small Name/Gedanke/Glaube/Wille "
        f"group all decline this way."
    )


def herr_marker_for(stem: str) -> str:
    return (
        f"⚠ Weak noun (n-Deklination), special: the SINGULAR adds just -n "
        f"(den {stem}n, dem {stem}n, des {stem}n), the PLURAL adds -en "
        f"(die {stem}en). Don't say *den {stem}en* for one person."
    )


# ── 1a. -ist stem words (not the suffix, not weak) ─────────────────────────
IST_STEM_NOTE = {
    "Mist": "Short native noun — the -ist ending is part of the stem, NOT the "
            "Latin -ist person suffix. Declines strong: des Mist(e)s. No rule "
            "applies; der must be memorized.",
    "Zwist": "Native noun — the -ist ending is part of the stem, NOT the Latin "
             "-ist person suffix. Declines strong: des Zwist(e)s, plural die Zwiste.",
    "Twist": "English loanword — the -ist ending is part of the stem, NOT the "
             "Latin -ist person suffix. Declines strong: des Twists, plural die Twists.",
    "Geist": "Note: -ist here is part of the stem (Geist), not the person "
             "suffix — der Geist declines strong (des Geistes) and is NOT a weak noun.",
    # Geist compounds share one note:
}
GEIST_COMPOUND_NOTE = (
    "Note: -ist here is part of Geist, not the person suffix — declines "
    "strong like der Geist (genitive -(e)s), NOT a weak noun."
)
GEIST_COMPOUNDS = [
    "Teamgeist", "Zeitgeist", "Kampfgeist", "Forschergeist", "Pioniergeist",
    "Erfindergeist", "Sportsgeist", "Plagegeist",
]

# ── 1b. strong -ent words wrongly given the "often weak" hint ──────────────
ENT_STRONG = {
    "Moment": "Moments", "Cent": "Cents", "Kontinent": "Kontinents",
    "Akzent": "Akzents", "Client": "Clients", "Orient": "Orients",
    "Content": "Contents", "Advent": "Advents", "Wisent": "Wisents",
}


def ent_strong_note(word: str, genitive: str) -> str:
    return (
        f"Suffix pattern: -ent → usually der (Latin). But unlike the -ent "
        f"person nouns (Student, Präsident, Patient — which are weak nouns), "
        f"der {word} declines strong: des {genitive}."
    )


# ── 1c. strong -ant words wrongly given the "often weak" hint ──────────────
ANT_STRONG = {
    "Proviant": "Proviants", "Consultant": "Consultants", "Volant": "Volants",
}
LEUTNANT_NOTE = (
    "Leutnant declines strong (des Leutnants) — French-origin military ranks "
    "are NOT weak nouns, unlike the Latin -ant person nouns (Elefant, Kandidat)."
)
LEUTNANT_COMPOUNDS = ["Generalleutnant", "Oberstleutnant"]


def ant_strong_note(word: str, genitive: str) -> str:
    extra = " (English loans never take n-Deklination)" if word == "Consultant" else ""
    return (
        f"Suffix pattern: -ant → usually der (Latin). But unlike the -ant "
        f"person/weak nouns (Elefant, Kandidat), der {word} declines strong: "
        f"des {genitive}{extra}."
    )


# ── 1d. wrong ⚠ markers / wrong explicit claims ────────────────────────────
AUTOR_AH_NOTE = (
    "Careful: -or nouns are NOT weak nouns — the singular declines strong "
    "(des Autors), only the plural is -en (die Autoren)."
)
AUTOR_PH = (
    "-(e)n (die Autoren). Latin -or nouns take -en in the plural with a "
    "stress shift (Autóren), but the singular declines strong: des Autors — "
    "NOT des Autoren. Same pattern: Professor, Doktor, Motor."
)
KAESE_SENTENCE = (
    "Exception: Most -e nouns are die, but 'Käse' is one of the well-known "
    "masculine exceptions. It's also a weak noun (n-Deklination): Käse→Käsen "
    "in all cases except nominative singular. These weak -e masculines must "
    "be memorized as a group."
)
KAESE_REPLACEMENT = (
    "Exception: Most -e nouns are die, but 'Käse' is one of the well-known "
    "masculine exceptions. Unlike most masculine -e nouns (which are weak: "
    "der Kunde → den Kunden), der Käse declines strong: des Käses."
)
TEMPOMAT_AH = (
    "Looks like the Automat family, but Duden gives strong declension as "
    "primary: des Tempomats, plural die Tempomate (also Tempomaten). "
    "Contrast der Automat, a true weak noun: des Automaten."
)
DIAKON_AH = (
    "Fluctuating declension: Duden gives strong des Diakons first, weak des "
    "Diakonen as a variant; plural die Diakone(n). A Greek person-loan, but "
    "not consistently weak — unlike der Patient or der Student."
)

# strong -e masculines carrying the misleading "mostly weak nouns" class text
E_STRONG_GENITIVE = {
    "Käse": "Käses",  # handled separately via KAESE_SENTENCE, kept for genitive
    "Kaffee": "Kaffees", "See": "Sees", "Tee": "Tees", "Code": "Codes",
    "Gutscheincode": "Gutscheincodes", "Cookie": "Cookies", "Service": "Services",
    "Kundenservice": "Kundenservices", "Single": "Singles", "Charme": "Charmes",
}
E_CLASS_SENTENCE = (
    "Exception: ~90% of -e nouns are die, but this is der. Masculine -e nouns "
    "are rare and mostly 'weak nouns' (n-Deklination). Worth memorizing as a set."
)


def e_strong_replacement(word: str, genitive: str) -> str:
    return (
        f"Exception: ~90% of -e nouns are die, but this is der. Many masculine "
        f"-e nouns are weak nouns (n-Deklination), but der {word} is NOT — it "
        f"declines strong: des {genitive}."
    )


# ── 2. false negatives: genuinely weak, marker missing ─────────────────────
# Verified against Duden June 2026. Oblique form = the entry's plural field.
WEAK_ADD = [
    "Patient", "Experte", "Junge", "Jurist", "Ministerpräsident", "Absolvent",
    "Spezialist", "Referent", "Dozent", "Tourist", "Automat", "Fotograf",
    "Migrant", "Komponist", "Assistent", "Konsument", "Produzent", "Praktikant",
    "Laie", "Bundespräsident", "Pädagoge", "Vizepräsident", "Athlet", "Abonnent",
    "Graf", "Jude", "Ehegatte", "Brite", "Protagonist", "Doktorand",
    "Interessent", "Psychologe", "Nationalsozialist", "Pate", "Bancomat",
    "Pensionist", "Christ", "Stadtpräsident", "Kommilitone", "Zeitzeuge",
    "Nachkomme", "Privatkunde", "Sozialdemokrat", "Agent", "Pianist", "Proband",
    "Riese", "Geldautomat", "Gastronom", "Grieche", "Repräsentant", "Neukunde",
    "Terrorist", "Theologe", "Abiturient", "Bakteriologe", "Sprachassistent",
    "Aktivist", "Telefonist", "Konzertpianist", "Verkaufsassistent", "Ökologe",
    "Feuilletonist", "Partylöwe", "Schlafexperte", "Grenzsoldat", "Essayist",
    "Mandant", "Solist", "Klickgarant", "Immigrant", "Personalexperte",
    "Kernspintomograf", "Musikerkollege", "Medienpädagoge",
    "Evolutionspsychologe", "Erziehungsexperte", "Museumspädagoge", "Ägyptologe",
    "Anglist", "Datenkrake", "Hybride", "Insasse", "Schütze", "Chirurg",
    "Russe", "Schwabe", "Sachse", "Franke", "Heide", "Adressat", "Favorit",
    "Satellit", "Paragraf", "Paragraph", "Prophet", "Pirat", "Kamerad",
    "Astronaut", "Bayer", "Krebspatient", "Konkurrent", "Dirigent", "Lieferant",
    "Demonstrant", "Ethnologe", "Marketingexperte", "Rechtsexperte",
    "Wirtschaftsexperte", "Verkehrsexperte", "Sicherheitsexperte",
]

# Caught by the weak-shape detector but genuinely strong - assert no claims.
STRONG_LEAVE_ALONE = {
    "Staat", "Bundesstaat", "Sozialstaat", "Mitgliedsstaat", "Industriestaat",
    "Stadtstaat", "Inselstaat", "Nachbarstaat", "Nationalstaat", "Rechtsstaat",
    "Freistaat", "See", "Badesee", "Stausee", "Baggersee", "Bergsee",
    "Süßwassersee", "Rundfunkrat", "Ethikrat", "Oberst", "Untertan",
}

# ── 3. mixed -ns class and Herr (programmatic by suffix) ───────────────────
MIXED_SUFFIXES = ("name", "buchstabe", "gedanke", "glaube", "wille", "friede")
MIXED_EXACT = {"Name", "Buchstabe", "Gedanke", "Glaube", "Wille", "Friede",
               "Funke", "Same", "Haufe"}

HERZ_NOTE = (
    "Special declension — das Herz is the lone neuter with weak-style forms: "
    "das Herz (acc.), dem Herzen (dat.), des Herzens (gen.)."
)


def is_mixed(word: str, article: str) -> bool:
    if article != "der":
        return False
    lw = word.lower()
    return word in MIXED_EXACT or lw.endswith(MIXED_SUFFIXES)


def is_herr(word: str, article: str) -> bool:
    return article == "der" and (word == "Herr" or word.lower().endswith("herr"))


def split_hints(text: str | None) -> list[str]:
    return [h for h in (text or "").split(SEP) if h.strip()]


def join_hints(hints: list[str]) -> str:
    return SEP.join(hints)


def oblique_for(noun: dict) -> str:
    """Weak oblique singular = plural field for true weak nouns; derive for
    plural-less mixed-class entries (Unwille -> Unwillen)."""
    plural = noun.get("plural") or ""
    if plural and plural != "—":
        return plural
    word = noun["word"]
    return word + ("n" if word.endswith("e") else "en")


def main() -> None:
    data = json.loads(NOUNS_PATH.read_text(encoding="utf-8"))
    nouns = data["nouns"]
    by_word: dict[str, list[dict]] = {}
    for n in nouns:
        by_word.setdefault(n["word"], []).append(n)

    def entry(word: str, article: str = "der") -> dict | None:
        return next((n for n in by_word.get(word, []) if n["article"] == article), None)

    changes: list[str] = []

    def set_ah(noun: dict, new: str, label: str) -> None:
        if noun.get("articleHelp") != new:
            noun["articleHelp"] = new
            changes.append(f"{label}: {noun['article']} {noun['word']} [articleHelp]")

    def set_ph(noun: dict, new: str, label: str) -> None:
        if noun.get("pluralHelp") != new:
            noun["pluralHelp"] = new
            changes.append(f"{label}: {noun['article']} {noun['word']} [pluralHelp]")

    # ── 1a. -ist stem words ────────────────────────────────────────────────
    for word, note in IST_STEM_NOTE.items():
        n = entry(word)
        if n is None:
            print(f"WARN: {word} not found"); continue
        hints = [h for h in split_hints(n.get("articleHelp"))
                 if h != IST_HINT and not h.startswith(MARKER) and h != note]
        if word == "Geist":
            hints = hints + [note]          # keep Ge- exception hint first
        else:
            hints = [note] + hints
        hints = list(dict.fromkeys(hints))  # order-preserving dedupe
        set_ah(n, join_hints(hints), "ist-stem")
    for word in GEIST_COMPOUNDS:
        n = entry(word)
        if n is None:
            print(f"WARN: {word} not found"); continue
        hints = [h for h in split_hints(n.get("articleHelp"))
                 if h != IST_HINT and not h.startswith(MARKER)]
        if GEIST_COMPOUND_NOTE not in hints:
            hints.append(GEIST_COMPOUND_NOTE)
        set_ah(n, join_hints(hints), "geist-compound")

    # ── 1b/1c. strong -ent / -ant ─────────────────────────────────────────
    for word, gen in ENT_STRONG.items():
        n = entry(word)
        if n is None:
            print(f"WARN: {word} not found"); continue
        hints = split_hints(n.get("articleHelp"))
        hints = [ent_strong_note(word, gen) if h == ENT_HINT else h for h in hints
                 if not h.startswith(MARKER)]
        if word == "Moment":  # drop the duplicated trailing -ment loanword note
            hints = [h for h in hints if not h.startswith("Loanword note: der Moment")]
        set_ah(n, join_hints(hints), "ent-strong")
    for word, gen in ANT_STRONG.items():
        n = entry(word)
        if n is None:
            print(f"WARN: {word} not found"); continue
        hints = [ant_strong_note(word, gen) if h == ANT_HINT else h
                 for h in split_hints(n.get("articleHelp")) if not h.startswith(MARKER)]
        set_ah(n, join_hints(hints), "ant-strong")
    for word in LEUTNANT_COMPOUNDS:
        n = entry(word)
        if n is None:
            print(f"WARN: {word} not found"); continue
        hints = [LEUTNANT_NOTE if h == ANT_HINT else h
                 for h in split_hints(n.get("articleHelp")) if not h.startswith(MARKER)]
        set_ah(n, join_hints(hints), "leutnant")

    # ── 1d. wrong markers / claims ────────────────────────────────────────
    n = entry("Autor")
    if n is not None:
        hints = [h for h in split_hints(n.get("articleHelp")) if not h.startswith(MARKER)]
        if AUTOR_AH_NOTE not in hints:
            hints.append(AUTOR_AH_NOTE)
        set_ah(n, join_hints(hints), "autor")
        set_ph(n, AUTOR_PH, "autor")
    for word in ("Mähroboter", "Verarbeiter"):
        n = entry(word)
        if n is None:
            print(f"WARN: {word} not found"); continue
        hints = [h for h in split_hints(n.get("articleHelp")) if not h.startswith(MARKER)]
        set_ah(n, join_hints(hints), "er-marker")
    n = entry("Käse")
    if n is not None:
        ah = (n.get("articleHelp") or "").replace(KAESE_SENTENCE, KAESE_REPLACEMENT)
        set_ah(n, ah, "kaese")
    n = entry("Tempomat")
    if n is not None:
        set_ah(n, TEMPOMAT_AH, "tempomat")
    n = entry("Diakon")
    if n is not None:
        set_ah(n, DIAKON_AH, "diakon")
    for word, gen in E_STRONG_GENITIVE.items():
        if word == "Käse":
            continue
        n = entry(word)
        if n is None:
            continue  # optional members (compounds may be absent)
        ah = (n.get("articleHelp") or "").replace(
            E_CLASS_SENTENCE, e_strong_replacement(word, gen))
        set_ah(n, ah, "e-strong")

    # ── 3. mixed -ns class ────────────────────────────────────────────────
    mixed_words = [nn for nn in nouns if is_mixed(nn["word"], nn["article"])]
    for n in mixed_words:
        obl = oblique_for(n)
        hints = []
        for h in split_hints(n.get("articleHelp")):
            if h.startswith(MARKER) or "It's also a weak noun" in h:
                continue
            hints.append(h)
        hints.append(mixed_marker_for(obl))
        set_ah(n, join_hints(hints), "mixed-ns")
    n = entry("Herz", "das")
    if n is not None:
        hints = split_hints(n.get("articleHelp"))
        if HERZ_NOTE not in hints:
            hints.append(HERZ_NOTE)
        set_ah(n, join_hints(hints), "herz")

    # ── Herr family ───────────────────────────────────────────────────────
    herr_words = [nn for nn in nouns if is_herr(nn["word"], nn["article"])]
    for n in herr_words:
        stem = n["word"]
        hints = [h for h in split_hints(n.get("articleHelp")) if not h.startswith(MARKER)]
        hints.append(herr_marker_for(stem))
        set_ah(n, join_hints(hints), "herr")
        ph = n.get("pluralHelp") or ""
        bad = f"den {stem}en, dem {stem}en, des {stem}en"
        if bad in ph:
            set_ph(n, f"-(e)n (die {stem}en). ⚠ Weak noun (n-Deklination), special: "
                      f"the singular adds just -n (den {stem}n, des {stem}n); "
                      f"the plural is -en (die {stem}en).", "herr")

    # ── 2. add missing markers ────────────────────────────────────────────
    for word in WEAK_ADD:
        n = entry(word)
        if n is None:
            print(f"WARN: weak-add {word} not found")
            continue
        ah = n.get("articleHelp") or ""
        if MARKER in ah:
            continue  # idempotent
        hints = split_hints(ah)
        hints.append(weak_marker_for(oblique_for(n)))
        set_ah(n, join_hints(hints), "weak-add")

    # ── 4. adjectival nouns: clear bogus suffix ruleIds ───────────────────
    for n in nouns:
        ah = n.get("articleHelp") or ""
        rid = n.get("ruleId")
        if (ah.startswith("Adjectival noun") and rid in ("der.suffix_er", "der.suffix_ner")
                and not n["word"].endswith("er")):
            n["ruleId"] = None
            if n.get("isException"):
                n["isException"] = False
            changes.append(f"adjectival-ruleid: der {n['word']} [ruleId cleared]")

    # ── verification net ──────────────────────────────────────────────────
    marked_now = {n["word"] for n in nouns if MARKER in (n.get("articleHelp") or "")}
    problems = []
    for word in ["Mist", "Geist", "Zwist", "Twist", "Käse", "Autor", "Mähroboter",
                 "Verarbeiter", "Tempomat", "Diakon", "Moment", "Cent", "Kontinent",
                 "Akzent", "Client", "Orient", "Content", "Advent", "Wisent",
                 "Proviant", "Consultant", "Volant"] + GEIST_COMPOUNDS + LEUTNANT_COMPOUNDS:
        if word in marked_now:
            problems.append(f"still marked weak: {word}")
    for word in WEAK_ADD + sorted(MIXED_EXACT):
        if word not in marked_now and entry(word) is not None:
            problems.append(f"missing marker: {word}")
    leftover_claims = [n["word"] for n in nouns
                       if n["word"] in (set(IST_STEM_NOTE) | set(GEIST_COMPOUNDS))
                       and "Also a weak noun" in (n.get("articleHelp") or "")]
    if leftover_claims:
        problems.append(f"leftover -ist weak claims: {leftover_claims}")
    if problems:
        print("VERIFICATION FAILED:")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    NOUNS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
    print(f"Applied {len(changes)} field changes; weak-marked nouns now: {len(marked_now)}")
    for c in changes:
        print("  ", c)


if __name__ == "__main__":
    main()
