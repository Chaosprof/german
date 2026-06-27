"""How many deck words sit in the joint top-N when nouns+verbs+adjectives
are merged into a single ranking?

Each kind has its own rank universe (1..N_n, 1..N_v, 1..N_a). To produce a
"joint" ranking we merge all entries and sort by rank ascending; ties keep
all tied entries at the same merged position.
"""
import json
from collections import defaultdict
from pathlib import Path


DECK_DIRS = [
    "data/goethe-a1", "data/goethe-a2", "data/goethe-b1",
    "data/netzwerk-a1", "data/netzwerk-a2", "data/netzwerk-b1",
    "data/vielfalt-b1plus",
    "data/vielfalt-b2-1", "data/vielfalt-b2-2",
    "data/aspekte-b2",
    "data/vielfalt-c1-1", "data/vielfalt-c1-2",
    "data/aspekte-c1",
]


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def main():
    deck_n, deck_v, deck_a = set(), set(), set()
    for d in DECK_DIRS:
        for ref in load(f"{d}/manifest.json")["decks"]:
            try: deck = load(f"{d}/{ref['file']}")
            except FileNotFoundError: continue
            for w in deck.get("nouns") or []: deck_n.add(w)
            for w in deck.get("verbs") or []: deck_v.add(w)
            for w in deck.get("adjectives") or []: deck_a.add(w)

    nouns = load("data/nouns.json")["nouns"]
    verbs = load("data/verbs.json")["verbs"]
    adjs = load("data/adjectives.json")["adjectives"]

    # Joint sort: each entry has (rank, kind_priority_for_tiebreak, word).
    # Tiebreaker is just stable: nouns < verbs < adj.
    merged = []
    for n in nouns:
        if n.get("rank"): merged.append((n["rank"], "noun", n["word"]))
    for v in verbs:
        if v.get("rank"): merged.append((v["rank"], "verb", v["word"]))
    for a in adjs:
        if a.get("rank"): merged.append((a["rank"], "adj", a["word"]))

    merged.sort(key=lambda x: (x[0], x[1]))
    print(f"Bank totals — nouns: {len(nouns)}, verbs: {len(verbs)}, adj: {len(adjs)}, joint: {len(merged)}")
    print(f"Deck unique  — nouns: {len(deck_n)}, verbs: {len(deck_v)}, adj: {len(deck_a)}, total: {len(deck_n)+len(deck_v)+len(deck_a)}")
    print()

    for top_n in [5000, 10000, 15000, 20000]:
        top = merged[:top_n]
        # Counts in joint top-N by kind
        kind_counts = defaultdict(int)
        for _, k, _ in top:
            kind_counts[k] += 1
        # Deck words in top-N
        in_top = {"noun": 0, "verb": 0, "adj": 0}
        for r, kind, w in top:
            if kind == "noun" and w in deck_n: in_top["noun"] += 1
            elif kind == "verb" and w in deck_v: in_top["verb"] += 1
            elif kind == "adj" and w in deck_a: in_top["adj"] += 1
        # Highest rank still in top-N
        max_rank = top[-1][0]
        # Deck words OUTSIDE top-N (i.e. their rank > max_rank for that kind)
        out_n = sum(1 for n in nouns if n["word"] in deck_n and (n.get("rank") or 0) > max_rank)
        out_v = sum(1 for v in verbs if v["word"] in deck_v and (v.get("rank") or 0) > max_rank)
        out_a = sum(1 for a in adjs if a["word"] in deck_a and (a.get("rank") or 0) > max_rank)
        out_total = out_n + out_v + out_a
        in_total = in_top["noun"] + in_top["verb"] + in_top["adj"]

        print(f"Joint top {top_n} (rank <= {max_rank}):")
        print(f"  composition: {kind_counts['noun']}N + {kind_counts['verb']}V + {kind_counts['adj']}A")
        print(f"  deck words IN  top-{top_n}: {in_total} ({in_top['noun']}N + {in_top['verb']}V + {in_top['adj']}A)")
        print(f"  deck words OUT top-{top_n}: {out_total} ({out_n}N + {out_v}V + {out_a}A)")
        print()


if __name__ == "__main__":
    main()
