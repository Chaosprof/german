#!/usr/bin/env python3
"""Split the heavy articleHelp/pluralHelp text out of data/nouns.json.

The web app only needs [word, article, plural, english, rank] (+ ruleId,
isException, and a derived `weak` flag) to become interactive; the help text is
only shown on individual cards. Moving it to a separate, lazily-loaded file
shrinks the blocking download from ~17 MB to ~5 MB.

Outputs:
  data/nouns.json      — core (help fields removed, `weak` flag added)
  data/noun-help.json  — { meta, help: { word: [articleHelp, pluralHelp] } } (minified)
"""
import json

WEAK_MARKER = "⚠ Weak noun"  # "⚠ Weak noun"
DROP = ("articleHelp", "pluralHelp")


def main():
    doc = json.load(open("data/nouns.json", encoding="utf-8"))
    nouns = doc["nouns"]

    help_map = {}
    core = []
    weak_count = 0
    for n in nouns:
        ah = n.get("articleHelp", "") or ""
        ph = n.get("pluralHelp", "") or ""
        help_map[n["word"]] = [ah, ph]
        entry = {k: v for k, v in n.items() if k not in DROP}
        if WEAK_MARKER in ah:
            entry["weak"] = True
            weak_count += 1
        core.append(entry)

    doc["nouns"] = core
    doc["meta"]["count"] = len(core)
    doc["meta"]["helpFile"] = "noun-help.json"
    with open("data/nouns.json", "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

    help_doc = {
        "meta": {
            "source": doc["meta"].get("source", ""),
            "count": len(help_map),
            "note": "Per-noun articleHelp/pluralHelp, split out of nouns.json "
                    "for lazy loading. Keyed by word.",
        },
        "help": help_map,
    }
    with open("data/noun-help.json", "w", encoding="utf-8") as f:
        json.dump(help_doc, f, ensure_ascii=False, separators=(",", ":"))  # minified
        f.write("\n")

    import os
    cb = os.path.getsize("data/nouns.json")
    hb = os.path.getsize("data/noun-help.json")
    print(f"core nouns.json: {cb/1e6:.2f} MB ({cb} bytes), {len(core)} entries, weak={weak_count}")
    print(f"noun-help.json:  {hb/1e6:.2f} MB ({hb} bytes), {len(help_map)} entries")
    print(f"\n>>> set NOUNS_CORE_APPROX_BYTES = {cb} in index.html")


if __name__ == "__main__":
    main()
