"""How many unique words across all Goethe + Vielfalt decks, and where do
their bank ranks sit? Helps decide whether deck-membership should
influence ranking.
"""
import json
from collections import Counter, defaultdict
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
    by_kind = {"nouns": defaultdict(set), "verbs": defaultdict(set), "adjectives": defaultdict(set)}

    for dir_ in DECK_DIRS:
        manifest = load(f"{dir_}/manifest.json")
        label = dir_.split("/")[-1]
        for ref in manifest["decks"]:
            try:
                deck = load(f"{dir_}/{ref['file']}")
            except FileNotFoundError:
                continue
            for w in deck.get("nouns") or []:
                by_kind["nouns"][w].add(label)
            for w in deck.get("verbs") or []:
                by_kind["verbs"][w].add(label)
            for w in deck.get("adjectives") or []:
                by_kind["adjectives"][w].add(label)

    nouns = load("data/nouns.json")["nouns"]
    verbs = load("data/verbs.json")["verbs"]
    adjs = load("data/adjectives.json")["adjectives"]

    rank_n = {n["word"]: n.get("rank") for n in nouns}
    rank_v = {v["word"]: v.get("rank") for v in verbs}
    rank_a = {a["word"]: a.get("rank") for a in adjs}

    # Distribution
    def distribute(unique_words, rank_lookup):
        bands = [(1, 500), (501, 1000), (1001, 2000), (2001, 5000),
                 (5001, 10000), (10001, 30000)]
        d = Counter()
        no_rank = 0
        beyond = 0
        for w in unique_words:
            r = rank_lookup.get(w)
            if r is None:
                no_rank += 1
                continue
            placed = False
            for lo, hi in bands:
                if lo <= r <= hi:
                    d[(lo, hi)] += 1
                    placed = True
                    break
            if not placed:
                beyond += 1
        return d, no_rank, beyond

    total = 0
    rows = []
    for kind, label, rank in [("nouns", "Nouns", rank_n),
                              ("verbs", "Verbs", rank_v),
                              ("adjectives", "Adjectives", rank_a)]:
        unique = list(by_kind[kind].keys())
        total += len(unique)
        dist, no_rank, beyond = distribute(unique, rank)
        rows.append((label, len(unique), dist, no_rank, beyond))

    print(f"Total unique words across all 8 deck collections: **{total}**")
    print()
    print(f"  Nouns: {rows[0][1]}")
    print(f"  Verbs: {rows[1][1]}")
    print(f"  Adjectives: {rows[2][1]}")
    print()

    bands = [(1, 500), (501, 1000), (1001, 2000), (2001, 5000),
             (5001, 10000), (10001, 30000)]

    out = Path("audit/deck_words_rank_distribution.md")
    with out.open("w", encoding="utf-8") as f:
        f.write("# Deck words by Leipzig rank band\n\n")
        f.write(f"Total unique words across all Goethe + Vielfalt decks: **{total}**.\n\n")
        f.write("Where do those words sit in the bank's frequency ranking?\n")
        f.write("Lower rank = more frequent in the Leipzig corpus.\n\n")
        f.write("| Band | Nouns | Verbs | Adjectives |\n|---|---:|---:|---:|\n")
        for lo, hi in bands:
            row = []
            for label, total_unique, dist, _, _ in rows:
                row.append(str(dist[(lo, hi)]))
            f.write(f"| {lo}–{hi} | {' | '.join(row)} |\n")
        f.write(f"| no rank | {rows[0][3]} | {rows[1][3]} | {rows[2][3]} |\n")
        f.write(f"| > 30000 | {rows[0][4]} | {rows[1][4]} | {rows[2][4]} |\n\n")

        for kind_label, total_unique, dist, no_rank, beyond in rows:
            f.write(f"## {kind_label}\n\n")
            f.write(f"Total unique in decks: {total_unique}\n\n")
            for lo, hi in bands:
                f.write(f"- {lo}–{hi}: **{dist[(lo, hi)]}** words\n")
            f.write(f"- no rank: {no_rank}\n")
            f.write(f"- > 30000: {beyond}\n\n")

        # Show a sample of high-rank words that ARE in decks (i.e., deep
        # in the long tail but textbook-taught).
        f.write("## Long-tail words in decks (rank > 5000)\n\n")
        for kind, label, rank in [("nouns", "Nouns", rank_n),
                                  ("verbs", "Verbs", rank_v),
                                  ("adjectives", "Adjectives", rank_a)]:
            high = []
            for w in by_kind[kind]:
                r = rank.get(w)
                if r is not None and r > 5000:
                    high.append((w, r, sorted(by_kind[kind][w])))
            high.sort(key=lambda x: x[1])
            f.write(f"### {label} — {len(high)} entries past rank 5000\n\n")
            for w, r, decks in high[:30]:
                f.write(f"- **{w}** rank {r} (in: {', '.join(decks)})\n")
            f.write("\n")

    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
