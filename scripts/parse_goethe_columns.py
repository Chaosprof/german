"""Parse a Goethe / Start Deutsch wordlist into headword entries using
pdftotext -layout output.

The Goethe lists use one or two column pairs: each column pair has a
headword on the left and an example sentence on the right. We detect the
headword column by looking at the gap pattern: a headword followed by 4+
spaces, then an example sentence.

Usage: parse_goethe_columns.py <input.pdf> <out_path.json>

This is intended to replace the line-based heuristic in
audit_goethe_wordlist.py for the Goethe PDFs.
"""
import json
import re
import subprocess
import sys
from pathlib import Path


HEADWORD_LINE_RE = re.compile(
    # Allow leading whitespace, then capture the headword (which may include
    # spaces, like "der Apparat, -e" or "(sich) anmelden"), then 3+ spaces,
    # then the example.
    r"^\s+(?P<head>(?:der|die|das|der\s*/\s*die|die\s*/\s*der)\s+[A-ZÄÖÜ][^\s][^\n]*?|"
    r"\(sich\)\s+[a-zäöüß][^\n]*?|"
    r"[a-zäöüß][a-zäöüß\-]*[\-]?)\s{3,}(?P<example>[A-ZÄÖÜß(].*)$"
)


def normalize(text):
    text = text.replace("ﬂ", "fl").replace("ﬁ", "fi")
    return text


def is_skip_line(line):
    s = line.strip()
    if not s:
        return True
    if s.startswith("VS_") or s.startswith("Seite") or s.startswith("WORTLISTE"):
        return True
    if s in {"Inventare", "Wortliste", "Alphabetische", "Wortgruppenliste"}:
        return True
    if re.fullmatch(r"\d+", s):
        return True
    if re.fullmatch(r"[A-ZÄÖÜß]", s):
        return True
    return False


def find_columns(line):
    """Find headword/example column pairs in a single line.

    A line may carry one or two pairs (Goethe A2/B1 use two columns side
    by side). Returns list of (head, example_start) tuples representing
    each detected pair on the line.
    """
    matches = []
    pos = 0
    while True:
        m = HEADWORD_LINE_RE.search(line, pos=pos)
        if not m:
            break
        matches.append((m.group("head").rstrip(), m.start("example")))
        pos = m.end()
    return matches


def parse_pdf(pdf_path):
    out = subprocess.run(
        ["pdftotext", "-layout", "-enc", "UTF-8", str(pdf_path), "-"],
        capture_output=True,
        check=True,
    )
    text = normalize(out.stdout.decode("utf-8"))
    lines = text.splitlines()
    # Cut at "Literatur" section heading.
    end = len(lines)
    for i, ln in enumerate(lines):
        if ln.strip() == "Literatur" and i > 50:
            end = i
            break
    lines = lines[:end]

    headwords = []
    for ln in lines:
        if is_skip_line(ln):
            continue
        for head, _ in find_columns(ln):
            headwords.append(head)
    return headwords


def classify(head):
    text = head
    # Article noun (with optional dual article)
    m = re.match(r"^(der|die|das|der\s*/\s*die|die\s*/\s*der)\s+([A-ZÄÖÜ][\wäöüÄÖÜß-]*)", text)
    if m:
        article = re.sub(r"\s+", "", m.group(1))
        word = m.group(2)
        rest = text[m.end():].strip()
        # Glue continuation when a hyphen ends the word and rest starts lowercase
        cont = re.match(r"^([a-zäöüß][\wäöüÄÖÜß-]*)", rest)
        if cont and word.endswith("-"):
            word = word[:-1] + cont.group(1)
            rest = rest[cont.end():].strip()
        plural_hint = None
        pm = re.match(r",\s*([\-–—¨][\wÄÖÜäöüß]*|\(Pl\.\)|\.\.\s*\w+|[A-ZÄÖÜ][\wÄÖÜäöüß-]+)", rest)
        if pm:
            plural_hint = pm.group(1).strip()
        modifiers = []
        if "(Sg.)" in text or "(nur Sg.)" in text:
            modifiers.append("nur Sg.")
        if "(Pl.)" in text or "(nur Pl.)" in text:
            modifiers.append("nur Pl.")
        return {"kind": "noun", "lemma": word, "article": article, "plural_hint": plural_hint, "modifiers": modifiers, "text": text}
    m = re.match(r"^\(sich\)\s+([a-zäöüß][a-zäöüß-]+)", text)
    if m:
        return {"kind": "verb", "lemma": m.group(1), "reflexive": True, "text": text}
    m = re.match(r"^([a-zäöüß][a-zäöüß-]*)", text)
    if m:
        word = m.group(1)
        if word.endswith("-"):
            return {"kind": "adj_stem", "lemma": word[:-1], "text": text}
        if re.search(r"(en|eln|ern)$", word) and len(word) > 3:
            return {"kind": "verb", "lemma": word, "reflexive": False, "text": text}
        return {"kind": "adj", "lemma": word, "text": text}
    return {"kind": "expression", "lemma": text, "text": text}


def main():
    pdf_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    heads = parse_pdf(pdf_path)
    parsed = [classify(h) for h in heads]
    out_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(parsed)} entries to {out_path}")
    from collections import Counter
    print("Kinds:", dict(Counter(e["kind"] for e in parsed)))


if __name__ == "__main__":
    main()
