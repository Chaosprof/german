"""Generate starter translations for Aspekte missing entries.

Strategy:
- Build a German -> English lookup from existing nouns/verbs/adjectives.
- For missing compounds, split into known parts and concatenate translations.
- For missing verbs/adjectives, try prefix/suffix decomposition.
- Emit a JS data file with the translations as a starting point. Best-effort.

Usage: generate_aspekte_translations.py <level>
"""
import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def build_lookup():
    nouns = load("data/nouns.json")["nouns"]
    verbs = load("data/verbs.json")["verbs"]
    adjs = load("data/adjectives.json")["adjectives"]
    n_lookup = {n["word"]: (n.get("english") or "").split("/")[0].split(",")[0].strip() for n in nouns}
    v_lookup = {v["word"]: (v.get("english") or "").split("/")[0].split(",")[0].strip() for v in verbs}
    a_lookup = {a["word"]: (a.get("english") or "").split("/")[0].split(",")[0].strip() for a in adjs}
    return n_lookup, v_lookup, a_lookup


def split_compound(word, n_lookup):
    """Try to split a compound noun into two parts both in the lookup.

    Both halves must be 4+ letters (avoids "Tag"/"Ion"/"ice" matches).
    Prefer splits where head is a known noun (with optional linking -s/-es/-en/-er).
    Tries split positions favouring balanced halves.
    """
    n = len(word)
    # Min 4 letters per side; iterate split positions from "balanced" outwards.
    candidates = []
    for split_at in range(4, n - 3):
        head = word[:split_at]
        tail = word[split_at:]
        tail_cap = tail[0].upper() + tail[1:]
        if tail_cap not in n_lookup:
            continue
        # Determine if head is a recognized stem.
        head_eng = None
        head_norm = None
        # Direct match (head is itself a noun)
        if head in n_lookup:
            head_norm = head
            head_eng = n_lookup[head]
        elif head.endswith("s") and head[:-1] in n_lookup and len(head) >= 5:
            head_norm = head[:-1]
            head_eng = n_lookup[head[:-1]]
        elif head.endswith("es") and head[:-2] in n_lookup and len(head) >= 6:
            head_norm = head[:-2]
            head_eng = n_lookup[head[:-2]]
        elif head.endswith("en") and head[:-2] in n_lookup and len(head) >= 6:
            head_norm = head[:-2]
            head_eng = n_lookup[head[:-2]]
        elif head.endswith("er") and head[:-2] in n_lookup and len(head) >= 6:
            head_norm = head[:-2]
            head_eng = n_lookup[head[:-2]]
        if not head_eng:
            continue
        if not n_lookup[tail_cap]:
            continue  # tail has no English
        # Prefer balanced splits; bigger combined "lengths" wins.
        score = min(len(head), len(tail))
        candidates.append((score, head_norm, tail_cap, head_eng, n_lookup[tail_cap]))
    if not candidates:
        return None
    candidates.sort(key=lambda c: -c[0])  # prefer balanced splits
    _, head, tail_cap, head_eng, tail_eng = candidates[0]
    return head, tail_cap, head_eng, tail_eng


def translate_noun(word, n_lookup):
    if word in n_lookup and n_lookup[word]:
        return n_lookup[word]
    parts = split_compound(word, n_lookup)
    if parts:
        head, tail, head_eng, tail_eng = parts
        if head_eng and tail_eng:
            return f"{head_eng} {tail_eng}"
    # Try ending in -er + (in)
    if word.endswith("erin") and word[:-2] in n_lookup:
        return f"{n_lookup[word[:-2]]} (female)"
    return None


def translate_verb(word, v_lookup, n_lookup):
    if word in v_lookup and v_lookup[word]:
        return v_lookup[word]
    # Try removing common prefixes
    for prefix, prefix_meaning in [
        ("aus", "out"), ("ein", "in"), ("an", "to"),
        ("ab", "off/away"), ("auf", "up"), ("zu", "to"),
        ("vor", "fore"), ("nach", "after"), ("über", "over"),
        ("unter", "under"), ("um", "around"), ("durch", "through"),
        ("be", ""), ("er", ""), ("ver", ""), ("zer", ""),
        ("ent", ""), ("hin", "thither"), ("her", "hither"),
        ("zurück", "back"), ("weiter", "further"), ("mit", "along"),
    ]:
        if word.startswith(prefix) and len(word) - len(prefix) >= 4:
            stem = word[len(prefix):]
            if stem in v_lookup and v_lookup[stem]:
                if prefix_meaning:
                    return f"{prefix_meaning}-{v_lookup[stem]}"
                return v_lookup[stem]
    return None


