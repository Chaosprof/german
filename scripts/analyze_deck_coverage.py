"""Analyse coverage: which low-ranked (high-frequency) words in the local
word bank are NOT in any Vielfalt / Goethe deck?

Reads all manifest.json files under data/{goethe-*,vielfalt-*}/, unions
their nouns/verbs/adjectives, then walks the bank and prints the top
ranked (most frequent) words missing from every deck.
"""
import json
import sys
from pathlib import Path
from collections import defaultdict

DECK_DIRS = [
    "data/goethe-a1", "data/goethe-a2", "data/goethe-b1",
    "data/netzwerk-a1", "data/netzwerk-a2", "data/netzwerk-b1",
    "data/vielfalt-b1plus",
    "data/vielfalt-b2-1", "data/vielfalt-b2-2",
    "data/aspekte-b2",
    "data/vielfalt-c1-1", "data/vielfalt-c1-2",
    "data/aspekte-c1",
]


def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def collect_deck_words():
    """Return dict: word -> set of deck dirs that include it (per kind)."""
    coverage_n = defaultdict(set)
    coverage_v = defaultdict(set)
    coverage_a = defaultdict(set)
    for dir_ in DECK_DIRS:
        manifest = load_json(f"{dir_}/manifest.json")
        for ref in manifest["decks"]:
            deck_path = f"{dir_}/{ref['file']}"
            try:
                deck = load_json(deck_path)
            except FileNotFoundError:
                continue
            label = dir_.split("/")[-1]
            for w in deck.get("nouns", []) or []:
                coverage_n[w].add(label)
            for w in deck.get("verbs", []) or []:
                coverage_v[w].add(label)
            for w in deck.get("adjectives", []) or []:
                coverage_a[w].add(label)
    return coverage_n, coverage_v, coverage_a


def main():
    cov_n, cov_v, cov_a = collect_deck_words()
    nouns = load_json("data/nouns.json")["nouns"]
    verbs = load_json("data/verbs.json")["verbs"]
    adjs = load_json("data/adjectives.json")["adjectives"]

    # Sort by rank (the lower the rank, the more frequent the word).
    nouns = sorted([n for n in nouns if n.get("rank") is not None], key=lambda n: n["rank"])
    verbs = sorted([v for v in verbs if v.get("rank") is not None], key=lambda v: v["rank"])
    adjs = sorted([a for a in adjs if a.get("rank") is not None], key=lambda a: a["rank"])

    # For each kind, count missing per rank band.
    bands = [(1, 100), (101, 500), (501, 1000), (1001, 2000),
             (2001, 5000), (5001, 10000)]

    def stats(items, coverage, key="word", lower=str.lower):
        out = {}
        for lo, hi in bands:
            band_items = [x for x in items if lo <= x["rank"] <= hi]
            missing = [x for x in band_items if x[key] not in coverage]
            out[(lo, hi)] = (len(band_items), len(missing), missing[:30])
        return out

    n_stats = stats(nouns, cov_n)
    v_stats = stats(verbs, cov_v)
    a_stats = stats(adjs, cov_a)

    out = Path("audit/deck_coverage_report.md")
    with out.open("w", encoding="utf-8") as f:
        f.write("# Deck coverage analysis\n\n")
        f.write("How many bank words at each frequency band are NOT in any\n")
        f.write("Vielfalt / Goethe deck. Lower rank = more frequent.\n\n")

        for kind, label, st in [("Nouns", "nouns", n_stats),
                                 ("Verbs", "verbs", v_stats),
                                 ("Adjectives", "adjectives", a_stats)]:
            f.write(f"## {kind}\n\n")
            f.write("| Rank band | In band | Missing from all decks | Missing % |\n")
            f.write("|---|---:|---:|---:|\n")
            for lo, hi in bands:
                total, missing, _ = st[(lo, hi)]
                pct = (missing / total * 100) if total else 0
                f.write(f"| {lo}–{hi} | {total} | {missing} | {pct:.0f}% |\n")
            f.write("\n")

            # Top missing in the most frequent band.
            for lo, hi in bands:
                total, missing, sample = st[(lo, hi)]
                if missing == 0:
                    continue
                f.write(f"### {lo}–{hi}: first {min(30, len(sample))} missing\n\n")
                for item in sample:
                    extra = ""
                    if kind == "Nouns":
                        extra = f" ({item.get('article','?')}, plural {item.get('plural','—')})"
                    eng = item.get("english") or ""
                    f.write(f"- **{item['word']}** rank {item['rank']}{extra} — {eng}\n")
                f.write("\n")

    print(f"Wrote {out}")
    print()
    print("Quick totals:")
    for kind, st in [("nouns", n_stats), ("verbs", v_stats), ("adjectives", a_stats)]:
        for lo, hi in bands[:3]:
            total, missing, _ = st[(lo, hi)]
            print(f"  {kind} rank {lo}-{hi}: {missing}/{total} missing")


if __name__ == "__main__":
    main()
