#!/usr/bin/env python3
"""Disambiguate gloss twins that made reverse (translation) mode unfair.

Besorgung/Erledigung were both prompted as "errand", and Quatsch/Blödsinn
(plus Unsinn) all as "nonsense" — the player could not know which German
word was expected. The app now (a) shows the full gloss list as the prompt
and (b) accepts any same-class word whose glosses overlap (index.html,
findReverseSynonym). This script makes the prompts themselves distinct so
the canonical word is learnable. Qualifiers are parenthesised because the
synonym matcher strips "(...)" when comparing glosses — the words still
accept each other.

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

# word -> (expected current gloss, new gloss)
GLOSS_FIXES = {
    "Besorgung": ("errand/shopping", "errand (shopping)/purchase"),
    "Erledigung": ("errand/task to handle", "task to deal with/errand/completion"),
    "Blödsinn": ("nonsense/rubbish", "nonsense/stupidity"),
    "Quatsch": ("nonsense/rubbish", "nonsense (colloquial)/rubbish"),
}


def main() -> None:
    data = json.loads(NOUNS_PATH.read_text(encoding="utf-8"))
    changes = []
    for n in data["nouns"]:
        spec = GLOSS_FIXES.get(n["word"])
        if not spec:
            continue
        old, new = spec
        if n.get("english") == new:
            continue  # already applied
        if n.get("english") != old:
            print(f"WARN: {n['word']} gloss is {n.get('english')!r}, expected {old!r} — skipping")
            continue
        n["english"] = new
        changes.append(f"{n['article']} {n['word']}: {old!r} -> {new!r}")

    # verify the synonym matcher will still connect the pairs
    def gloss_set(english):
        out = set()
        for g in (english or "").split("/"):
            g = re.sub(r"\([^)]*\)", "", g).strip().lower()
            if g:
                out.add(g)
        return out

    by_word = {n["word"]: n for n in data["nouns"]}
    pairs = [("Besorgung", "Erledigung"), ("Quatsch", "Blödsinn"),
             ("Quatsch", "Unsinn"), ("Blödsinn", "Unsinn")]
    for a, b in pairs:
        ga, gb = gloss_set(by_word[a]["english"]), gloss_set(by_word[b]["english"])
        if not (ga & gb):
            print(f"VERIFICATION FAILED: {a} and {b} no longer share a gloss key")
            sys.exit(1)

    NOUNS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
    print(f"Applied {len(changes)} gloss changes")
    for c in changes:
        print("  ", c)


if __name__ == "__main__":
    main()