def translate_adj(word, a_lookup):
    if word in a_lookup and a_lookup[word]:
        return a_lookup[word]
    # Try -lich, -ig, -isch suffix removal
    for suffix in ("lich", "ig", "isch", "bar", "haft", "voll", "los", "frei"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            stem = word[:-len(suffix)]
            # Try noun stem + -lich/-ig/etc.
            cap = stem[0].upper() + stem[1:]
            if cap in (load("data/nouns.json")["nouns"]):
                return f"{suffix}-form of {stem}"
    return None


def main():
    level = sys.argv[1].lower()
    miss = load(f"audit/aspekte_{level}_missing.json")
    n_lookup, v_lookup, a_lookup = build_lookup()

    out_n = {}
    untrans_n = []
    for e in miss["nouns"]:
        w = e["lemma"]
        eng = translate_noun(w, n_lookup)
        out_n[w] = (e, eng)
        if not eng:
            untrans_n.append(e)
    out_v = {}
    untrans_v = []
    for e in miss["verbs"]:
        w = e["lemma"]
        eng = translate_verb(w, v_lookup, n_lookup)
        out_v[w] = (e, eng)
        if not eng:
            untrans_v.append(e)
    out_a = {}
    untrans_a = []
    for e in miss["adjs"]:
        w = e["lemma"]
        eng = translate_adj(w, a_lookup)
        out_a[w] = (e, eng)
        if not eng:
            untrans_a.append(e)

    print(f"Aspekte {level.upper()}:")
    print(f"  nouns: {len(out_n)} total, {sum(1 for v in out_n.values() if v[1])} auto-translated, {len(untrans_n)} need manual")
    print(f"  verbs: {len(out_v)} total, {sum(1 for v in out_v.values() if v[1])} auto-translated, {len(untrans_v)} need manual")
    print(f"  adj:   {len(out_a)} total, {sum(1 for v in out_a.values() if v[1])} auto-translated, {len(untrans_a)} need manual")

    # Save translations as JSON for review and use in JS data builder
    Path(f"audit/aspekte_{level}_translations.json").write_text(
        json.dumps({
            "nouns": [{"lemma": w, "text": e["text"], "english": eng,
                       "article": _extract_article(e["text"]),
                       "plural": _extract_plural(e["text"]),
                       "modifiers": _extract_modifiers(e["text"])}
                      for w, (e, eng) in out_n.items()],
            "verbs": [{"lemma": w, "text": e["text"], "english": eng,
                       "irregular": _extract_irregular(e["text"])}
                      for w, (e, eng) in out_v.items()],
            "adjs":  [{"lemma": w, "text": e["text"], "english": eng}
                      for w, (e, eng) in out_a.items()],
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  Wrote audit/aspekte_{level}_translations.json")


def _extract_article(text):
    m = re.match(r"^(der/die|die/der|der|die|das)\s+", text)
    return m.group(1).replace(" ", "") if m else None


def _extract_plural(text):
    m = re.search(r",\s*([\-–—\"]\w*|\.\.\s*\w+|[A-ZÄÖÜ][\wÄÖÜäöüß-]*)", text)
    if m:
        h = m.group(1).strip()
        if h.startswith('"-'):
            return h[1:]  # umlaut hint marker
        return h
    if "(Sg.)" in text or "(nur Sg.)" in text:
        return "—"
    if "(Pl.)" in text or "(nur Pl.)" in text:
        return None
    return None


def _extract_modifiers(text):
    m = []
    if "(Sg.)" in text or "(nur Sg.)" in text:
        m.append("nur Sg.")
    if "(Pl.)" in text or "(nur Pl.)" in text:
        m.append("nur Pl.")
    return m


def _extract_irregular(text):
    """Extract (prateritum, perfekt, withSein) if present."""
    # e.g. "leichtfallen, fiel leicht, ist leichtgefallen"
    m = re.search(r",\s*([a-zäöüß][\wäöüß ]+),\s*(hat|ist)\s+([\wäöüß ]+)", text)
    if m:
        prat = m.group(1).strip()
        aux = m.group(2)
        perf = m.group(3).strip()
        return [prat, perf, aux == "ist"]
    return None


if __name__ == "__main__":
    main()
