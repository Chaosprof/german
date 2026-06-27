"""Parse Netzwerk neu A1 glossary into entries.

PyMuPDF extracts this PDF as blank-line separated glossary entries, but
individual German and English sides can wrap across multiple lines. Some first
letters are also extracted as separate positioned fragments. This parser keeps
each blank-line block together and then splits the block into German/English.

Output: list of dicts with chapter/section/german/english.
"""
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


U = "\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df"
LOWER = "a-z\u00e4\u00f6\u00fc\u00df"
UPPER = "A-Z\u00c4\u00d6\u00dc"
LETTER = f"A-Za-z{U}"

CHAPTER_RE = re.compile(r"^Kapitel\s+(\d+):\s*(.+)$")
SECTION_RE = re.compile(r"^(\d+[a-z]?(?:\s+\u00dcB)?|k&k)\s*$")
SECTION_PREFIX_RE = re.compile(r"^(\d+[a-z]?(?:\s+\u00dcB)?|k&k)\s+(.+)$")
SKIP_LINE_RE = re.compile(
    r"^(=== PAGE\s+\d+\s*===|Glossar$|Deutsch\s|Deutsch$|Netzwerk neu A1|"
    r"\u00a9 Ernst Klett|Alle Rechte|eigenen Unterrichts|Glossar Deutsch|"
    r"Seite\s+\d+|\u00dcbersetzt von)"
)

ENGLISH_START_RE = re.compile(
    r"^(here:|to|the|a|an|in|good|what|who|which|where|from|you|your|I|"
    r"he|she|it|we|they|this|that|these|those|yes|no|not|also|bye|"
    r"thank|please|sorry|German|English|Italian|Japanese|Russian|"
    r"Serbian|Turkish|Hungarian|Spanish|French|Portuguese|Bulgarian|"
    r"Indonesian|Germany|Austria|Switzerland|Greece|Mexico|Poland|"
    r"Turkey|Ukraine|France|Italy|Portugal|Thailand|Spain|Algeria|Brazil)"
    r"(?:\b|:)",
    re.IGNORECASE,
)

GERMAN_START_RE = re.compile(
    rf"^(der/die|die/der|der|die|das)\s+|^sich\s+|^[{LOWER}][{LOWER}|-]*,"
    rf"|^[{LOWER}][{LOWER}|-]*\s*\(|^[{UPPER}][{LOWER}]+$"
)


def looks_english(line):
    return bool(ENGLISH_START_RE.match(line.strip()))


def looks_german_entry_start(line):
    s = line.strip()
    if GERMAN_START_RE.match(s):
        return True
    return s in {"und", "aber", "oder", "denn", "doch", "auch", "in", "auf"}


def split_multi_entry_block(block):
    """Split entries that lost the blank line between them."""
    if len(block) < 4:
        return [block]
    out = []
    start = 0
    i = 1
    while i < len(block) - 1:
        if looks_english(block[i]) and looks_german_entry_start(block[i + 1]):
            candidate = block[start:i + 1]
            if " ".join(candidate).count("(") <= " ".join(candidate).count(")"):
                out.append(candidate)
                start = i + 1
        i += 1
    out.append(block[start:])
    return [b for b in out if b]


