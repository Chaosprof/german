"""Quality review of every word in the textbook decks.

For each deck-covered noun/verb/adjective, look up its central entry
(data/nouns.json, verbs.json, adjectives.json) and run high-confidence
linguistic checks:

  - article correctness (suffix rules + ruleId/article agreement)
  - plural correctness (suffix-driven plural forms, diminutives, -in)
  - translation quality (missing, US spelling, dual UK/US gloss)
  - rule-help consistency (articleHelp/pluralHelp vs the actual fields)
  - verb completeness (irregulars need Prateritum + Perfekt)
  - deck words missing from the central bank (unreviewable data gaps)

Writes audit/deck_word_review.md and prints a summary.
"""
import json
import re
import random
from collections import defaultdict
from pathlib import Path

DECK_DIRS = [
    "data/goethe-a1", "data/goethe-a2", "data/goethe-b1",
    "data/netzwerk-a1", "data/netzwerk-a2", "data/netzwerk-b1",
    "data/vielfalt-b1plus", "data/vielfalt-b2-1", "data/vielfalt-b2-2",
    "data/aspekte-b2", "data/vielfalt-c1-1", "data/vielfalt-c1-2",
    "data/aspekte-c1",
]


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


# ---- collect deck membership -------------------------------------------------
def collect_deck_words():
    by_kind = {"nouns": defaultdict(set), "verbs": defaultdict(set),
               "adjectives": defaultdict(set)}
    for dir_ in DECK_DIRS:
        try:
            manifest = load(f"{dir_}/manifest.json")
        except FileNotFoundError:
            continue
        label = dir_.split("/")[-1]
        for ref in manifest["decks"]:
            try:
                deck = load(f"{dir_}/{ref['file']}")
            except FileNotFoundError:
                continue
            for kind in ("nouns", "verbs", "adjectives"):
                for w in deck.get(kind) or []:
                    by_kind[kind][w].add(label)
    return by_kind


# ---- article suffix rules ----------------------------------------------------
# (suffix, expected_article, exception_set) — only very high-confidence suffixes.
ARTICLE_SUFFIX = [
    ("heit", "die", set()),
    ("keit", "die", set()),
    ("schaft", "die", {"Geschaft"}),  # Geschäft handled via umlaut anyway
    ("ung", "die", {"Sprung", "Ursprung", "Aufschwung", "Schwung", "Dung",
                    "Schwung", "Rückgang"}),
    ("tät", "die", set()),
    ("tion", "die", set()),
    ("sion", "die", set()),
    ("ling", "der", set()),
    ("ismus", "der", set()),
    ("lein", "das", set()),
    ("tum", "das", {"Reichtum", "Irrtum"}),
    ("ment", "das", {"Moment", "Zement", "Pigment"}),  # der Moment (das also exists)
    ("chen", "das", {"Kuchen", "Knochen", "Drachen", "Rachen", "Braten",
                     "Haken", "Laken", "Zeichen", "Verbrechen", "Streichen",
                     "Lebkuchen", "Pfannkuchen", "Brauchen"}),
]

# -ik mostly die; -ion mostly die but more exceptions; -or, -um lower-confidence
ARTICLE_SUFFIX_SOFT = [
    ("ik", "die", {"Mosaik", "Katholik", "Sputnik", "Beatnik"}),
    ("ion", "die", {"Spion", "Skorpion", "Champion", "Stadion", "Ion"}),
    ("um", "das", {"Reichtum", "Irrtum", "Konsum", "Brachium", "Bumerang"}),
    ("or", "der", {"Labor", "Tor", "Moor", "Chlor", "Empor"}),
    ("nis", "das", set()),   # das/die mixed (das Ergebnis vs die Erlaubnis)
    ("e", "die", set()),     # very many exceptions (der Name, das Auge); informational only
]


