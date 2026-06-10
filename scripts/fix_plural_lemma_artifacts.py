#!/usr/bin/env python3
"""Remove plural-as-lemma artifacts from data/nouns.json.

The Leipzig corpus lemmatizer occasionally emitted a plural form as its own
"lemma", with a guessed (often wrong) article and the plural gloss. June 2026
audit results:

1. DELETE outright artifacts (wrong article and/or nonsense inflection;
   the real singular entry already exists):
     der Zelte / der Zelten ("tents"  - das Zelt),
     der Romane ("novels" - der Roman), der Kanten ("edges" - die Kante),
     das Spatzen ("sparrows" - der Spatz), das Utopien ("utopias" - die Utopie),
     der Terme ("term" - der Term), der Live, der Range (not German nouns).
   Also drops them from the die.suffix_e exceptions list in
   data/article-rules.json (they polluted the "-e -> die" rule deck).

2. RE-GLOSS real words that carried the plural-derived gloss:
     die Zwecke "purposes" -> tack/drawing pin (Reißzwecke),
     die Rabatte "discounts" -> flower bed (garden).

3. FIX ARTICLE der -> die on Waise / Kriegswaise (Duden: die Waise; the der
   reading came from the same artifact pipeline). Waise also leaves the
   die.suffix_e exceptions list (it is a regular feminine -e noun).

4. RE-LABEL plural-form entries that have a living singular: their help no
   longer claims "Plurale tantum"; instead it names the singular
   (Zutaten, Senioren, Getränke, Ressourcen, Spielwaren, Arbeitsbedingungen,
   Werte, Kenntnisse, Süßigkeiten, Fundsachen, Hausaufgaben,
   Lichtverhältnisse, Körpermaße).

5. TAG true pluralia tantum with ruleId die.plural_only (mirrors the existing
   Großeltern/Pommes tagging) so the rule deck materializes:
   Eltern, Leute, Kosten (+ -kosten compounds), Daten, Medien, Ferien,
   Unkosten, Personalien, Klamotten, Schulden, Manieren, Unterlagen,
   Bewerbungsunterlagen.

Standalone and idempotent.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
NOUNS_PATH = ROOT / "data" / "nouns.json"
RULES_PATH = ROOT / "data" / "article-rules.json"

# word -> (expected article, gloss fragment as a safety check)
DELETE = {
    "Zelte": ("der", "tent"),
    "Zelten": ("der", "tent"),
    "Romane": ("der", "novel"),
    "Kanten": ("der", "edge"),
    "Spatzen": ("das", "sparrow"),
    "Utopien": ("das", "utopia"),
    "Live": ("der", "live"),
    "Terme": ("der", "term"),
    "Range": ("der", "range"),
}

REGLOSS = {
    "Zwecke": {
        "english": "tack/drawing pin (Reißzwecke)",
        "ah_extra": "Careful: as a headword die Zwecke is a tack (Reißzwecke). "
                    "The frequent form 'die Zwecke' in texts is usually the "
                    "PLURAL of der Zweck (purpose).",
    },
    "Rabatte": {
        "english": "flower bed/border (garden)",
        "ah_extra": "Careful: die Rabatte (flower bed) is a different word from "
                    "der Rabatt (discount) — whose plural also happens to be "
                    "die Rabatte.",
    },
}

FEM_E_AH = (
    "Ending pattern: ~90% of nouns ending in -e are die. This is one of the "
    "strongest gender-guessing heuristics in German. When in doubt on an -e "
    "noun, guess die."
)
WAISE_PH = (
    "+n (die Waisen). Rule: Nouns ending in -e simply add -n. Extremely "
    "consistent for feminine nouns (Straße→Straßen, Lampe→Lampen, Schule→Schulen)."
)
KRIEGSWAISE_AH = (
    "Compound noun — gender follows the last element: Waise (die). This is "
    "the #1 rule in German: always look at the final component."
)

# plural-form entries with a living singular: word -> (singular with article,
# note about usage)
PLURAL_FORM = {
    "Zutaten": ("die Zutat", "recipes list them in the plural"),
    "Senioren": ("der Senior / die Seniorin", "signs and offers address the group"),
    "Getränke": ("das Getränk", "menus use the plural"),
    "Ressourcen": ("die Ressource", "the plural is the common form"),
    "Spielwaren": ("die Spielware", "a trade term, used in the plural"),
    "Arbeitsbedingungen": ("die Arbeitsbedingung", "conditions come in sets"),
    "Werte": ("der Wert", "measurements and morals both come in the plural"),
    "Kenntnisse": ("die Kenntnis", "CVs ask for Kenntnisse in the plural"),
    "Süßigkeiten": ("die Süßigkeit", "sweets are usually plural"),
    "Fundsachen": ("die Fundsache", "lost-property offices use the plural"),
    "Hausaufgaben": ("die Hausaufgabe", "homework is usually assigned in the plural"),
    "Lichtverhältnisse": ("das Lichtverhältnis", "the singular is rare"),
    "Körpermaße": ("das Körpermaß", "measurements come in sets"),
}

PT_AH = "Plural-only noun (Pluralia tantum). It has no singular form and always uses die."
TRUE_PT = {
    "Eltern", "Leute", "Kosten", "Daten", "Medien", "Ferien", "Unkosten",
    "Personalien", "Klamotten", "Schulden", "Manieren", "Unterlagen",
    "Bewerbungsunterlagen",
}
PT_NOTE = {
    "Schulden": "The singular die Schuld exists but means guilt/fault — "
                "the money sense (debts) is plural-only.",
    "Manieren": "The singular die Manier exists but means style/manner — "
                "the etiquette sense (good manners) is plural-only.",
    "Unterlagen": "The singular die Unterlage exists but means an underlay/pad — "
                  "the paperwork sense is plural-only.",
    "Daten": "das Datum exists but means the calendar date — the data sense "
             "is plural-only.",
    "Medien": "das Medium exists, but 'the media' is a lexicalized plural.",
}


def main() -> None:
    data = json.loads(NOUNS_PATH.read_text(encoding="utf-8"))
    nouns = data["nouns"]
    changes: list[str] = []

    # ── 1. deletions ──────────────────────────────────────────────────────
    kept = []
    for n in nouns:
        spec = DELETE.get(n["word"])
        if spec and n["article"] == spec[0] and spec[1] in (n.get("english") or "").lower():
            changes.append(f"deleted: {n['article']} {n['word']} ({n.get('english')}, rank {n.get('rank')})")
            continue
        kept.append(n)
    data["nouns"] = nouns = kept
    if "meta" in data and isinstance(data["meta"].get("count"), int):
        data["meta"]["count"] = len(nouns)

    by_word: dict[str, list[dict]] = {}
    for n in nouns:
        by_word.setdefault(n["word"], []).append(n)

    def entry(word: str, article: str | None = None) -> dict | None:
        for n in by_word.get(word, []):
            if article is None or n["article"] == article:
                return n
        return None

    # ── 2. re-glosses ─────────────────────────────────────────────────────
    for word, spec in REGLOSS.items():
        n = entry(word, "die")
        if n is None:
            print(f"WARN: {word} not found"); continue
        if n.get("english") != spec["english"]:
            changes.append(f"regloss: die {word}: {n.get('english')!r} -> {spec['english']!r}")
            n["english"] = spec["english"]
        ah = n.get("articleHelp") or ""
        if spec["ah_extra"] not in ah:
            n["articleHelp"] = (ah + " · " if ah else "") + spec["ah_extra"]
            changes.append(f"regloss: die {word} [articleHelp note]")

    # ── 3. Waise / Kriegswaise article fix ────────────────────────────────
    n = entry("Waise")
    if n is not None and n["article"] == "der":
        n["article"] = "die"
        n["isException"] = False
        n["articleHelp"] = FEM_E_AH
        n["pluralHelp"] = WAISE_PH
        changes.append("article: Waise der -> die (Duden: die Waise)")
    n = entry("Kriegswaise")
    if n is not None and n["article"] == "der":
        n["article"] = "die"
        n["articleHelp"] = KRIEGSWAISE_AH
        n["pluralHelp"] = "+n (die Kriegswaisen). Compound of die Waise — plural like the base word."
        changes.append("article: Kriegswaise der -> die")

    # ── 4. plural-form entries with living singular ───────────────────────
    for word, (singular, usage) in PLURAL_FORM.items():
        n = entry(word, "die")
        if n is None:
            print(f"WARN: {word} not found"); continue
        ah = (f"Plural-form entry: the everyday plural of {singular} — {usage}. "
              f"Plural nouns always take die, whatever the singular's gender.")
        ph = (f"Plural of {singular}. The singular exists and is in use — "
              f"this entry is drilled in the plural because that is how the "
              f"word usually appears.")
        if n.get("articleHelp") != ah:
            n["articleHelp"] = ah
            changes.append(f"plural-form: die {word} [articleHelp]")
        if n.get("pluralHelp") != ph:
            n["pluralHelp"] = ph
            changes.append(f"plural-form: die {word} [pluralHelp]")
        if n.get("ruleId"):
            n["ruleId"] = None
            n["isException"] = False
            changes.append(f"plural-form: die {word} [ruleId cleared]")

    # ── 5. true pluralia tantum tagging ───────────────────────────────────
    pt_words = set(TRUE_PT)
    for n in nouns:
        if n["article"] == "die" and n["word"].endswith("kosten") and n.get("plural") == n["word"]:
            pt_words.add(n["word"])
    for word in sorted(pt_words):
        n = entry(word, "die")
        if n is None:
            print(f"WARN: PT {word} not found"); continue
        if n.get("plural") != n["word"]:
            print(f"WARN: PT {word} plural is {n.get('plural')!r}, skipping tag")
            continue
        note = PT_NOTE.get(word)
        ah = PT_AH + (f" {note}" if note else "")
        if n.get("articleHelp") != ah:
            n["articleHelp"] = ah
            changes.append(f"pt: die {word} [articleHelp]")
        if n.get("ruleId") != "die.plural_only":
            n["ruleId"] = "die.plural_only"
            n["isException"] = False
            changes.append(f"pt: die {word} [ruleId -> die.plural_only]")

    # ── 6. article-rules.json exception cleanup ───────────────────────────
    rules_data = json.loads(RULES_PATH.read_text(encoding="utf-8"))
    exc = rules_data["rules"]["die.suffix_e"]["exceptions"]
    drop = set(DELETE) | {"Waise"}
    new_exc = [e for e in exc if e.get("word") not in drop]
    if len(new_exc) != len(exc):
        removed = [e["word"] for e in exc if e.get("word") in drop]
        rules_data["rules"]["die.suffix_e"]["exceptions"] = new_exc
        changes.append(f"article-rules: removed die.suffix_e exceptions {removed}")
        RULES_PATH.write_text(json.dumps(rules_data, ensure_ascii=False, indent=2) + "\n",
                              encoding="utf-8")

    # ── verification ──────────────────────────────────────────────────────
    problems = []
    words_now = {n["word"] for n in nouns}
    for w in DELETE:
        # the deleted lemma must be gone *as that artifact* (Kanten only
        # existed as the artifact; none of these have legitimate twins)
        if any(n["word"] == w for n in nouns):
            problems.append(f"artifact still present: {w}")
    for w in ("Zelt", "Roman", "Kante", "Spatz", "Utopie", "Term"):
        if w not in words_now:
            problems.append(f"singular missing after cleanup: {w}")
    waise = entry("Waise")
    if waise is None or waise["article"] != "die":
        problems.append("Waise not feminine after fix")
    if problems:
        print("VERIFICATION FAILED:")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    NOUNS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
    print(f"Applied {len(changes)} changes; nouns now: {len(nouns)}")
    for c in changes:
        print("  ", c)


if __name__ == "__main__":
    main()
