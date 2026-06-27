"""Add Vielfalt C1.1 missing words to the word banks.

For each missing noun/verb/adjective from `audit/glossar_parsed.json`, this script:
- writes a new entry into data/{nouns,verbs,adjectives}.json
- continues the rank from the current max + 1
- attaches an English gloss + the conjugation/plural details supplied by the PDF

We deliberately skip:
- adverbs / conjunctions / genitive prepositions (mehrmals, somit, anlässlich, ...)
- adjective stems (manch-, jen-, ...)
- past participles whose only role in the lesson is adjectival (angenommen, ...)
- multi-word expressions (außer Frage stehen, ...)

These are not hidden — they remain in audit/glossar_parsed.json and will surface
in the deck files as part of the lesson, but they are not promoted into the
type-specific word banks because they don't belong in any of them.
"""
import json
import re

PARSED_PATH = "audit/glossar_parsed.json"
NOUNS_PATH = "data/nouns.json"
VERBS_PATH = "data/verbs.json"
ADJ_PATH = "data/adjectives.json"

# ─── English glosses for new entries ─────────────────────────────────────

NOUN_GLOSS = {
    "Erledigung": "errand/task to handle",
    "Umbruchphase": "transition phase",
    "Kompromissbereitschaft": "willingness to compromise",
    "Inkompetenz": "incompetence",
    "Selbstwahrnehmung": "self-perception",
    "Fremdwahrnehmung": "perception by others",
    "Selbstkonzept": "self-concept",
    "Regionalsprache": "regional language",
    "Familiensprache": "family/home language",
    "Hochsprache": "standard literary language",
    "Kunstsprache": "constructed language",
    "Studienleiter": "study director/principal investigator",
    "Schnapsidee": "crazy idea",
    "Fremdscham": "second-hand embarrassment",
    "Kabelsalat": "tangle of cables",
    "Kopfkino": "mental images/daydreaming",
    "Berufsleben": "working life",
    "ÖPNV": "public transport (abbr. of öffentlicher Personennahverkehr)",
    "Verkehrsanbindung": "transport connection",
    "Leihroller": "rental scooter",
    "Lösungsansatz": "approach to a solution",
    "Vernetzung": "networking/interconnection",
    "Ausschüttung": "release/secretion (e.g. of hormones)",
    "Leistungsfähigkeit": "performance/capability",
    "Praktikumsplatz": "internship position",
    "Liniendiagramm": "line chart",
    "Tortendiagramm": "pie chart",
    "Orientierungsmesse": "orientation fair",
    "Studienangebot": "course offering",
    "Arbeitsfeld": "field of work",
    "Personalmanager": "HR/personnel manager",
    "Karrieremesse": "career fair",
    "Anforderungsprofil": "job requirements profile",
    "Reduzierung": "reduction",
    "Messebesucher": "trade fair visitor",
    "Krankheitsquote": "sickness rate",
    "Gebrechlichkeit": "frailty",
    "Vergesslichkeit": "forgetfulness",
    "Verjüngung": "rejuvenation",
    "Lichtverhältnisse": "lighting conditions",
    "Hafermilch": "oat milk",
    "Schuldeingeständnis": "admission of guilt",
    "Minderwertigkeitsgefühl": "feelings of inferiority",
    "Erniedrigende": "the humiliating thing/aspect",
    "Urangst": "primal fear",
    "Konfliktfähigkeit": "ability to handle conflict",
    "Ostblock": "Eastern Bloc",
    "Selbstbezeichnung": "self-designation/term one uses for oneself",
    "Auslandssemester": "semester abroad",
    "Oberstufe": "upper-secondary level (final years of Gymnasium)",
    "Abiturient": "Abitur student/high-school graduate",
    "Sorgearbeit": "care work",
    "Teilhabe": "participation",
    "Rollenbild": "gender role/role model image",
    "Körpermaße": "body measurements",
    "Wahlfach": "elective subject",
    "Teilzeitregelung": "part-time arrangement",
    "Spracherkennungstechnologie": "speech-recognition technology",
    "Sehbehinderung": "visual impairment",
    "Farbsehschwäche": "colour vision deficiency",
}