def check_article(word, art, ruleid, rules):
    """Return list of (severity, message) issues for the article."""
    issues = []
    if art not in ("der", "die", "das"):
        issues.append(("ERROR", f"article '{art}' is not der/die/das"))
        return issues
    # ruleId must agree with the stored article. NB: a mismatch here does NOT
    # mean the article is wrong (it is usually correct) — it means the RULE we
    # display to the learner argues for the wrong gender. Separate category.
    if ruleid and ruleid in rules:
        exp = rules[ruleid].get("article")
        if exp and exp != art:
            issues.append(("TAG",
                           f"ruleId {ruleid} implies '{exp}' but article is '{art}'"))
    # hard suffix rules
    for suf, exp, exc in ARTICLE_SUFFIX:
        if word.endswith(suf) and word not in exc and len(word) > len(suf) + 1:
            if art != exp:
                issues.append(("HIGH",
                               f"-{suf} suffix predicts '{exp}', stored '{art}'"))
    # soft suffix rules
    for suf, exp, exc in ARTICLE_SUFFIX_SOFT:
        if suf == "e":
            continue  # too noisy
        if word.endswith(suf) and word not in exc and len(word) > len(suf) + 1:
            if art != exp:
                issues.append(("MED",
                               f"-{suf} suffix usually '{exp}', stored '{art}'"))
    return issues


# ---- plural rules ------------------------------------------------------------
NO_PLURAL_MARKERS = {"", "-", "—", "–", "kein Plural", None, "(kein Plural)"}


def check_plural(word, art, plural):
    issues = []
    if plural in NO_PLURAL_MARKERS:
        return issues  # uncountable / not asserted — not an error by itself
    pl = plural.strip()

    # feminine -in agent nouns: plural must double the n -> -innen
    if art == "die" and word.endswith("in") and not word.endswith("ein"):
        if not pl.endswith("innen"):
            issues.append(("HIGH",
                           f"feminine -in noun: plural should end -innen, got '{pl}'"))
    # die + derivational suffixes -> +en (Zeitung->Zeitungen)
    for suf in ("ung", "heit", "keit", "schaft", "ion", "tät", "ik", "ur",
                "enz", "anz"):
        if art == "die" and word.endswith(suf):
            expected = word + "en"
            if pl != expected and not pl.endswith(suf + "en"):
                issues.append(("MED",
                               f"die -{suf} noun: expected plural '{expected}', got '{pl}'"))
            break
    # diminutives unchanged in plural
    for suf in ("chen", "lein"):
        if word.endswith(suf) and art == "das":
            if pl != word:
                issues.append(("MED",
                               f"diminutive -{suf}: plural is usually unchanged '{word}', got '{pl}'"))
    # plural should not equal a bare article or be obviously malformed
    if pl in ("der", "die", "das"):
        issues.append(("ERROR", f"plural '{pl}' looks like an article"))
    # plural should generally contain the stem (first 4 chars) — catches mismatched rows
    stem = word[:4].lower()
    if len(word) >= 5 and stem and stem not in pl.lower() and not pl.startswith("¨"):
        # umlauted plurals change vowels, so only flag when first 2 chars differ too
        if word[:2].lower() != pl[:2].lower():
            issues.append(("MED", f"plural '{pl}' shares no stem with '{word}'"))
    return issues


# ---- plural-help / article-help consistency ---------------------------------
PAREN_RE = re.compile(r"\((der|die|das)\s+([^)]+)\)")


def check_help_consistency(word, art, plural, article_help, plural_help):
    issues = []
    # pluralHelp typically begins "-e (die Jahre)…"; the parenthetical should
    # match article(plural-form) of THIS noun.
    if plural_help and plural not in NO_PLURAL_MARKERS:
        m = PAREN_RE.search(plural_help)
        if m:
            help_art, help_form = m.group(1), m.group(2).strip()
            # plural article is always "die"; help should say die
            if help_art != "die":
                issues.append(("LOW",
                               f"pluralHelp parenthetical uses '{help_art}', plural article is die"))
            if help_form.lower() != plural.strip().lower():
                issues.append(("MED",
                               f"pluralHelp says plural '{help_form}' but plural field is '{plural}'"))
    return issues


