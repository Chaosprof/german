"""Build a Goethe / Start Deutsch wordlist deck.

Reads:
  audit/goethe_<level>_parsed.json — every entry from the line-based parser
  audit/goethe_<level>_columns.json — entries from the column parser
  data/{nouns,verbs,adjectives}.json — the local word banks

Strategy: union the lemmas from BOTH parsers, then keep only the ones that
exist in the local banks. The result is the "all" deck for that level.

Writes:
  data/goethe-<level>/manifest.json
  data/goethe-<level>/all.json
  audit/goethe_<level>_deck_report.md  — short coverage report
"""
import json
import sys
from collections import OrderedDict
from pathlib import Path


LEVEL_CONFIG = {
    "a1": {
        "label": "Goethe A1 / Start Deutsch 1",
        "name_short": "Goethe A1",
        "id": "goethe-a1",
        "pdf": "A1_SD1_Wortliste_02.pdf",
        "out_dir": "data/goethe-a1",
    },
    "a2": {
        "label": "Goethe A2",
        "name_short": "Goethe A2",
        "id": "goethe-a2",
        "pdf": "Goethe-Zertifikat_A2_Wortliste.pdf",
        "out_dir": "data/goethe-a2",
    },
    "b1": {
        "label": "Goethe B1",
        "name_short": "Goethe B1",
        "id": "goethe-b1",
        "pdf": "Goethe-Zertifikat_B1_Wortliste.pdf",
        "out_dir": "data/goethe-b1",
    },
}


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def collect_lemmas(parsed):
    """Return ordered dicts: nouns, verbs, adjectives keyed by lemma."""
    nouns, verbs, adjs = OrderedDict(), OrderedDict(), OrderedDict()
    for e in parsed:
        kind = e["kind"]
        lemma = e["lemma"]
        if not lemma:
            continue
        if kind == "noun":
            nouns.setdefault(lemma, e)
        elif kind == "verb":
            verbs.setdefault(lemma, e)
        elif kind == "adj":
            adjs.setdefault(lemma, e)
    return nouns, verbs, adjs


