"""Parse a Goethe-Zertifikat / Start Deutsch Wortliste against the local word
banks. Differs from Vielfalt: no per-lesson breakdown, alphabetical layout,
example-sentence column instead of underscores.

Usage: audit_goethe_wordlist.py <level>
where <level> is one of: a1, a2, b1
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path


LEVEL_CONFIG = {
    "a1": {
        "raw": "audit/goethe_a1_raw.txt",
        "label": "Goethe A1 / Start Deutsch 1",
        "pdf": "A1_SD1_Wortliste_02.pdf",
    },
    "a2": {
        "raw": "audit/goethe_a2_raw.txt",
        "label": "Goethe A2",
        "pdf": "Goethe-Zertifikat_A2_Wortliste.pdf",
    },
    "b1": {
        "raw": "audit/goethe_b1_raw.txt",
        "label": "Goethe B1",
        "pdf": "Goethe-Zertifikat_B1_Wortliste.pdf",
    },
}


# Lines that are page header/footer artifacts and should be dropped before
# entry detection.
HEADER_RE = re.compile(
    r"^(VS_\d|Seite\s+\d|Inventare|Alphabetische|Wortliste|Wortgruppenliste|"
    r"=== PAGE\s+\d+\s*===|GOETHE-ZERTIFIKAT|Goethe-Zertifikat|Start Deutsch|"
    r"START DEUTSCH|prüfungsbar|Stand: |\d+\s*$)"
)

# The single-letter section markers in the alphabetical list ("A", "B", ...)
SECTION_LETTER_RE = re.compile(r"^[A-ZÄÖÜß]\s*$")


# A "new entry" starts at a line that begins with one of:
# - der/die/das + Capital
# - (sich) + lowercase verb
# - a lowercase letter (entry headword)
HEAD_NOUN_RE = re.compile(r"^(der|die|das)\s+([A-ZÄÖÜ][\wäöüÄÖÜß-]*)")
HEAD_REFLEX_RE = re.compile(r"^\(sich\)\s+([a-zäöüß][a-zäöüß-]+)")
HEAD_LOWER_RE = re.compile(r"^([a-zäöüß][a-zäöüß-]*)")


def is_artifact(line):
    return bool(HEADER_RE.match(line.strip())) or SECTION_LETTER_RE.match(line.strip())


def looks_like_headword(line):
    s = line.lstrip()
    if not s:
        return False
    if HEAD_NOUN_RE.match(s) or HEAD_REFLEX_RE.match(s):
        return True
    if HEAD_LOWER_RE.match(s):
        return True
    return False


def find_alphabetical_section(lines):
    """Return the slice of lines containing the alphabetical wordlist."""
    # Look for "A" section letter on its own line, often preceded by a
    # heading like "Alphabetische Wortliste". We'll start at the first
    # line that's exactly "A" surrounded by other headword-like content.
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s == "A":
            # Verify that the next non-empty line looks like an A-headword
            for j in range(i + 1, min(i + 8, len(lines))):
                nxt = lines[j].strip()
                if not nxt:
                    continue
                if re.match(r"^(ab|aber|all|als|am|an|auch|auf|aus|der|die|das)\b", nxt, re.IGNORECASE):
                    return i + 1
                break
    return 0


def parse_entries(raw_text):
    lines = raw_text.splitlines()
    start = find_alphabetical_section(lines)
    if start:
        lines = lines[start:]

    # Stop at bibliography / Literatur section (the closing matter that
    # follows the alphabetical wordlist).
    end = len(lines)
    for i, ln in enumerate(lines):
        if ln.strip() in ("Literatur",) and i > 50:
            end = i
            break
    lines = lines[:end]

    # Drop empty / artifact lines.
    cleaned = [ln for ln in lines if ln.strip() and not is_artifact(ln)]

    entries = []
    current = []
    for ln in cleaned:
        if looks_like_headword(ln) and current:
            entries.append(" ".join(current))
            current = [ln.strip()]
        elif looks_like_headword(ln):
            current = [ln.strip()]
        else:
            if current:
                current.append(ln.strip())
            # else: line outside any entry, ignore
    if current:
        entries.append(" ".join(current))
    return entries


PLURAL_HINT_RE = re.compile(r",\s*([\-–—][\wÄÖÜäöüß]*|\.\.\s*\w+|[A-ZÄÖÜ][\wÄÖÜäöüß-]+)")


def add_umlaut(word):
    i = word.rfind("au")
    if i != -1:
        return word[:i] + "äu" + word[i + 2:]
    for j in range(len(word) - 1, -1, -1):
        if word[j] in "aou":
            return word[:j] + {"a": "ä", "o": "ö", "u": "ü"}[word[j]] + word[j + 1:]
    return word


def expand_plural(word, hint, modifiers):
    if hint is None:
        return None
    if "nur Sg." in modifiers:
        return "—"
    if "nur Pl." in modifiers:
        return word
    h = hint.strip()
    if h in {"-", "–", "—"}:
        return word
    if h.startswith(".."):
        return add_umlaut(word) + h[2:].strip()
    if h[0] in "-–—":
        return word + h[1:]
    if re.match(r"^[A-ZÄÖÜ]", h):
        return h
    return None


def classify_entry(text):
    """Classify the first line/segment of an entry into noun/verb/adj.
    Returns dict with kind/lemma/article/plural fields."""
    text = text.strip()
    # Noun?
    m = HEAD_NOUN_RE.match(text)
    if m:
        article = m.group(1)
        word = m.group(2)
        rest = text[m.end():].strip()
        # Glue continuation: e.g. "der Anruf-\nbeantworter" → rest starts with "beantworter"
        cont = re.match(r"^([a-zäöüß][\wäöüÄÖÜß-]*)(?=\s|$)", rest)
        if cont and word.endswith("-"):
            word = word[:-1] + cont.group(1)
            rest = rest[cont.end():].strip()
        plural_hint = None
        pm = PLURAL_HINT_RE.match(rest)
        if pm:
            plural_hint = pm.group(1).strip()
        modifiers = []
        if "(nur Sg.)" in text or "nur Sg." in text:
            modifiers.append("nur Sg.")
        if "(nur Pl.)" in text or "nur Pl." in text:
            modifiers.append("nur Pl.")
        return {
            "kind": "noun",
            "lemma": word,
            "article": article,
            "plural_hint": plural_hint,
            "modifiers": modifiers,
            "text": text,
        }
    # Reflexive verb
    m = HEAD_REFLEX_RE.match(text)
    if m:
        return {"kind": "verb", "lemma": m.group(1), "reflexive": True, "text": text}
    # Plain word
    m = HEAD_LOWER_RE.match(text)
    if m:
        word = m.group(1)
        if word.endswith("-"):
            return {"kind": "adj_stem", "lemma": word[:-1], "text": text}
        if re.search(r"(en|eln|ern)$", word) and len(word) > 3:
            return {"kind": "verb", "lemma": word, "reflexive": False, "text": text}
        return {"kind": "adj", "lemma": word, "text": text}
    return {"kind": "expression", "lemma": text, "text": text}


def main():
    if len(sys.argv) < 2 or sys.argv[1].lower() not in LEVEL_CONFIG:
        print("Usage: audit_goethe_wordlist.py <a1|a2|b1>")
        sys.exit(1)
    level = sys.argv[1].lower()
    cfg = LEVEL_CONFIG[level]
    raw = Path(cfg["raw"]).read_text(encoding="utf-8")

    entries_text = parse_entries(raw)
    parsed = [classify_entry(e) for e in entries_text]
    parsed_path = Path(f"audit/goethe_{level}_parsed.json")
    parsed_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")

    # Compare against banks
    nouns = json.loads(Path("data/nouns.json").read_text(encoding="utf-8"))["nouns"]
    verbs = json.loads(Path("data/verbs.json").read_text(encoding="utf-8"))["verbs"]
    adjs = json.loads(Path("data/adjectives.json").read_text(encoding="utf-8"))["adjectives"]
    dual = json.loads(Path("data/dual-gender-nouns.json").read_text(encoding="utf-8"))["nouns"]

    noun_idx = {n["word"]: n for n in nouns}
    verb_idx = {v["word"]: v for v in verbs}
    adj_idx = {a["word"].lower(): a for a in adjs}
    dual_idx = {d["word"]: d for d in dual}

    found = Counter()
    missing = defaultdict(list)
    mismatch = defaultdict(list)

    for e in parsed:
        kind = e["kind"]
        lemma = e["lemma"]
        if kind == "noun":
            n = noun_idx.get(lemma)
            if not n:
                missing["noun"].append(e)
                continue
            found["noun"] += 1
            expected = expand_plural(lemma, e.get("plural_hint"), e.get("modifiers", []))
            d = dual_idx.get(lemma)
            article_ok = n.get("article") == e.get("article")
            if d and not article_ok:
                for sense in d.get("genders", []):
                    if sense.get("article") == e.get("article"):
                        article_ok = True
                        break
            if not article_ok:
                mismatch["noun"].append((e, "article", e.get("article"), n.get("article")))
            if expected is not None and n.get("plural") != expected:
                if expected != add_umlaut(lemma) + (e.get("plural_hint") or "")[1:]:
                    mismatch["noun"].append((e, "plural", expected, n.get("plural")))
        elif kind == "verb":
            v = verb_idx.get(lemma)
            if not v:
                if lemma.lower() in adj_idx:
                    found["adj"] += 1
                    continue
                missing["verb"].append(e)
                continue
            found["verb"] += 1
        elif kind == "adj":
            if lemma.lower() in adj_idx:
                found["adj"] += 1
            elif lemma in verb_idx:
                found["verb"] += 1
            else:
                missing["adj"].append(e)
        elif kind == "adj_stem":
            if lemma.lower() in adj_idx:
                found["adj_stem"] += 1
            else:
                missing["adj_stem"].append(e)
        else:
            missing["expression"].append(e)

    summary_path = Path(f"audit/goethe_{level}_summary.md")
    with summary_path.open("w", encoding="utf-8") as f:
        f.write(f"# {cfg['label']} Wortliste audit summary\n\n")
        f.write(f"PDF: `{cfg['pdf']}` — {len(parsed)} entries parsed.\n\n")
        f.write("## Coverage by kind\n\n")
        f.write("| Kind | In PDF | Found | Missing |\n|---|---:|---:|---:|\n")
        totals = Counter(e["kind"] for e in parsed)
        for kind, label in [("noun", "Nouns"), ("verb", "Verbs"), ("adj", "Adjectives/adverbs"), ("adj_stem", "Adjective stems"), ("expression", "Expressions")]:
            f.write(f"| {label} | {totals[kind]} | {found[kind]} | {len(missing[kind])} |\n")
        f.write(f"\n- Noun mismatches: **{len(mismatch['noun'])}**\n")

    missing_path = Path(f"audit/goethe_{level}_missing.md")
    with missing_path.open("w", encoding="utf-8") as f:
        f.write(f"# {cfg['label']} missing entries\n\n")
        for kind in ["noun", "verb", "adj", "adj_stem", "expression"]:
            f.write(f"## {kind} missing ({len(missing[kind])})\n\n")
            if not missing[kind]:
                f.write("_None._\n\n")
                continue
            for e in missing[kind]:
                f.write(f"- **{e['lemma']}** — `{e['text']}`\n")
            f.write("\n")

    mismatch_path = Path(f"audit/goethe_{level}_mismatch.md")
    with mismatch_path.open("w", encoding="utf-8") as f:
        f.write(f"# {cfg['label']} mismatches\n\n")
        for kind in ["noun"]:
            f.write(f"## {kind} mismatches ({len(mismatch[kind])})\n\n")
            if not mismatch[kind]:
                f.write("_None._\n\n")
                continue
            for e, field, pdf, bank in mismatch[kind]:
                f.write(f"- **{e['lemma']}** `{field}` PDF `{pdf}` vs bank `{bank}` — `{e['text']}`\n")

    print(f"Parsed {len(parsed)} entries -> {parsed_path}")
    print("Kinds:", dict(Counter(e["kind"] for e in parsed)))
    print(f"Wrote {summary_path}, {missing_path}, {mismatch_path}")


if __name__ == "__main__":
    main()
