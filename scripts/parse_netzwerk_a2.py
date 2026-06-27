"""Parse Netzwerk neu A2 glossary into entries.

A2 has German + English glued together with no separator. We extract the
German lemma using pattern matching (article+noun, verb-shape, adj-shape)
without trying to perfectly separate the trailing English. The English
can come from DeepL during the audit fill-in step.
"""
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


CHAPTER_RE = re.compile(r"^Kapitel\s+(\d+):\s*(.+)$")
SECTION_RE = re.compile(r"^(\d+[a-z]?(?:\s+ÜB)?|k&k)$")
ENTRY_LINE_START_RE = re.compile(r"^(\d+[a-z]?(?:\s+ÜB)?|k&k)\s+(.+)$")
SKIP_LINE_RE = re.compile(
    r"^(=== PAGE\s+\d+\s*===|Glossar|Deutsch – Englisch|Netzwerk neu A2|"
    r"© Ernst Klett|Alle Rechte|eigenen Unterrichts|Glossar Deutsch|Seite\s+\d+|"
    r"Übersetzt von|Netzwerk neu)"
)


# Patterns to extract the German lemma from a glued line.
# Match noun: (der|die|das) Word with optional plural hint immediately after.
NOUN_RE = re.compile(
    r"^(der/die|die/der|der|die|das)\s*([A-ZÄÖÜ][a-zäöüßÄÖÜA-Z\-]*)"
    r"(?:\s*,\s*([\-\"\.\w]+?))?"
)
# Match reflexive verb: "sich verb"
VERB_REFLEX_RE = re.compile(r"^sich\s+([a-zäöüß][a-zäöüß|\-]*)")
# Match plain verb (lowercase ending in -en/-eln/-ern, may have | for separable)
VERB_RE = re.compile(r"^([a-zäöüß][a-zäöüß|\-]*[aeiouäöü][a-zäöüß]*(?:en|eln|ern))(?=[,\s\(]|$)")
# Match adjective (capitalized e.g. language name, or lowercase)
ADJ_CAP_RE = re.compile(r"^([A-ZÄÖÜ][a-zäöüß]+)\b")
ADJ_LOW_RE = re.compile(r"^([a-zäöüß][a-zäöüß\-]*[a-zäöüß])\b")

COMMON_FUNCTION_WORDS = {
    "als", "also", "außer", "außerdem", "dafür", "damals", "damit",
    "dann", "deshalb", "etwa", "fast", "ganz", "hin", "je", "mehr",
    "nirgends", "nun", "ob", "paar", "quer", "rückwärts", "sogar",
    "trotzdem", "unter", "usw", "weg", "weil", "wenn", "wenigstens",
    "wohl", "wofür", "worum", "worauf", "wovon", "zuletzt",
}

COMMON_ADJECTIVE_PREFIXES = {
    "dabei", "ehrlich", "fließend", "freiwillig", "geboren", "geschieden",
    "gemeinsam", "konjugiert", "romantisch", "spannend", "unpraktisch",
}


def parse(raw_path):
    raw = Path(raw_path).read_text(encoding="utf-8")
    lines = []
    for ln in raw.splitlines():
        s = ln.rstrip()
        if SKIP_LINE_RE.match(s.strip()):
            continue
        lines.append(s.strip())

    entries = []
    chapter = None
    chapter_title = None
    section = None

    for ln in lines:
        if not ln:
            continue
        cm = CHAPTER_RE.match(ln)
        if cm:
            chapter = int(cm.group(1))
            chapter_title = cm.group(2).strip()
            section = None
            continue
        sm = SECTION_RE.match(ln)
        if sm:
            section = sm.group(1).strip()
            continue
        em = ENTRY_LINE_START_RE.match(ln)
        if em:
            section = em.group(1).strip()
            content = em.group(2).strip()
        else:
            content = ln

        # An entry. Try to identify lemma + kind.
        kind, lemma, meta = classify_content(content)
        entries.append({
            "chapter": chapter,
            "chapter_title": chapter_title,
            "section": section,
            "german": content,
            "kind": kind,
            "lemma": lemma,
            **meta,
        })

    return entries