VERB_GLOSS = {
    "verdeutlichen": "clarify/make clear",
    "gebärden": "use sign language/gesticulate",
    "rüberkommen": "come across (as)",
    "involvieren": "involve",
    "verschränken": "cross/fold (arms, legs)",
    "auftun": "(reflexive) open up/present itself",
    "antrainieren": "(reflexive) train oneself in/acquire by training",
    "einbinden": "incorporate/integrate",
    "anfallen": "arise/accrue (of work, costs)",
    "wirtschaften": "manage resources/economise",
    "hinauszögern": "delay/postpone",
    "verjüngen": "rejuvenate",
    "verirren": "(reflexive) get lost",
    "ausströmen": "emit/escape (of gas, smell)",
    "einschleichen": "(reflexive) creep in",
    "anschreien": "shout at",
    "geradestehen": "take responsibility (für etw.)",
    "konfrontieren": "confront",
    "auflockern": "loosen up/lighten (mood, atmosphere)",
    "einreißen": "tear down/get out of hand",
    "anbelangen": "concern (was X anbelangt — as far as X is concerned)",
    "hineinpassen": "fit in",
    "einfließen": "flow into/be incorporated",
    "unterlaufen": "slip past/occur (jdm. unterläuft ein Fehler)",
}

# Irregular conjugation data harvested from the PDF (or filled where well known).
# Format: lemma -> (prateritum, perfekt, withSein)
VERB_IRREGULAR = {
    "einbinden": ("band ein", "eingebunden", False),
    "einschleichen": ("schlich ein", "eingeschlichen", False),
    "anschreien": ("schrie an", "angeschrien", False),
    "geradestehen": ("stand gerade", "geradegestanden", False),
    "einreißen": ("riss ein", "eingerissen", False),
    "einfließen": ("floss ein", "eingeflossen", True),
    # PDF doesn't list these explicitly, but they're well-known strong verbs:
    "anfallen": ("fiel an", "angefallen", True),
    "auftun": ("tat auf", "aufgetan", False),
    "rüberkommen": ("kam rüber", "rübergekommen", True),
    "unterlaufen": ("unterlief", "unterlaufen", True),
}

ADJ_GLOSS = {
    "vorausgesetzt": "presupposed/provided that",
    "vorwurfsvoll": "reproachful",
    "hetero": "heterosexual/straight",
    "diszipliniert": "disciplined",
    "distanziert": "distant/detached",
    "involviert": "involved",
    "inspirierend": "inspiring",
    "verlockend": "tempting/alluring",
    "zunehmend": "increasing",
    "abschließend": "concluding/final",
    "mangelnd": "lacking/insufficient",
    "erniedrigend": "humiliating/degrading",
    "konkurrierend": "competing/rival",
    "unterrepräsentiert": "underrepresented",
    "inklusiv": "inclusive",
    "linkshändig": "left-handed",
    # Past participles used as adjectives in this glossary:
    "vollkommen": "perfect/complete",
    "vergangen": "past/last (week, year)",
    "bescheiden": "modest/humble",
    "entschlossen": "determined/resolute",
    "gelassen": "calm/composed",
    "ausgeschlossen": "out of the question/excluded",
    "aufgeschlossen": "open-minded",
    "intern": "internal",
    "gelungen": "successful/well-done",
    "überzogen": "exaggerated/over-the-top",
    "angemessen": "appropriate/adequate",
    "vorhanden": "available/in existence",
    "zugeschnitten": "tailored (auf + Akk.)",
    "angenommen": "supposed (conjunction); adopted (participle)",
    # Single-word adverbs/connectors in the PDF. They use the adjective-style
    # bank so translation/matching decks can include them.
    "mehrmals": "several times",
    "erstmals": "for the first time",
    "anlässlich": "on the occasion of",
    "angesichts": "in view of",
    "mangels": "for lack of",
    "zumal": "especially since",
    "zweifellos": "undoubtedly",
    "zwischendurch": "in between/from time to time",
    "wobei": "whereby/although",
    "nichtsdestotrotz": "nevertheless",
    "oftmals": "often/frequently",
    "weiterhin": "still/furthermore",
    "inwieweit": "to what extent",
    "demgegenüber": "by contrast",
    "somit": "therefore/thus",
    "womit": "whereby/with which",
    "letztlich": "ultimately",
    "wodurch": "through which/whereby",
    "rundum": "all around/completely",
    "demzufolge": "consequently",
    "stets": "always",
    "derzeit": "currently",
    "folgendermaßen": "as follows",
    "entgegen": "contrary to/against",
    "wohingegen": "whereas",
    "infolgedessen": "as a result",
    "weswegen": "for which reason/which is why",
}