# ---- translation quality -----------------------------------------------------
US_PATTERNS = [
    (r"\bcolor", "colour"), (r"\bflavor", "flavour"), (r"\bbehavior", "behaviour"),
    (r"\bneighbor", "neighbour"), (r"\bhonor\b", "honour"), (r"\bfavor", "favour"),
    (r"\bharbor", "harbour"), (r"\bvapor", "vapour"), (r"\bodor", "odour"),
    (r"\bhumor\b", "humour"), (r"\brumor", "rumour"), (r"\bvigor", "vigour"),
    (r"\bsplendor", "splendour"), (r"\blabor\b", "labour"),
    (r"\bcenter", "centre"), (r"\btheater", "theatre"), (r"\bliter\b", "litre"),
    (r"\bfiber", "fibre"), (r"\bsomber", "sombre"), (r"\bmeager", "meagre"),
    (r"\bdefense", "defence"), (r"\boffense", "offence"), (r"\bpretense", "pretence"),
    (r"\btraveler", "traveller"), (r"\btraveling", "travelling"),
    (r"\bcanceled", "cancelled"), (r"\bmodeling", "modelling"),
    (r"\bjewelry", "jewellery"), (r"\bgray\b", "grey"),
    (r"\bmold\b", "mould"), (r"\bplow", "plough"), (r"\bskillful", "skilful"),
    (r"\bfulfill\b", "fulfil"), (r"\benroll\b", "enrol"),
    (r"\baluminum", "aluminium"), (r"\bmustache", "moustache"),
    (r"\bartifact", "artefact"), (r"\bcozy", "cosy"),
    (r"ization\b", "isation"), (r"\borganiz", "organis"),
    (r"\brealiz", "realis"), (r"\brecogniz", "recognis"),
    (r"\bapologiz", "apologis"), (r"\bemphasiz", "emphasis"),
    (r"\bcatalog\b", "catalogue"), (r"\banalyze", "analyse"),
]
US_RE = [(re.compile(p, re.I), brit) for p, brit in US_PATTERNS]


def check_translation(english):
    issues = []
    if not english or not english.strip():
        issues.append(("ERROR", "missing English gloss"))
        return issues
    e = english
    for rx, brit in US_RE:
        if rx.search(e):
            # avoid false positive when British form already present in same gloss
            if brit.lower() in e.lower():
                issues.append(("LOW", f"gloss contains both US and UK forms ('{rx.pattern}' & '{brit}')"))
            else:
                issues.append(("MED", f"US spelling — '{rx.pattern}' should be '{brit}'"))
    # leftover German/markup artifacts
    if re.search(r"[äöüßÄÖÜ]", e):
        issues.append(("LOW", "gloss still contains German letters"))
    if "TODO" in e or "???" in e or e.strip() in ("-", "—"):
        issues.append(("ERROR", f"placeholder gloss '{e}'"))
    return issues


