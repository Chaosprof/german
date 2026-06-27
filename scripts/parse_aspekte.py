"""Parse an Aspekte neu Kapitelwortschatz PDF text into entries.

The Aspekte format groups vocabulary by chapter (`Kapitel N - Title`) and
within each chapter by module (`Modul N`). Sub-section markers like `1a`,
`2b` precede each block of entries. Entries take one of these shapes:

    die Vorstellung, -en (Meine Vorstellung von Heimat ist ...)
    auflösen (eine Wohnung auflösen)
    leichtfallen, fiel leicht, ist leichtgefallen
    der/die Nachmieter/in, -/-nen
    abenteuerlich
    auswandern (nach + D.)

Output: audit/<slug>_parsed.json with a list of entries that include
chapter/module/section context plus a kind/lemma classification.
"""
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# Lines we drop before processing.
SKIP_LINE_RE = re.compile(
    r"^(Kapitelwortschatz\s*$|Aspekte neu (B2|C1)\s*$|Seite\s+\d+\s*$|"
    r"Der Wortschatz von|Quellenverzeichnis|=== PAGE\s+\d+\s*===)"
)


CHAPTER_RE = re.compile(r"^Kapitel\s+(\d+)\s*[–-]\s*(.+)$")
MODULE_RE = re.compile(r"^Modul\s+(\d+)\s*$")
# Section markers like "1a", "2c", "11d", but NOT lines that begin with such
# markers AND continue with content (the section marker is always at the
# start of a content line, followed by an entry on the same line).
SECTION_MARKER_RE = re.compile(r"^(\d+[a-z]?)(?=\s|$)")


def parse_raw(raw_path):
    raw = Path(raw_path).read_text(encoding="utf-8")
    lines = []
    for ln in raw.splitlines():
        s = ln.rstrip()
        if not s.strip():
            continue
        if SKIP_LINE_RE.match(s.strip()):
            continue
        lines.append(s)

    entries = []
    chapter = None
    chapter_title = None
    module = None
    section = None

    # Reading state: accumulate continuation lines for a multi-line entry.
    # A new entry starts when:
    #   - the line begins with der/die/das/(sich)/sich-prefix, or
    #   - the line starts with a lowercase letter (verb/adj/adv), or
    #   - the line begins with a section marker followed by such a pattern
    # A continuation is a line that doesn't match any of these AND where
    # the previous entry has unbalanced parens.
    i = 0
    current_entry = None
    while i < len(lines):
        ln = lines[i]
        cm = CHAPTER_RE.match(ln)
        if cm:
            if current_entry:
                entries.append(current_entry)
                current_entry = None
            chapter = int(cm.group(1))
            chapter_title = cm.group(2).strip()
            module = None
            section = None
            i += 1
            continue
        mm = MODULE_RE.match(ln)
        if mm:
            if current_entry:
                entries.append(current_entry)
                current_entry = None
            module = int(mm.group(1))
            i += 1
            continue

        # Strip optional leading section marker.
        section_match = SECTION_MARKER_RE.match(ln)
        text = ln
        if section_match:
            new_section = section_match.group(1)
            text = ln[section_match.end():].lstrip()
            if text:
                # New entry (with section marker)
                if current_entry:
                    entries.append(current_entry)
                section = new_section
                current_entry = {
                    "chapter": chapter,
                    "chapter_title": chapter_title,
                    "module": module,
                    "section": section,
                    "text": text,
                }
                i += 1
                # Continue gathering continuation lines if needed.
                continue
            else:
                # Lone section marker on a line. Skip and continue.
                section = new_section
                i += 1
                continue

        # Entry-start heuristic.
        is_entry_start = re.match(r"^(der/die|der|die|das|sich)\s+\S+", text) or re.match(r"^[a-zäöüß]", text)

        if is_entry_start and (
            not current_entry or _is_complete(current_entry["text"])
        ):
            if current_entry:
                entries.append(current_entry)
            current_entry = {
                "chapter": chapter,
                "chapter_title": chapter_title,
                "module": module,
                "section": section,
                "text": text,
            }
        else:
            # Continuation of current entry.
            if current_entry:
                current_entry["text"] = (current_entry["text"] + " " + text).strip()
            # else: stray line, ignore
        i += 1

    if current_entry:
        entries.append(current_entry)

    # Normalize text: collapse whitespace
    for e in entries:
        e["text"] = re.sub(r"\s+", " ", e["text"]).strip()

    return entries


