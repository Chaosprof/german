#!/usr/bin/env python3
"""Fix malformed/unchanged plurals and back-fill rich article/plural help for
the "thin" textbook-deck noun entries (added by add_*_data scripts, which
bypassed generate_nouns.py).

Strategy:
  * Plurals: correct only entries whose stored plural matches a known bug
    pattern (left as singular, truncated umlaut, doubled stem, missing umlaut,
    feminine -in without -innen). Source of truth = upstream German-Words plural,
    deterministic -in/-ung rules, and a small hand-verified override map.
    Legitimate variant plurals (Denkmäler, Kommata, Risiken…) are left alone.
  * Help: regenerate articleHelp/pluralHelp via generate_nouns' generators for
    deck nouns whose help is terse/empty. Never touches isException entries'
    articleHelp (curated), nor already-rich help.

Run from repo root: python scripts/backfill_thin_deck_nouns.py [--write]
"""
import json
import os
import sys
import glob

sys.path.insert(0, "scripts")
import generate_nouns as g  # noqa: E402  (functions only; main is guarded)

GENDER = {"der": "m", "die": "f", "das": "n"}
NO_PL = {None, "", "-", "—", "–"}

# Hand-verified corrections for tricky cases upstream gets wrong or misses
# (wrong/missing umlaut, doubled stems, invariant loanwords).
EXPLICIT_PLURAL = {
    "Blaumann": "Blaumänner", "Herbststurm": "Herbststürme",
    "Nachbardorf": "Nachbardörfer", "Satzanfang": "Satzanfänge",
    "Wortstamm": "Wortstämme", "Witwer": "Witwer", "Fauxpas": "Fauxpas",
    "Stuntman": "Stuntmen", "Assessment": "Assessments",
    "Bundesministerium": "Bundesministerien", "Computerfirma": "Computerfirmen",
    "Familiendrama": "Familiendramen", "Musikalbum": "Musikalben",
}
# Entries whose stored plural is already correct/standard — never touch.
EXCLUDE_PLURAL = {"Euro", "Ton", "Umbau"}


def load(p):
    return json.load(open(p, encoding="utf-8"))


def corrected_plural(word, art, pl, up):
    """Return a corrected plural, or None if current value should stand.

    Only fixes unambiguous bug patterns; legitimate variant plurals are left
    untouched. The fragile doubled-stem / umlaut-swap heuristics from the first
    pass were dropped (they misfired on Umbauten / Töne) — those cases are in
    EXPLICIT_PLURAL instead.
    """
    if word in EXCLUDE_PLURAL:
        return None
    if word in EXPLICIT_PLURAL:
        return EXPLICIT_PLURAL[word]
    if pl in NO_PL:
        return None  # uncountable / not asserted — leave as is
    g_ = GENDER.get(art)
    # feminine -in person noun left as singular
    if (g_ == "f" and word.endswith("in") and not word.endswith("ein")
            and pl == word):
        return word + "nen"
    # deterministic die-suffix nouns left as singular
    if g_ == "f" and pl == word and any(
            word.endswith(s) for s in ("ung", "heit", "keit", "schaft",
                                       "ion", "tät", "ur")):
        return word + "en"
    up_pl = None
    if up:
        up_pl = (up.get("cases") or {}).get("nominative", {}).get("plural")
    if up_pl and up_pl != pl:
        # only overwrite when the stored form matches a bug pattern
        if pl == word and up_pl != word:                    # singular unchanged
            return up_pl
        if up_pl.startswith(pl) and len(up_pl) > len(pl):   # truncated form
            return up_pl
    return None


def rich(text):
    return len((text or "").strip()) >= 60


def synth(word, art, plural, plural_only=False):
    so = (plural in NO_PL) and not plural_only
    return {
        "lemma": word, "gender": GENDER.get(art, "n"),
        "singularOnly": so, "pluralOnly": plural_only,
        "cases": {"nominative": {"singular": word,
                                 "plural": None if so else (plural or word)}},
    }


def main(write):
    doc = load("data/nouns.json")
    deck = set()
    for mf in glob.glob("data/*/manifest.json"):
        for ref in load(mf)["decks"]:
            p = os.path.join(os.path.dirname(mf), ref["file"])
            if os.path.exists(p):
                for w in load(p).get("nouns") or []:
                    deck.add(w)

    plural_fixes, ah_fills, ph_fills = [], 0, 0
    for n in doc["nouns"]:
        w = n["word"]
        if w not in deck:
            continue
        art = n.get("article", "")
        if art not in GENDER:
            continue
        up = g.all_nouns_by_lemma.get(w)
        old_pl = n.get("plural")
        ph_cur = (n.get("pluralHelp") or "").strip()
        singular_only = ph_cur == "Singular-only." or \
            ph_cur.startswith("This noun is singular only")
        plural_only = bool(n.get("pluraleTantum")) or "antum" in ph_cur or \
            ph_cur.startswith("Plural-only")

        up_pl = None
        if up:
            up_pl = (up.get("cases") or {}).get("nominative", {}).get("plural")

        def set_pl(new):
            plural_fixes.append((w, old_pl, new))
            n["plural"] = new

        plural_changed = False
        if plural_only:
            pass  # plurale tantum — leave the plural form as stored
        elif singular_only:
            # "Singular-only." marker with the singular wrongly stored as the
            # plural (plural == word). Use an attested upstream plural if the
            # marker is simply wrong; otherwise drop to None. Existing real
            # plurals and existing '—' markers are left untouched.
            if old_pl == w:
                if up_pl and up_pl != w:
                    set_pl(up_pl); plural_changed = True   # countable despite marker
                else:
                    set_pl(None); plural_changed = True    # genuine mass/abstract
        else:
            cp = corrected_plural(w, art, old_pl if old_pl is not None else "", up)
            if cp is not None and cp != old_pl:
                set_pl(cp); plural_changed = True
        cur_pl = n.get("plural")

        is_exc = bool(n.get("isException"))
        nd = synth(w, art, cur_pl, plural_only=plural_only)
        # articleHelp: fill only if thin and not a curated exception
        if not is_exc and not rich(n.get("articleHelp")):
            n["articleHelp"] = g.generate_article_help(nd)
            ah_fills += 1
        # pluralHelp: fill if thin, or refresh if we changed the plural
        if (not rich(n.get("pluralHelp")) or plural_changed) and not (
                is_exc and not plural_changed):
            n["pluralHelp"] = g.generate_plural_help(nd)
            ph_fills += 1

    print(f"plural fixes: {len(plural_fixes)}")
    for w, o, c in sorted(plural_fixes):
        print(f"  {w}: {o!r} -> {c!r}")
    print(f"articleHelp back-filled: {ah_fills}")
    print(f"pluralHelp back-filled/refreshed: {ph_fills}")

    if write:
        doc["meta"]["count"] = len(doc["nouns"])
        with open("data/nouns.json", "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("WROTE data/nouns.json")
    else:
        print("(dry run — pass --write to apply)")


if __name__ == "__main__":
    main("--write" in sys.argv)