def main():
    random.seed(42)
    by_kind = collect_deck_words()
    nouns = {n["word"]: n for n in load("data/nouns.json")["nouns"]}
    verbs = {v["word"]: v for v in load("data/verbs.json")["verbs"]}
    adjs = {a["word"]: a for a in load("data/adjectives.json")["adjectives"]}
    rules = load("data/article-rules.json")["rules"]

    findings = defaultdict(list)   # category -> list of strings
    sev_count = defaultdict(int)
    missing = {"nouns": [], "verbs": [], "adjectives": []}

    # ---- nouns ----
    for word in sorted(by_kind["nouns"]):
        n = nouns.get(word)
        if not n:
            missing["nouns"].append(word)
            continue
        art = n.get("article", "")
        plural = n.get("plural", "")
        for sev, msg in check_article(word, art, n.get("ruleId"), rules):
            cat = "ruletag" if sev == "TAG" else "article"
            findings[cat].append((sev, word, art, msg))
            sev_count[sev] += 1
        for sev, msg in check_plural(word, art, plural):
            findings["plural"].append((sev, word, f"{art} {word}, pl {plural}", msg))
            sev_count[sev] += 1
        for sev, msg in check_help_consistency(word, art, plural,
                                               n.get("articleHelp", ""),
                                               n.get("pluralHelp", "")):
            findings["help"].append((sev, word, "", msg))
            sev_count[sev] += 1
        for sev, msg in check_translation(n.get("english", "")):
            findings["translation"].append((sev, word, n.get("english", ""), msg))
            sev_count[sev] += 1
        if not n.get("articleHelp"):
            findings["help"].append(("LOW", word, "", "no articleHelp text"))
            sev_count["LOW"] += 1
        if not n.get("pluralHelp") and plural not in NO_PLURAL_MARKERS:
            findings["help"].append(("LOW", word, "", "no pluralHelp text"))
            sev_count["LOW"] += 1

    # ---- verbs ----
    for word in sorted(by_kind["verbs"]):
        v = verbs.get(word)
        if not v:
            missing["verbs"].append(word)
            continue
        for sev, msg in check_translation(v.get("english", "")):
            findings["translation"].append((sev, word, v.get("english", ""), msg))
            sev_count[sev] += 1
        if v.get("irregular"):
            if not v.get("prateritum"):
                findings["verb"].append(("HIGH", word, "", "irregular verb missing Präteritum"))
                sev_count["HIGH"] += 1
            if not v.get("perfekt"):
                findings["verb"].append(("HIGH", word, "", "irregular verb missing Perfekt"))
                sev_count["HIGH"] += 1

    # ---- adjectives ----
    for word in sorted(by_kind["adjectives"]):
        a = adjs.get(word)
        if not a:
            missing["adjectives"].append(word)
            continue
        for sev, msg in check_translation(a.get("english", "")):
            findings["translation"].append((sev, word, a.get("english", ""), msg))
            sev_count[sev] += 1

    # ---- write report ----
    out = Path("audit/deck_word_review.md")
    order = {"ERROR": 0, "HIGH": 1, "MED": 2, "TAG": 2, "LOW": 3}
    with out.open("w", encoding="utf-8") as f:
        f.write("# Textbook deck word review\n\n")
        f.write(f"Deck-covered unique lemmas: **{len(by_kind['nouns'])} nouns, "
                f"{len(by_kind['verbs'])} verbs, {len(by_kind['adjectives'])} adjectives** "
                f"= {len(by_kind['nouns'])+len(by_kind['verbs'])+len(by_kind['adjectives'])} total.\n\n")
        f.write("## Severity totals\n\n")
        for sev in ("ERROR", "HIGH", "MED", "TAG", "LOW"):
            f.write(f"- **{sev}**: {sev_count[sev]}\n")
        f.write("\n")
        # ruletag breakdown by rule
        tagcount = defaultdict(int)
        for sev, word, ctx, msg in findings["ruletag"]:
            rid = msg.split()[1]
            tagcount[rid] += 1
        f.write("### Rule-tagging mismatches by rule\n\n")
        for rid, c in sorted(tagcount.items(), key=lambda x: -x[1]):
            f.write(f"- `{rid}`: {c}\n")
        f.write("\n")

        f.write("## Deck words missing from the central bank (unreviewable)\n\n")
        for kind in ("nouns", "verbs", "adjectives"):
            f.write(f"- {kind}: {len(missing[kind])}")
            if missing[kind]:
                f.write(" — " + ", ".join(missing[kind][:40]))
                if len(missing[kind]) > 40:
                    f.write(f" … (+{len(missing[kind])-40} more)")
            f.write("\n")
        f.write("\n")

        for cat, title in [("article", "Article issues (suffix-predicted — candidate real errors)"),
                           ("ruletag", "Rule-tagging issues (displayed rule contradicts correct article)"),
                           ("plural", "Plural issues"),
                           ("translation", "Translation issues"),
                           ("help", "Rule-help issues"),
                           ("verb", "Verb form issues")]:
            items = sorted(findings[cat], key=lambda x: (order.get(x[0], 9), x[1]))
            f.write(f"## {title} ({len(items)})\n\n")
            # show all ERROR/HIGH/MED; cap LOW
            shown = 0
            for sev, word, ctx, msg in items:
                if sev == "LOW" and shown > 400:
                    continue
                ctxs = f" [{ctx}]" if ctx else ""
                f.write(f"- **{sev}** `{word}`{ctxs}: {msg}\n")
                shown += 1
            f.write("\n")

    # ---- console summary ----
    print(f"nouns={len(by_kind['nouns'])} verbs={len(by_kind['verbs'])} "
          f"adjectives={len(by_kind['adjectives'])}")
    print("severity:", dict(sev_count))
    print("missing-from-bank:", {k: len(v) for k, v in missing.items()})
    for cat in ("article", "ruletag", "plural", "translation", "help", "verb"):
        print(f"{cat}: total={len(findings[cat])}")
    print(f"\nWrote {out}")

    # Article suffix-predicted (the real article-error suspects) + plurals + translations
    print("\n=== ARTICLE suspects (suffix-predicted) ===")
    for sev, word, ctx, msg in sorted(findings["article"], key=lambda x: order.get(x[0], 9)):
        print(f"[{sev}] {word} [{ctx}] -> {msg}")
    print("\n=== PLURAL findings ===")
    for sev, word, ctx, msg in sorted(findings["plural"], key=lambda x: order.get(x[0], 9)):
        print(f"[{sev}] {word} [{ctx}] -> {msg}")
    print("\n=== TRANSLATION findings ===")
    for sev, word, ctx, msg in sorted(findings["translation"], key=lambda x: order.get(x[0], 9)):
        print(f"[{sev}] {word} [{ctx}] -> {msg}")


if __name__ == "__main__":
    main()