# Verb-classified entries we deliberately drop (adverbs / conjunctions).
# Past participle adjectives (angenommen, zugeschnitten, …) live in ADJ_GLOSS instead.
SKIP_VERBS = {
    "abgesehen",  # only used in "abgesehen von + Dat." — phrasal preposition
}
SKIP_ADJ = set()

# ─── Helpers ──────────────────────────────────────────────────────────────

def umlaut(word):
    last_au = word.rfind("au")
    if last_au != -1:
        return word[:last_au] + "äu" + word[last_au + 2:]
    for i in range(len(word) - 1, -1, -1):
        ch = word[i]
        if ch in "aou":
            return word[:i] + {"a": "ä", "o": "ö", "u": "ü"}[ch] + word[i+1:]
    return word


def expand_plural(word, hint, modifiers):
    if "nur Sg." in modifiers:
        return "—"
    if "nur Pl." in modifiers:
        return word  # plurale tantum: noun itself is plural
    if not hint:
        return None
    h = hint.strip()
    if h == "-":
        return word
    if h.startswith("-"):
        return word + h[1:].strip()
    if h.startswith(".."):
        return umlaut(word) + h[2:].strip()
    if re.match(r"^[A-ZÄÖÜ]\w+$", h):
        return h
    return None


SUFFIX_RULES = [
    (r"ung$", "die.suffix_ung"),
    (r"keit$", "die.suffix_keit"),
    (r"heit$", "die.suffix_heit"),
    (r"schaft$", "die.suffix_schaft"),
    (r"ion$", "die.suffix_ion"),
    (r"tät$", "die.suffix_taet"),
    (r"ur$", "die.suffix_ur"),
    (r"in$", "die.suffix_in"),
    (r"ei$", "die.suffix_ei"),
    (r"falt$", "die.suffix_falt"),
    (r"enz$", "die.suffix_enz"),
    (r"anz$", "die.suffix_anz"),
    (r"ade$", "die.suffix_ade"),
    (r"age$", "die.suffix_age"),
    (r"ie$", "die.suffix_ie"),
    (r"ik$", "die.suffix_ik"),
    (r"ling$", "der.suffix_ling"),
    (r"ner$", "der.suffix_ner"),
    (r"or$", "der.suffix_or"),
    (r"ant$", "der.suffix_ant"),
    (r"ismus$", "der.suffix_ismus"),
    (r"er$", "der.suffix_er"),
    (r"eur$", "der.suffix_eur"),
    (r"nis$", "das.suffix_nis"),
    (r"ment$", "das.suffix_ment"),
    (r"tum$", "das.suffix_tum"),
    (r"chen$", "das.diminutives"),
    (r"lein$", "das.diminutives"),
]


def detect_rule_id(word):
    for pat, rid in SUFFIX_RULES:
        if re.search(pat, word):
            return rid
    return None