def parse(raw_path):
    raw = Path(raw_path).read_text(encoding="utf-8")

    # Merge split leading letters:
    #   " E\nnglisch" -> "Englisch"
    #   "1c a\nndere, anderer" -> "1c andere, anderer"
    raw = re.sub(
        rf"^(\d+[a-z]?(?:\s+\u00dcB)?|k&k)[ \t]+([{LETTER}])[ \t]*\n([{LOWER}][^\n]*)",
        r"\1 \2\3",
        raw,
        flags=re.MULTILINE,
    )
    raw = re.sub(
        rf"^[ \t]+([{LETTER}])[ \t]*\n([{LOWER}][^\n]*)",
        r"\1\2",
        raw,
        flags=re.MULTILINE,
    )

    lines = []
    for ln in raw.splitlines():
        s = ln.rstrip()
        if SKIP_LINE_RE.match(s.strip()):
            continue
        lines.append(s)

    blocks = []
    cur = []
    for line in lines:
        s = line.strip()
        if s:
            if cur and (CHAPTER_RE.match(s) or SECTION_RE.match(s) or SECTION_PREFIX_RE.match(s)):
                blocks.append(cur)
                cur = []
            cur.append(s)
        elif cur:
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)

    entries = []
    chapter = None
    chapter_title = None
    section = None

    for block in blocks:
        first = block[0]

        cm = CHAPTER_RE.match(first)
        if cm:
            chapter = int(cm.group(1))
            chapter_title = cm.group(2).strip()
            section = None
            continue

        sm = SECTION_RE.match(first)
        if sm:
            section = sm.group(1).strip()
            if len(block) > 1:
                block = block[1:]
            else:
                continue

        first = block[0]
        sm = SECTION_RE.match(first) if len(block) == 1 else None
        if sm:
            section = sm.group(1).strip()
            continue

        sp = SECTION_PREFIX_RE.match(first)
        if sp:
            section = sp.group(1).strip()
            block = [sp.group(2).strip()] + block[1:]

        for entry_block in split_multi_entry_block(block):
            # Section headings such as "Hallo! Tsch\u00fcs!" have no translation.
            if len(entry_block) < 2:
                continue

            split_at = find_translation_split(entry_block)
            german = re.sub(r"\s+", " ", " ".join(entry_block[:split_at])).strip()
            english = re.sub(r"\s+", " ", " ".join(entry_block[split_at:])).strip()

            if german:
                entries.append({
                    "chapter": chapter,
                    "chapter_title": chapter_title,
                    "section": section,
                    "german": german,
                    "english": english,
                })

    return entries


def find_translation_split(block):
    """Return the index where English translation lines start."""
    if len(block) == 2:
        return 1

    for idx in range(1, len(block)):
        german = " ".join(block[:idx])
        if german.count("(") > german.count(")"):
            continue
        if ENGLISH_START_RE.match(block[idx].strip()):
            return idx

    return max(1, len(block) // 2)


def classify(e):
    g = e["german"]

    m = re.match(rf"^(der/die|die/der|der|die|das)\s+([{UPPER}][\w{U}-]*)", g)
    if m:
        article = m.group(1).split("/")[0]
        word = m.group(2)
        rest = g[m.end():].strip()
        plural_hint = None
        pm = re.match(rf",\s*([\-–—\"]\w*|\.\.\s*\w+|[{UPPER}][\w{U}-]*)", rest)
        if pm:
            plural_hint = pm.group(1).strip()
        modifiers = []
        if "(Sg.)" in g or "(nur Sg.)" in g:
            modifiers.append("nur Sg.")
        if "(Pl.)" in g or "(nur Pl.)" in g:
            modifiers.append("nur Pl.")
        return {**e, "kind": "noun", "lemma": word,
                "article": article, "plural_hint": plural_hint, "modifiers": modifiers}

    if g.startswith("sich "):
        body = g[5:]
        m = re.match(rf"^([{LOWER}][{LOWER}-]+)", body)
        if m and re.search(r"(en|eln|ern|n)$", m.group(1)):
            return {**e, "kind": "verb", "lemma": m.group(1).replace("|", ""), "reflexive": True}

    m = re.match(rf"^([{LOWER}][{LOWER}|-]*[{LOWER}])", g)
    if m:
        word = m.group(1).replace("|", "")
        rest = g[m.end():].strip()
        if re.search(r"(en|eln|ern)$", word) and len(word) > 3 and (
            not rest or rest.startswith((",", "(")) or "|" in m.group(1)
        ):
            return {**e, "kind": "verb", "lemma": word, "reflexive": False}
        return {**e, "kind": "adj", "lemma": word}

    m = re.match(rf"^([{UPPER}][{LOWER}]+)$", g)
    if m:
        return {**e, "kind": "adj", "lemma": m.group(1)}
    return {**e, "kind": "expression", "lemma": g}


def main():
    raw_path = sys.argv[1]
    out_path = sys.argv[2]
    entries = parse(raw_path)
    parsed = [classify(e) for e in entries]
    Path(out_path).write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Parsed {len(parsed)} entries -> {out_path}")
    print("Kinds:", dict(Counter(e["kind"] for e in parsed)))
    print("Chapters:", sorted({e["chapter"] for e in parsed if e["chapter"]}))


if __name__ == "__main__":
    main()
