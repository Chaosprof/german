#!/usr/bin/env python3
"""
Heuristic sweep for likely-bad English translations in nouns/verbs/adjectives.
Outputs audit/translation_flags.json grouped by reason.
"""
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT_DIR = ROOT / "audit"
OUT_DIR.mkdir(exist_ok=True)

# ── Heuristic word lists ──────────────────────────────────────────────────

# Archaic / dated / literary English — if any of these appears as a whole word
# in a translation, the entry is worth a look.
ARCHAIC = {
    "betwixt", "thee", "thou", "thy", "thine", "morrow", "hither", "thither",
    "whither", "whence", "yon", "yonder", "naught", "nay", "perchance",
    "verily", "yore", "wont", "doff", "behoove", "behooves", "betide", "bide",
    "wist", "agone", "anent", "aught", "ado", "begone", "anon", "ere",
    "behold", "afar", "mayhap", "oft", "nigh", "wherefore", "whilom",
    "victuals", "vexation", "vexed", "phlegm", "phthisis", "ague", "wight",
    "fortnight", "morn", "eventide", "betoken", "kine",
    # archaic technical/printing
    "imitation",  # archaic gloss for Klischee
}

# Awkward / non-idiomatic constructions seen in our data so far
AWKWARD_PHRASES = [
    "arrange terms", "arrange term", "make-up", "phlegmy",
    "in question", "with question",
    " awl", "deal awl", "awl ",  # MT garbage from -ort
    "concern", "concern.", " concern",  # MT garbage from -geschichte/-anliegen
    "sink aircraft", "chart basement", "court booth", "act tense",
    "fine application", "civilization concern", "civilisation concern",
    "expression field", "family part", "belief community",
    "building existence", "broth", "composure", "encounter",
    "buckled", "Mrs German armed forces", "Keyboard/keyboard",
    "liking carrier", "pay scale associate", "cab business",
    "circle association", "communication area", "basis care",
    "building penny bank", "awl municipality", "current",  # standalone
    "north-east", "north-west",  # check formatting consistency separately
]

# Tokens that, when standalone (whole-word) in a single-sense translation, are suspect
SUSPECT_STANDALONE = {
    "current", "concern", "stop", "encounter", "composure", "broth",
    "buckled", "cap", "essence", "stuff", "booking",
}

# Known specific bad full-translations (exact match)
KNOWN_BAD_EXACT = {
    "buckled",
    "encounter",
    "composure",
    "current",
    "concern",
    "Mrs German armed forces",
    "communication area",
    "civilization concern",
    "civilisation concern",
    "court booth",
    "sink aircraft",
    "deal awl",
    "act tense",
    "fine application",
    "expression field",
    "family part",
    "belief community",
    "building existence",
    "basis care",
    "building penny bank",
    "awl municipality",
    "cab business",
    "circle association",
    "pay scale associate",
    "liking carrier",
    "chart basement",
    "dale basis",
    "tag",
    "stop",
    "adoption",
    "cap",
    "Keyboard/keyboard instrument",
    "Techno music",
    "Mrs German",
    "broth",
    "current/electricity",  # check
}

WORD_RE = re.compile(r"\b[\w'-]+\b", re.UNICODE)


def english_for(entry):
    return (entry.get("english") or "").strip()


def is_archaic(text: str) -> bool:
    tokens = {w.lower() for w in WORD_RE.findall(text)}
    return bool(tokens & ARCHAIC)


def has_awkward_phrase(text: str) -> bool:
    low = text.lower()
    return any(p.lower() in low for p in AWKWARD_PHRASES if len(p.strip()) > 3)


def is_suspect_standalone(text: str) -> bool:
    # single-sense translation that is exactly a suspect token
    if "/" in text or "," in text or len(text.split()) > 1:
        return False
    return text.strip().lower() in SUSPECT_STANDALONE


def is_too_short_for_compound(word: str, eng: str) -> bool:
    """A long German compound (>=12 chars, no spaces) translated to a single
    short English word is suspicious."""
    if len(word) < 12 or " " in word:
        return False
    senses = [s.strip() for s in re.split(r"[/,]", eng) if s.strip()]
    if len(senses) != 1:
        return False
    sense = senses[0]
    # Strip leading "to " for verbs, articles
    s = re.sub(r"^(to |the |a |an )", "", sense, flags=re.I)
    return len(s) < 7


def has_capitalization_oddity(eng: str) -> bool:
    # e.g., "Keyboard/keyboard instrument" — same sense capitalised oddly
    senses = [s.strip() for s in re.split(r"/", eng) if s.strip()]
    lowers = {s.lower() for s in senses}
    return len(lowers) < len(senses)


def main():
    flags = defaultdict(list)

    def scan(items, kind):
        for entry in items:
            word = entry.get("word", "")
            eng = english_for(entry)
            rank = entry.get("rank")
            base = {"kind": kind, "word": word, "english": eng, "rank": rank}

            if not eng:
                flags["empty"].append(base)
                continue

            if eng in KNOWN_BAD_EXACT:
                flags["known_bad_exact"].append(base)

            if is_archaic(eng):
                flags["archaic"].append(base)

            if has_awkward_phrase(eng):
                flags["awkward_phrase"].append(base)

            if is_suspect_standalone(eng):
                flags["suspect_standalone"].append(base)

            if is_too_short_for_compound(word, eng):
                flags["too_short_for_compound"].append(base)

            if has_capitalization_oddity(eng):
                flags["capitalization_oddity"].append(base)

    with open(DATA / "nouns.json", encoding="utf-8") as f:
        nouns = json.load(f)
    with open(DATA / "verbs.json", encoding="utf-8") as f:
        verbs = json.load(f)
    with open(DATA / "adjectives.json", encoding="utf-8") as f:
        adjs = json.load(f)

    scan(nouns["nouns"], "noun")
    scan(verbs["verbs"], "verb")
    scan(adjs["adjectives"], "adjective")

    # Sort each bucket by rank ascending (most common first)
    for k, v in flags.items():
        v.sort(key=lambda e: (e["rank"] is None, e["rank"] or 0))

    out = {
        "summary": {k: len(v) for k, v in flags.items()},
        "total_unique_words": len({(e["kind"], e["word"]) for v in flags.values() for e in v}),
        "buckets": dict(flags),
    }

    with open(OUT_DIR / "translation_flags.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("=== Translation audit summary ===")
    for k, n in sorted(out["summary"].items(), key=lambda kv: -kv[1]):
        print(f"  {k:30s} {n}")
    print(f"  {'TOTAL UNIQUE WORDS':30s} {out['total_unique_words']}")
    print()
    print("Sample of each bucket (first 8 by rank):")
    for k, items in flags.items():
        print(f"\n[{k}]")
        for e in items[:8]:
            print(f"  {e['kind']:5s} rank={e['rank']:>6} {e['word']:30s} -> {e['english']}")


if __name__ == "__main__":
    main()