def _is_complete(text):
    """Heuristic: consider an entry complete when parentheses are balanced."""
    return text.count("(") <= text.count(")")


# Classification (similar to Vielfalt).
ARTICLE_RE = re.compile(r"^(der/die|die/der|der|die|das)\s+([A-ZÄÖÜ][\wÄÖÜäöüß-]*)")
VERB_REFLEX_RE = re.compile(r"^(?:sich\s+|sich(?=\s))?")
VERB_TOKEN_RE = re.compile(r"^([a-zäöüß][a-zäöüß-]*[a-zäöüß])(?:,|\s|\(|$)")


def classify(entry):
    text = entry["text"]
    # Noun?
    m = ARTICLE_RE.match(text)
    if m:
        article = m.group(1).replace("/die", "/die").replace(" ", "")
        word = m.group(2)
        rest = text[m.end():].strip()
        # Fix glued continuation
        plural_hint = None
        pm = re.match(r",\s*([\-–—\"]\w*|\.\.\s*\w+|[A-ZÄÖÜ][\wÄÖÜäöüß-]*)", rest)
        if pm:
            plural_hint = pm.group(1).strip()
        modifiers = []
        if "(Sg.)" in text or "(nur Sg.)" in text:
            modifiers.append("nur Sg.")
        if "(Pl.)" in text or "(nur Pl.)" in text:
            modifiers.append("nur Pl.")
        # Special: "der/die X/in" form
        if "/in" in word or "/in" in rest[:20]:
            return {**entry, "kind": "noun_pair", "lemma": word.replace("/in", ""),
                    "article": article, "plural_hint": plural_hint, "modifiers": modifiers}
        return {**entry, "kind": "noun", "lemma": word,
                "article": article, "plural_hint": plural_hint, "modifiers": modifiers}
    # Verb? lowercase + ends in -en/-eln/-ern, possibly with "(sich)" or "+ D./A."
    body = text
    is_reflexive = False
    if body.startswith("sich "):
        body = body[5:]
        is_reflexive = True
    m = VERB_TOKEN_RE.match(body)
    if m:
        word = m.group(1)
        if re.search(r"(en|eln|ern|n)$", word) and len(word) > 3:
            # Verbs typically have ", er <verb>, hat ge..." conjugation in entry
            if re.search(r",\s*(er|sie|es)\s|hat\s+\w+|ist\s+\w+|\(", text) or \
               re.match(r"^[a-zäöüß][a-zäöüß-]*$", body.split("(")[0].strip()):
                return {**entry, "kind": "verb", "lemma": word,
                        "reflexive": is_reflexive}
    # Adjective/adverb
    m = re.match(r"^([a-zäöüß][a-zäöüß-]*[a-zäöüß])(?:\s|\(|$|,)", text)
    if m:
        word = m.group(1)
        # Distinguish from verbs via stricter ending
        return {**entry, "kind": "adj", "lemma": word}
    return {**entry, "kind": "expression", "lemma": text}


def main():
    raw_path = sys.argv[1]
    out_path = sys.argv[2]
    entries = parse_raw(raw_path)
    parsed = [classify(e) for e in entries]
    Path(out_path).write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Parsed {len(parsed)} entries -> {out_path}")
    print("Kinds:", dict(Counter(e["kind"] for e in parsed)))
    print("Chapters:", sorted({e["chapter"] for e in parsed if e["chapter"]}))


if __name__ == "__main__":
    main()