GENERIC_HELP = {
    "die.suffix_ung": ("Suffix rule: -ung → always die.",
                        "-en plural (die ...en). -ung nouns universally take -en."),
    "die.suffix_keit": ("Suffix rule: -keit → always die.",
                        "-en plural. -keit nouns are typically singular but plural form is -en when used."),
    "die.suffix_heit": ("Suffix rule: -heit → always die.",
                         "-en plural. -heit nouns add -en in the plural."),
    "die.suffix_schaft": ("Suffix rule: -schaft → always die.",
                           "-en plural (die ...en)."),
    "die.suffix_ion": ("Suffix rule: -ion → always die.",
                        "-en plural (die ...en)."),
    "die.suffix_in": ("Suffix rule: -in → die for feminine persons.",
                       "-nen plural (die ...nen)."),
    "die.suffix_ei": ("Suffix rule: -ei → almost always die.",
                       "-en plural."),
    "die.suffix_falt": ("Suffix rule: -falt → die.",
                         "-en plural."),
    "die.suffix_enz": ("Suffix rule: -enz → die.", "-en plural."),
    "die.suffix_anz": ("Suffix rule: -anz → die.", "-en plural."),
    "die.suffix_ade": ("Suffix rule: -ade → die.", "-n plural."),
    "die.suffix_age": ("Suffix rule: -age → die.", "-n plural."),
    "die.suffix_ie": ("Suffix rule: -ie → die.", "-n plural."),
    "die.suffix_ik": ("Suffix rule: -ik → die.", "Often singular only."),
    "der.suffix_er": ("Suffix rule: -er agent nouns are mostly der.",
                       "Zero plural ending — same form as singular."),
    "der.suffix_or": ("Suffix rule: -or → der.", "-en plural with stress shift."),
    "der.suffix_eur": ("Suffix rule: -eur (French) → der.", "-e plural."),
    "der.suffix_ant": ("Suffix rule: -ant → der.", "-en plural (weak noun)."),
    "der.suffix_ling": ("Suffix rule: -ling → der.", "-e plural."),
    "der.suffix_ismus": ("Suffix rule: -ismus → der.", "Almost always singular only."),
    "das.suffix_nis": ("Suffix rule: -nis → das.", "-se plural."),
    "das.suffix_ment": ("Suffix rule: -ment → das.", "-e plural."),
    "das.suffix_tum": ("Suffix rule: -tum → das.", "Mostly singular only; -tümer plural where it exists."),
    "das.diminutives": ("Diminutive suffix → always das.", "Same form for plural."),
}


def derive_help(article, word, plural, modifiers):
    rid = detect_rule_id(word)
    if rid:
        a, p = GENERIC_HELP.get(rid, ("", ""))
        if "nur Sg." in modifiers:
            p = "Singular only (Singularetantum) — no plural form in current usage."
        elif "nur Pl." in modifiers:
            p = "Plural only (Plurale tantum) — no singular form in current usage."
        return rid, a, p
    # No rule: general help
    a = ""
    if "nur Sg." in modifiers:
        p = "Singular only (Singularetantum) — no plural form in current usage."
    elif "nur Pl." in modifiers:
        p = "Plural only (Plurale tantum) — no singular form in current usage."
    elif plural and plural != "—":
        p = f"Plural: die {plural}."
    else:
        p = ""
    return None, a, p


# ─── Build new entries ───────────────────────────────────────────────────

parsed = json.load(open(PARSED_PATH, encoding="utf-8"))

# Track per-lesson rosters for deck building
lesson_roster = {}  # lektion -> {"nouns": [..], "verbs": [..], "adjectives": [..]}

def add_to_roster(e, kind, lemma):
    key = e["lektion"]
    roster = lesson_roster.setdefault(key, {"nouns": [], "verbs": [], "adjectives": []})
    if kind == "noun" and lemma not in roster["nouns"]:
        roster["nouns"].append(lemma)
    elif kind == "verb" and lemma not in roster["verbs"]:
        roster["verbs"].append(lemma)
    elif kind == "adj" and lemma not in roster["adjectives"]:
        roster["adjectives"].append(lemma)


# Load banks
nouns_data = json.load(open(NOUNS_PATH, encoding="utf-8"))
verbs_data = json.load(open(VERBS_PATH, encoding="utf-8"))
adj_data = json.load(open(ADJ_PATH, encoding="utf-8"))

noun_words = {n["word"] for n in nouns_data["nouns"]}
verb_words = {v["word"] for v in verbs_data["verbs"]}
adj_words = {a["word"] for a in adj_data["adjectives"]}

next_noun_rank = max((n.get("rank") or 0) for n in nouns_data["nouns"]) + 1
next_verb_rank = max((v.get("rank") or 0) for v in verbs_data["verbs"]) + 1
next_adj_rank = max((a.get("rank") or 0) for a in adj_data["adjectives"]) + 1

added_n = added_v = added_a = 0
skipped_no_gloss = []