def main():
    if len(sys.argv) < 2 or sys.argv[1].lower() not in LEVEL_CONFIG:
        print("Usage: build_goethe_decks.py <a1|a2|b1>")
        sys.exit(1)
    level = sys.argv[1].lower()
    cfg = LEVEL_CONFIG[level]

    parsed_line = load_json(f"audit/goethe_{level}_parsed.json")
    parsed_cols = load_json(f"audit/goethe_{level}_columns.json")

    line_n, line_v, line_a = collect_lemmas(parsed_line)
    col_n, col_v, col_a = collect_lemmas(parsed_cols)

    bank_nouns = {n["word"] for n in load_json("data/nouns.json")["nouns"]}
    bank_verbs_data = load_json("data/verbs.json")["verbs"]
    bank_verbs = {v["word"] for v in bank_verbs_data}
    bank_irregular = {v["word"] for v in bank_verbs_data if v.get("irregular")}
    bank_adjs = {a["word"].lower() for a in load_json("data/adjectives.json")["adjectives"]}

    union_n = OrderedDict()
    for d in (col_n, line_n):
        for k, v in d.items():
            union_n.setdefault(k, v)
    union_v = OrderedDict()
    for d in (col_v, line_v):
        for k, v in d.items():
            union_v.setdefault(k, v)
    union_a = OrderedDict()
    for d in (col_a, line_a):
        for k, v in d.items():
            union_a.setdefault(k, v)

    deck_nouns = [n for n in union_n if n in bank_nouns]
    deck_verbs = [v for v in union_v if v in bank_verbs]
    deck_adjs = [a for a in union_a if a.lower() in bank_adjs]

    # Some entries parsed as adjectives are actually verbs in the bank
    # (and vice versa) — pick those up.
    for a in list(union_a):
        if a not in bank_adjs and a in bank_verbs and a not in deck_verbs:
            deck_verbs.append(a)
    for v in list(union_v):
        if v not in bank_verbs and v.lower() in bank_adjs and v not in deck_adjs:
            deck_adjs.append(v)

    out_dir = Path(cfg["out_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    deck = {
        "id": f"{cfg['id']}-all",
        "name": f"{cfg['label']} - Wortliste",
        "shortName": "Komplett",
        "lektion": None,
        "lessonTitle": "Full alphabetical wordlist",
        "nouns": deck_nouns,
        "verbs": deck_verbs,
        "adjectives": deck_adjs,
    }
    (out_dir / "all.json").write_text(json.dumps(deck, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Irregular verbs deck
    irr = [v for v in deck_verbs if v in bank_irregular]
    irr_deck = {
        "id": f"{cfg['id']}-irregular-verbs",
        "name": f"{cfg['label']} - Irregular Verbs",
        "shortName": "Irregular Verbs",
        "description": f"All irregular verbs from the {cfg['label']} wordlist.",
        "source": cfg["pdf"],
        "verbForms": irr,
    }
    (out_dir / "irregular-verbs.json").write_text(json.dumps(irr_deck, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    deck_files = [
        {"file": "all.json", "id": deck["id"], "name": deck["name"]},
        {"file": "irregular-verbs.json", "id": irr_deck["id"], "name": irr_deck["name"], "kind": "verb_forms"},
    ]
    manifest = {
        "id": cfg["id"],
        "name": f"{cfg['name_short']} Wortliste",
        "description": f"Goethe-Institut {cfg['label']} official wordlist.",
        "source": cfg["pdf"],
        "decks": deck_files,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Coverage report
    n_parsed = len(union_n)
    v_parsed = len(union_v)
    a_parsed = len(union_a)
    rep_path = Path(f"audit/goethe_{level}_deck_report.md")
    with rep_path.open("w", encoding="utf-8") as f:
        f.write(f"# {cfg['label']} deck build report\n\n")
        f.write(f"PDF: `{cfg['pdf']}`\n\n")
        f.write("## Coverage\n\n")
        f.write("| Kind | Parsed | In bank (deck) | Not in bank |\n|---|---:|---:|---:|\n")
        f.write(f"| Nouns | {n_parsed} | {len(deck_nouns)} | {n_parsed - len(deck_nouns)} |\n")
        f.write(f"| Verbs | {v_parsed} | {len(deck_verbs)} | {v_parsed - len(deck_verbs)} |\n")
        f.write(f"| Adjectives/adverbs | {a_parsed} | {len(deck_adjs)} | {a_parsed - len(deck_adjs)} |\n\n")
        f.write(f"Irregular verbs in deck: **{len(irr)}**.\n\n")
        f.write("Notes: most \"not in bank\" adjective/adverb entries are function "
                "words (pronouns, prepositions, conjunctions) which are not stored "
                "in the bank schema. \"Not in bank\" nouns/verbs are reported "
                "separately for follow-up.\n\n")

        missing_n = [n for n in union_n if n not in bank_nouns]
        missing_v = [v for v in union_v if v not in bank_verbs and v.lower() not in bank_adjs]
        if missing_n:
            f.write(f"## Nouns not in bank ({len(missing_n)})\n\n")
            for n in missing_n:
                f.write(f"- {n}\n")
            f.write("\n")
        if missing_v:
            f.write(f"## Verbs not in bank ({len(missing_v)})\n\n")
            for v in missing_v:
                f.write(f"- {v}\n")
            f.write("\n")

    print(f"Wrote {out_dir}/manifest.json + 2 deck files")
    print(f"Deck: {len(deck_nouns)} N + {len(deck_verbs)} V + {len(deck_adjs)} Adj = "
          f"{len(deck_nouns)+len(deck_verbs)+len(deck_adjs)} words")
    print(f"Irregular subset: {len(irr)}")
    print(f"Report: {rep_path}")


if __name__ == "__main__":
    main()
