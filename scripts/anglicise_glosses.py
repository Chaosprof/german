#!/usr/bin/env python3
"""British-spelling sweep on English glosses in nouns/verbs/adjectives.

Curated, suffix-safe US->UK token replacements (word-boundary anchored to avoid
breaking words like 'laboratory'), plus explicit fixes for the few glosses that
listed both a US and a UK form. Run from repo root; pass --write to apply.
"""
import json
import re
import sys

FILES = {
    "data/nouns.json": "nouns",
    "data/verbs.json": "verbs",
    "data/adjectives.json": "adjectives",
}

# (pattern, replacement) — \b anchors the start so mid-word matches
# (collaborate, laboratory, discolor, epicenter…) are never touched.
SUBS = [
    (r"\bbehavior", "behaviour"),      # behaviour/behavioural/behaviours
    (r"\bcolor(?!ect)", "colour"),     # colour/coloured — but NOT colorectal
    (r"\bhonor(?!ar)", "honour"),      # honour/honoured/honourable — NOT honorary
    (r"\bneighbor", "neighbour"),      # neighbour/neighbourhood
    (r"\bflavor", "flavour"),          # flavour/flavourful
    (r"\bodor", "odour"),
    (r"\btheater", "theatre"),         # theatre/theatres
    (r"\bcenter\b", "centre"),
    (r"\bcenters\b", "centres"),
    (r"\bmold\b", "mould"),
    (r"\bmoldy\b", "mouldy"),
    (r"\bcozy\b", "cosy"),
    (r"\bskillful", "skilful"),        # skilful/skilfully
    (r"\benroll\b", "enrol"),
    (r"\bfulfill\b", "fulfil"),
    (r"\bfulfillment\b", "fulfilment"),
    (r"\brealiz", "realis"),           # realise/realisable/realisation
    (r"\brecogniz", "recognis"),       # recognise/recognisable
    (r"\bemphasiz", "emphasis"),       # emphasise/emphasised
    (r"\borganiz", "organis"),         # organise/organisation
    (r"\bapologiz", "apologis"),
    (r"\banalyz", "analys"),           # analyse/analysis
]
COMPILED = [(re.compile(p), r) for p, r in SUBS]

# Glosses that listed both a US and UK form (rule: never both in one gloss).
EXPLICIT = {
    "Geruch": "smell/odour/scent",
    "Hautfarbe": "skin colour/complexion",
    "Programm": "programme",
    "einschulen": "enrol at school/instruct/send to school",
}


def dedupe(text):
    """Collapse exact duplicate '/'-separated senses (created when a gloss
    listed both the US and UK form, e.g. 'cosy/cozy' -> 'cosy/cosy' -> 'cosy')."""
    if "/" not in text:
        return text
    seen, out = set(), []
    for part in text.split("/"):
        if part not in seen:
            seen.add(part)
            out.append(part)
    return "/".join(out)


def fix(text):
    new = text
    for rx, rep in COMPILED:
        new = rx.sub(rep, new)
    return dedupe(new)


def main(write):
    changes = []
    docs = {}
    for path, key in FILES.items():
        doc = json.loads(open(path, encoding="utf-8").read())
        docs[path] = (doc, key)
        for e in doc[key]:
            old = e.get("english")
            if not old:
                continue
            new = EXPLICIT.get(e["word"], fix(old))
            if new != old:
                changes.append((key, e["word"], old, new))
                e["english"] = new

    by_kind = {}
    for kind, w, o, n in changes:
        by_kind.setdefault(kind, 0)
        by_kind[kind] += 1
    print(f"Total gloss changes: {len(changes)}  {by_kind}")
    for kind, w, o, n in changes:
        print(f"  [{kind}] {w}: {o!r} -> {n!r}")

    if write:
        for path, (doc, key) in docs.items():
            doc["meta"]["count"] = len(doc[key])
            with open(path, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=2)
                f.write("\n")
        print("WROTE", ", ".join(FILES))
    else:
        print("(dry run — pass --write to apply)")


if __name__ == "__main__":
    main("--write" in sys.argv)