def handle_noun(e, lemma, meta):
    global next_noun_rank, added_n
    if lemma in noun_words:
        add_to_roster(e, "noun", lemma)
        return True
    gloss = NOUN_GLOSS.get(lemma)
    if gloss is None:
        return False
    article = meta["article"]
    plural = expand_plural(lemma, meta.get("plural"), meta.get("modifiers", []))
    if plural is None:
        plural = "—"
    rid, art_help, pl_help = derive_help(article, lemma, plural, meta.get("modifiers", []))
    entry = {
        "word": lemma,
        "article": article,
        "plural": plural,
        "english": gloss,
        "rank": next_noun_rank,
        "leipzigRank": None,
        "manuallyAdded": True,
        "source": "vielfalt-c1.1",
        "articleHelp": art_help,
        "pluralHelp": pl_help,
    }
    if rid:
        entry["ruleId"] = rid
    if "nur Pl." in meta.get("modifiers", []):
        entry["pluraleTantum"] = True
    nouns_data["nouns"].append(entry)
    noun_words.add(lemma)
    next_noun_rank += 1
    added_n += 1
    add_to_roster(e, "noun", lemma)
    return True


def handle_verb(e, lemma):
    global next_verb_rank, added_v
    if lemma in SKIP_VERBS:
        return True
    if lemma in verb_words:
        add_to_roster(e, "verb", lemma)
        return True
    gloss = VERB_GLOSS.get(lemma)
    if gloss is None:
        return False
    irreg = VERB_IRREGULAR.get(lemma)
    entry = {
        "word": lemma,
        "english": gloss,
        "rank": next_verb_rank,
        "irregular": bool(irreg),
        "source": "vielfalt-c1.1",
    }
    if irreg:
        entry["prateritum"] = irreg[0]
        entry["perfekt"] = irreg[1]
        entry["withSein"] = irreg[2]
    verbs_data["verbs"].append(entry)
    verb_words.add(lemma)
    next_verb_rank += 1
    added_v += 1
    add_to_roster(e, "verb", lemma)
    return True


def handle_adj(e, lemma):
    global next_adj_rank, added_a
    if lemma in SKIP_ADJ:
        return True
    if lemma in adj_words:
        add_to_roster(e, "adj", lemma)
        return True
    gloss = ADJ_GLOSS.get(lemma)
    if gloss is None:
        return False
    entry = {
        "word": lemma,
        "english": gloss,
        "rank": next_adj_rank,
        "leipzigRank": None,
        "source": "vielfalt-c1.1",
    }
    adj_data["adjectives"].append(entry)
    adj_words.add(lemma)
    next_adj_rank += 1
    added_a += 1
    add_to_roster(e, "adj", lemma)
    return True


for e in parsed:
    kind = e["kind"]
    lemma = e["lemma"]
    meta = e["meta"]
    handled = False
    if kind == "noun":
        handled = handle_noun(e, lemma, meta)
        # If a "noun"-classified entry has no gloss, skip silently — these are
        # the substantivized adjectives we routed to expressions earlier.
    elif kind == "verb":
        handled = handle_verb(e, lemma)
        if not handled and lemma in ADJ_GLOSS:
            # Reroute participle-as-adjective into the adjective bank.
            handled = handle_adj(e, lemma)
    elif kind == "adj":
        handled = handle_adj(e, lemma)
    if not handled and kind in ("noun", "verb", "adj"):
        skipped_no_gloss.append((kind, lemma, e["text"]))


# Bump meta counts
nouns_data.setdefault("meta", {})["count"] = len(nouns_data["nouns"])
verbs_data.setdefault("meta", {})["count"] = len(verbs_data["verbs"])
adj_data.setdefault("meta", {})["count"] = len(adj_data["adjectives"])

with open(NOUNS_PATH, "w", encoding="utf-8") as f:
    json.dump(nouns_data, f, ensure_ascii=False, indent=2)
with open(VERBS_PATH, "w", encoding="utf-8") as f:
    json.dump(verbs_data, f, ensure_ascii=False, indent=2)
with open(ADJ_PATH, "w", encoding="utf-8") as f:
    json.dump(adj_data, f, ensure_ascii=False, indent=2)

# Persist roster for the deck-building step
with open("audit/vielfalt_lesson_roster.json", "w", encoding="utf-8") as f:
    json.dump(lesson_roster, f, ensure_ascii=False, indent=2)

print(f"Added: {added_n} nouns, {added_v} verbs, {added_a} adjectives")
print(f"Next ranks: nouns={next_noun_rank}, verbs={next_verb_rank}, adj={next_adj_rank}")
if skipped_no_gloss:
    print(f"\nSkipped {len(skipped_no_gloss)} entries without a gloss in the dict — review:")
    for k, l, t in skipped_no_gloss:
        print(f"  [{k}] {l} — {t}")