_dictionary = None


def get_dictionary():
    global _dictionary
    if _dictionary is None:
        nouns = [n for n in json.loads(Path("data/nouns.json").read_text(encoding="utf-8"))["nouns"]
                 if not str(n.get("source", "")).startswith("netzwerk-")]
        verbs = [v for v in json.loads(Path("data/verbs.json").read_text(encoding="utf-8"))["verbs"]
                 if not str(v.get("source", "")).startswith("netzwerk-")]
        adjs = [a for a in json.loads(Path("data/adjectives.json").read_text(encoding="utf-8"))["adjectives"]
                if not str(a.get("source", "")).startswith("netzwerk-")]
        _dictionary = {
            "noun": {n["word"] for n in nouns},
            "verb": {v["word"] for v in verbs},
            "adj": (
                {a["word"] for a in adjs}
                | {a["word"].lower() for a in adjs}
                | COMMON_FUNCTION_WORDS
                | COMMON_ADJECTIVE_PREFIXES
            ),
        }
    return _dictionary


def find_longest_german_prefix(text, dictionary):
    """Try to find the longest German word/lemma prefix in `text`.

    Returns (lemma, kind) where kind is 'verb' or 'adj', or (None, None).
    """
    # First, the leading lowercase token (no spaces).
    m = re.match(r"^([a-zäöüß][a-zäöüß|\-]+)", text)
    if not m:
        return None, None
    candidate = m.group(1).replace("|", "")
    # Try truncating from the end until we hit a known word.
    for length in range(len(candidate), 1, -1):
        prefix = candidate[:length]
        if prefix in dictionary["verb"]:
            return prefix, "verb"
        if prefix in dictionary["adj"] or prefix.lower() in dictionary["adj"]:
            return prefix, "adj"
    return None, None


def classify_content(text):
    # Noun
    m = NOUN_RE.match(text)
    if m:
        article_raw = m.group(1)
        article = article_raw.split("/")[0].strip()
        word = m.group(2)
        plural_hint = m.group(3)
        modifiers = []
        if "(Sg.)" in text or "(nur Sg.)" in text:
            modifiers.append("nur Sg.")
        if "(Pl.)" in text or "(nur Pl.)" in text:
            modifiers.append("nur Pl.")
        return "noun", word, {"article": article, "plural_hint": plural_hint, "modifiers": modifiers}
    # Reflexive verb
    m = VERB_REFLEX_RE.match(text)
    if m:
        return "verb", m.group(1).replace("|", ""), {"reflexive": True}
    # Try dictionary lookup for the cleanest lemma prefix.
    dictionary = get_dictionary()
    lemma, kind = find_longest_german_prefix(text, dictionary)
    if lemma:
        return kind, lemma, {}
    # Capitalized example sentences/headings are not vocabulary entries.
    if "?" in text or re.search(r"\b(ihr|du|Sie|wir|er|sie|es)\b", text):
        return "expression", text, {}
    # Plain verb (separable or not)
    m = VERB_RE.match(text)
    if m:
        return "verb", m.group(1).replace("|", ""), {"reflexive": False}
    # Adjective (capitalized — language names etc.)
    m = ADJ_CAP_RE.match(text)
    if m:
        return "adj", m.group(1), {}
    # Adjective (lowercase)
    m = ADJ_LOW_RE.match(text)
    if m:
        return "adj", m.group(1), {}
    return "expression", text, {}


def main():
    raw_path = sys.argv[1]
    out_path = sys.argv[2]
    entries = parse(raw_path)
    Path(out_path).write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Parsed {len(entries)} entries -> {out_path}")
    print("Kinds:", dict(Counter(e["kind"] for e in entries)))
    print("Chapters:", sorted({e["chapter"] for e in entries if e["chapter"]}))


if __name__ == "__main__":
    main()
