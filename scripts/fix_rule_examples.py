#!/usr/bin/env python3
"""Fix rule-description slips in data/article-rules.json and the mis-tagged
nouns behind them in data/nouns.json (June 2026 review, item 3).

1. das.suffix_ial — description cited "das Sozial" (not a German word).
2. das.suffix_nis — description cited das Tennis (an English loan, not the
   deverbal -nis suffix). Tennis/Tischtennis are untagged from the rule;
   der Anis / der Penis stay as curated look-alike exceptions, which the new
   description now explains.
3. das.suffix_tum — description mixed Latin -um words (Quantum, Ultimatum)
   into the Germanic -tum rule, and 21 Latin stems (Datum + compounds,
   Faktum, Votum, Diktum, Momentum, Präteritum, Quantum, Arboretum, Rektum,
   Misstrauensvotum) were tagged das.suffix_tum. They are retagged to
   das.suffix_um_latin where they belong.
4. die.suffix_in — description reframed around the real discriminator
   (unstressed person suffix vs stressed loan ending). Junk followers are
   untagged: -medizin/-disziplin compounds, Stadtmagazin/Karrieremagazin,
   Waschbenzin, Besprechungstermin, Endorphin, Offizin, and the tagger
   accidents Kinogutschein, Kindesbein (these end in -ein, not -in) and
   Hasilein (a -lein diminutive, retagged das.diminutives). Their articleHelp
   no longer claims the female-person suffix. Curated rule exceptions
   (der Termin, das Magazin, der Delfin, ...) keep their tags.

Standalone and idempotent.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
NOUNS_PATH = ROOT / "data" / "nouns.json"
RULES_PATH = ROOT / "data" / "article-rules.json"

DESCRIPTIONS = {
    "das.suffix_ial": (
        "Latin-origin nouns ending in -ial are neuter. Examples: das Material, "
        "das Potenzial, das Editorial, das Tutorial."
    ),
    "das.suffix_nis": (
        "The Germanic suffix -nis forms abstract nouns from verbs and "
        "adjectives; most are neuter: das Ergebnis, das Zeugnis, das Ereignis, "
        "das Verständnis, das Geheimnis. A substantial minority are feminine "
        "and must be memorized: die Erlaubnis, die Erkenntnis, die Kenntnis, "
        "die Finsternis, die Wildnis. Words that merely end in -nis without "
        "the suffix (das Tennis, der Anis, der Penis) follow no pattern."
    ),
    "das.suffix_tum": (
        "The Germanic suffix -tum forms abstract and collective nouns and is "
        "neuter: das Eigentum, das Wachstum, das Brauchtum, das Altertum, "
        "das Christentum. Only two -tum nouns are masculine: der Reichtum and "
        "der Irrtum (plural -tümer: Reichtümer, Irrtümer). Latin words that "
        "happen to end in -tum (das Datum → Daten, das Faktum → Fakten, "
        "das Votum → Voten) belong to the -um (Latin) rule instead."
    ),
    "das.suffix_um_latin": (
        "Nouns of Latin origin ending in -um are neuter. Examples: das "
        "Publikum, das Museum, das Stadium, das Zentrum. Includes Latin stems "
        "in -tum: das Datum (Daten), das Faktum (Fakten), das Votum (Voten) — "
        "not to be confused with the Germanic -tum suffix (Eigentum, Reichtum)."
    ),
    "die.suffix_in": (
        "The feminine person/animal suffix -in — always UNSTRESSED, usually "
        "-erin — is 100% reliable: die Lehrerin, die Ärztin, die Königin, "
        "die Hündin; plural -innen. The test is stress: a STRESSED final -in "
        "is a loan ending, not this suffix, and those words are mostly der or "
        "das — der Termin, das Benzin, das Vitamin, das Magazin, der Delfin; "
        "chemical substances in -in are das (Insulin, Nikotin). English loans "
        "(der Muffin, das Plugin, der Admin) are not the suffix either. A few "
        "stressed loans happen to be feminine anyway: die Disziplin, die Medizin."
    ),
}
RULE_NAMES = {
    "die.suffix_in": "Suffix -in (female persons)",
}

# Latin stems wrongly under the Germanic -tum rule -> das.suffix_um_latin
LATIN_TUM = re.compile(
    r"(datum|faktum|votum|diktum|momentum|präteritum|quantum|ultimatum|arboretum|rektum)$",
    re.IGNORECASE,
)

# die.suffix_in followers that are not the suffix (curated exceptions in the
# rule file keep their tags — see KEEP check below). NB: must not catch
# genuine person nouns — "endorphin" stays specific because -sophin/-graphin
# words (die Philosophin) ARE the female-person suffix.
IN_JUNK = re.compile(
    r"(ein|izin|disziplin|magazin|benzin|termin|offizin|toxin|endorphin)$",
    re.IGNORECASE,
)

PERSON_SUFFIX_SENTENCES = [
    "Suffix pattern: -in/-erin -> die for female persons.",
    "Suffix rule: -in (female person) → always die. Die Lehrerin, die Ärztin, "
    "die Schülerin, die Kollegin. This is one of the most reliable feminine "
    "markers — 100% consistent.",
    "Suffix pattern: -in (feminine person noun) → always die. Marks the "
    "feminine form of a masculine noun. E.g. Ärztin, Freundin, Köchin, "
    "Studentin. Plural always -innen.",
]
NIS_SUFFIX_SENTENCE = (
    "Suffix pattern: -nis → often das (Ergebnis, Verständnis, Gefängnis, "
    "Geheimnis). But ~20% are die (Erkenntnis, Erlaubnis, Finsternis) — "
    "check each one."
)

IN_REPLACEMENT_AH = {
    "Disziplin": "Stressed loan -in (Latin disciplina) — NOT the female-person "
                 "suffix. Coincidentally feminine anyway: die Disziplin, like "
                 "die Medizin. Memorize it.",
    "Offizin": "Stressed loan -in (Latin officina) — not the female-person "
               "suffix, but die Offizin happens to be feminine anyway, like "
               "die Disziplin and die Medizin.",
    "Endorphin": "Chemical substances in -in are neuter: das Endorphin, das "
                 "Insulin, das Nikotin. The -in is a stressed loan ending, "
                 "not the female-person suffix.",
    "Besprechungstermin": "Compound noun — gender follows the last element: "
                          "Termin (der). The stressed -in in Termin is not "
                          "the female-person suffix.",
    "Kinogutschein": "Compound noun — gender follows the last element: "
                     "Gutschein (der). The ending is -ein (Schein), not the "
                     "-in suffix.",
    "Kindesbein": "Compound noun — gender follows the last element: Bein "
                  "(das). The ending is -ein (Bein), not the -in suffix.",
    "Waschbenzin": "Compound noun — gender follows the last element: Benzin "
                   "(das). Stressed loan -in, not the female-person suffix.",
    "Karrieremagazin": "Compound noun — gender follows the last element: "
                       "Magazin (das). Stressed loan -in, not the "
                       "female-person suffix.",
    "Stadtmagazin": "Compound noun — gender follows the last element: Magazin "
                    "(das). Stressed loan -in, not the female-person suffix.",
    "Hasilein": "Diminutive -lein → always das, overriding the base word's "
                "gender: das Hasilein (from der Hase), like das Büchlein.",
}
TENNIS_AH = (
    "English loanword — the ending is not the German abstract suffix -nis "
    "(Ergebnis-type). Games and sports as nouns are typically das: das "
    "Tennis, das Golf, das Schach."
)

SEP = " · "


def split_hints(text: str | None) -> list[str]:
    return [h for h in (text or "").split(SEP) if h.strip()]


def main() -> None:
    rules_data = json.loads(RULES_PATH.read_text(encoding="utf-8"))
    rules = rules_data["rules"]
    changes: list[str] = []

    for rid, desc in DESCRIPTIONS.items():
        if rules[rid].get("description") != desc:
            rules[rid]["description"] = desc
            changes.append(f"rule-desc: {rid}")
    for rid, name in RULE_NAMES.items():
        if rules[rid].get("name") != name:
            rules[rid]["name"] = name
            changes.append(f"rule-name: {rid} -> {name!r}")

    in_exceptions = {e["word"] for e in rules["die.suffix_in"].get("exceptions", [])}
    nis_exceptions = {e["word"] for e in rules["das.suffix_nis"].get("exceptions", [])}

    data = json.loads(NOUNS_PATH.read_text(encoding="utf-8"))
    nouns = data["nouns"]

    for n in nouns:
        word, rid = n["word"], n.get("ruleId")

        # 3. Latin -tum stems -> -um (Latin)
        if rid == "das.suffix_tum" and LATIN_TUM.search(word):
            n["ruleId"] = "das.suffix_um_latin"
            if n.get("isException"):
                n["isException"] = False
            changes.append(f"retag: das {word} -> das.suffix_um_latin")

        # 2. Tennis-class out of the -nis rule
        elif rid == "das.suffix_nis" and word.lower().endswith("tennis") \
                and word not in nis_exceptions:
            n["ruleId"] = None
            if n.get("isException"):
                n["isException"] = False
            hints = [h for h in split_hints(n.get("articleHelp")) if h != NIS_SUFFIX_SENTENCE]
            if word == "Tennis":
                hints = [TENNIS_AH]
            n["articleHelp"] = SEP.join(hints)
            changes.append(f"untag: das {word} (not the -nis suffix)")

        # 4. -in junk followers
        elif rid == "die.suffix_in" and IN_JUNK.search(word) \
                and word not in in_exceptions:
            n["ruleId"] = "das.diminutives" if word == "Hasilein" else None
            if n.get("isException"):
                n["isException"] = False
            hints = [h for h in split_hints(n.get("articleHelp"))
                     if h not in PERSON_SUFFIX_SENTENCES]
            replacement = IN_REPLACEMENT_AH.get(word)
            if replacement and replacement not in hints:
                if replacement.startswith("Compound noun"):
                    # the replacement supersedes any generic compound hint
                    hints = [replacement] + [h for h in hints if not h.startswith("Compound noun")]
                else:
                    hints.append(replacement)
            n["articleHelp"] = SEP.join(dict.fromkeys(hints))
            changes.append(f"untag: {n['article']} {word} (not the -in suffix)")

    # Repair: an earlier revision of this script matched "phin$" and wrongly
    # untagged die Philosophin (a genuine -in person noun). Restore it.
    for n in nouns:
        if n["word"] == "Philosophin" and n.get("ruleId") != "die.suffix_in":
            n["ruleId"] = "die.suffix_in"
            n["isException"] = False
            n["articleHelp"] = PERSON_SUFFIX_SENTENCES[2]
            changes.append("repair: die Philosophin re-tagged die.suffix_in")

    # ── verification ──────────────────────────────────────────────────────
    problems = []
    for n in nouns:
        rid = n.get("ruleId")
        if rid == "das.suffix_tum" and LATIN_TUM.search(n["word"]):
            problems.append(f"latin stem still in -tum rule: {n['word']}")
        if rid == "das.suffix_nis" and n["word"].lower().endswith("tennis"):
            problems.append(f"tennis still tagged -nis: {n['word']}")
        if rid == "die.suffix_in" and IN_JUNK.search(n["word"]) \
                and n["word"] not in in_exceptions:
            problems.append(f"junk still tagged -in: {n['word']}")
    tum_words = [n["word"] for n in nouns if n.get("ruleId") == "das.suffix_tum"]
    if not all(w.lower().endswith("tum") for w in tum_words):
        problems.append("non -tum word tagged das.suffix_tum")
    if "das Sozial" in rules["das.suffix_ial"]["description"]:
        problems.append("-ial description still cites das Sozial")
    if problems:
        print("VERIFICATION FAILED:")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    RULES_PATH.write_text(json.dumps(rules_data, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
    NOUNS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
    print(f"Applied {len(changes)} changes; das.suffix_tum now has {len(tum_words)} nouns")
    for c in changes:
        print("  ", c)


if __name__ == "__main__":
    main()
