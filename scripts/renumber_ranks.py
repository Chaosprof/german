"""Renumber rank fields contiguously, preserving the original value as leipzigRank.

Touches:
- data/nouns.json       (4 gaps in 1..max -> compress)
- data/adjectives.json  (23 gaps -> compress)
- data/dual-gender-nouns.json (re-align rank to new contiguous noun ranks by word)

Skipped:
- data/verbs.json (already contiguous 1..5213; no leipzigRank needed)
- data/verbs-with-prepositions.json (rank is synthetic combo position, not Leipzig)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def reorder_entry(entry, ordered_keys):
    """Rebuild a dict with `ordered_keys` first (in order), then any remaining keys."""
    out = {}
    for k in ordered_keys:
        if k in entry:
            out[k] = entry[k]
    for k, v in entry.items():
        if k not in out:
            out[k] = v
    return out


def renumber(path, list_key, key_order_prefix):
    p = DATA / path
    with p.open("r", encoding="utf-8") as f:
        doc = json.load(f)
    items = doc[list_key]
    items_sorted = sorted(items, key=lambda x: x["rank"])
    rebuilt = []
    for new_rank, entry in enumerate(items_sorted, start=1):
        old_rank = entry["rank"]
        entry = dict(entry)
        entry["rank"] = new_rank
        entry["leipzigRank"] = old_rank
        rebuilt.append(reorder_entry(entry, key_order_prefix))
    doc[list_key] = rebuilt
    if "meta" in doc and isinstance(doc["meta"], dict):
        doc["meta"]["count"] = len(rebuilt)
    with p.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{path}: renumbered {len(rebuilt)} entries (max old rank was {items_sorted[-1]['leipzigRank'] if False else max(e['leipzigRank'] for e in rebuilt)})")
    return rebuilt


def realign_dual_gender(noun_rebuilt):
    """Rewrite dual-gender ranks to the new contiguous noun ranks (matched by word).
    Preserve the previous dg rank as leipzigRank for reference."""
    p = DATA / "dual-gender-nouns.json"
    with p.open("r", encoding="utf-8") as f:
        doc = json.load(f)
    new_rank_by_word = {n["word"]: n["rank"] for n in noun_rebuilt}
    rebuilt = []
    unmatched = []
    for entry in doc["nouns"]:
        old_dg_rank = entry["rank"]
        new_rank = new_rank_by_word.get(entry["word"])
        if new_rank is None:
            unmatched.append(entry["word"])
            new_rank = old_dg_rank
        entry = dict(entry)
        entry["rank"] = new_rank
        entry["leipzigRank"] = old_dg_rank
        # Order: word, genders, rank, leipzigRank, then any extras
        rebuilt.append(reorder_entry(entry, ["word", "genders", "rank", "leipzigRank"]))
    doc["nouns"] = rebuilt
    if "meta" in doc and isinstance(doc["meta"], dict):
        doc["meta"]["count"] = len(rebuilt)
    with p.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"dual-gender-nouns.json: realigned {len(rebuilt)} entries"
          + (f", unmatched: {unmatched}" if unmatched else ""))


def main():
    noun_keys = ["word", "article", "plural", "english", "rank", "leipzigRank"]
    adj_keys = ["word", "english", "rank", "leipzigRank"]

    noun_rebuilt = renumber("nouns.json", "nouns", noun_keys)
    renumber("adjectives.json", "adjectives", adj_keys)
    realign_dual_gender(noun_rebuilt)


if __name__ == "__main__":
    main()
