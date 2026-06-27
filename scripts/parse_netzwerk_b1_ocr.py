"""Parse Windows-OCRed Netzwerk neu B1 glossary line text.

The OCR output is line-oriented: on each page the German column appears first,
then the English column. We use the German column for deck membership and pair
translations by line order where possible for missing word-bank additions.
"""
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "audit" / "nwn_b1_ocr_lines.txt"
PARSED = ROOT / "audit" / "nwn_b1_parsed.json"
SUMMARY = ROOT / "audit" / "nwn_b1_summary.md"

U = "ÄÖÜäöüß"
LOWER = f"a-zäöüß"
UPPER = f"A-ZÄÖÜ"

CHAPTERS = {
    1: "Gute Reise!",
    2: "Das ist ja praktisch!",
    3: "Veränderungen",
    4: "Arbeitswelt",
    5: "Umweltfreundlich?",
    6: "Blick nach vorn",
    7: "Zwischenmenschliches",
    8: "Rund um Körper und Geist",
    9: "Kunststücke",
    10: "Miteinander",
    11: "Stadt, Land, Fluss",
    12: "Geld regiert die Welt?",
}

# First PDF page for each chapter, from the printed glossary pagination.
CHAPTER_START_PAGE = {
    1: 1,
    2: 4,
    3: 7,
    4: 11,
    5: 16,
    6: 20,
    7: 23,
    8: 27,
    9: 32,
    10: 35,
    11: 39,
    12: 42,
}

HEADER_RE = re.compile(
    r"^(Glossar|Deutsch.*|Übersetzt.*|Netzwerk.*|Seite\s+\d+|©|O Ernst|Alle Rechte|"
    r"Unterrichtsgebrauch|Deutsch ais|Deutsch als|Deutsch aIs|Klett|B1|Bl)$",
    re.I,
)
SECTION_RE = re.compile(r"^(\d+[a-z]?(?:\s*(?:ÜB|UB|ijB|iJB))?|k&k)$", re.I)
CHAPTER_RE = re.compile(r"^Kapitel\s+(\d+):")
ARTICLE_RE = re.compile(r"^(der/die|die/der|der|die|das)\s+(.+)$", re.I)

OCR_FIXES = {
    "Wrlaub": "Urlaub",
    "Vrlaub": "Urlaub",
    "Urlaü": "Urlaub",
    "VQll": "Voll",
    "Qffenbar": "offenbar",
    "KQste": "Küste",
    "KQffer": "Koffer",
    "grQnd": "gründ",
    "erhQlen": "erholen",
    "blQß": "bloß",
    "kQmmen": "kommen",
    "Chet": "Chat",
    "Hglb": "Halb",
    "Genvss": "Genuss",
    "Schetz": "Schutz",
    "Schgtz": "Schutz",
    "Send": "Sand",
    "Elmer": "Eimer",
    "TJergarten": "Tiergarten",
    "Empfgng": "Empfang",
    "Kdserei": "Käserei",
    "Transpart": "Transport",
    "Frgge": "Frage",
    "Stgubsauger": "Staubsauger",
    "Knapf": "Knopf",
    "Gebrguch": "Gebrauch",
    "Wend": "Wand",
    "Tgschentuch": "Taschentuch",
    "Aduerb": "Adverb",
    "Hergusforderung": "Herausforderung",
    "Priugt": "Privat",
    "Zou": "Zoo",
    "Fgch": "Fach",
    "trggen": "tragen",
    "qngenehm": "angenehm",
    "gngenehm": "angenehm",
    "grQndlich": "gründlich",
    "entspgnnend": "entspannend",
    "fgulenzen": "faulenzen",
    "laijB": "1a ÜB",
    "1m ": "Im ",
    " aIs ": " als ",
}

NOISE_WORDS = {
    "Glossar", "Deutsch", "Englisch", "Übersetzt", "Jennifer", "Perryman",
    "Kapitel", "Seite", "Netzwerk", "Klett", "Ernst", "Sprachen", "GmbH",
    "Stuttgart", "Fremdsprache", "Bl", "BI", "B1",
}


def load_bank_words() -> dict[str, set[str]]:
    nouns = json.loads((ROOT / "data/nouns.json").read_text(encoding="utf-8"))["nouns"]
    verbs = json.loads((ROOT / "data/verbs.json").read_text(encoding="utf-8"))["verbs"]
    adjs = json.loads((ROOT / "data/adjectives.json").read_text(encoding="utf-8"))["adjectives"]
    return {
        "noun": {n["word"] for n in nouns},
        "verb": {v["word"] for v in verbs},
        "adj": {a["word"] for a in adjs} | {a["word"].lower() for a in adjs},
    }


def current_chapter(page: int) -> int:
    starts = sorted((start, chapter) for chapter, start in CHAPTER_START_PAGE.items())
    chapter = 1
    for start, ch in starts:
        if page >= start:
            chapter = ch
    return chapter


def clean_line(line: str) -> str:
    s = line.strip()
    for old, new in OCR_FIXES.items():
        s = s.replace(old, new)
    s = re.sub(r"q(?!u)", "a", s)
    s = re.sub(r"(?<=[A-Za-zÄÖÜäöüß])j", "i", s)
    s = re.sub(r"([bcdfghjklmnpqrstwxzBCDFGHJKLMNPQRSTWXZ])v", r"\1u", s)
    s = re.sub(r"v([bcdfghjklmnpqrstwxz])", r"u\1", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def pages_from_raw(raw: str) -> list[tuple[int, list[str]]]:
    out: list[tuple[int, list[str]]] = []
    page = None
    lines: list[str] = []
    for line in raw.splitlines():
        m = re.match(r"^=== PAGE (\d+) ===$", line.strip())
        if m:
            if page is not None:
                out.append((page, lines))
            page = int(m.group(1))
            lines = []
        else:
            lines.append(clean_line(line))
    if page is not None:
        out.append((page, lines))
    return out


def split_columns(lines: list[str]) -> tuple[list[str], list[str]]:
    # English column starts around the second "Netzwerk neu" logo/footer line,
    # or at the first obvious English translation if the logo was missed.
    split_at = None
    for i, line in enumerate(lines):
        if i > 8 and re.search(r"Netzwerk neu B[1lI]", line):
            split_at = i + 1
            break
        if i > 8 and re.match(r"^(to|the|a |an |in |on |hier:|here:|yes|no)\b", line, re.I):
            split_at = i
            break
    if split_at is None:
        split_at = len(lines)
    return lines[:split_at], lines[split_at:]


def usable_german_lines(lines: list[str]) -> list[str]:
    out = []
    for line in lines:
        if not line:
            continue
        if CHAPTER_RE.match(line):
            continue
        if HEADER_RE.match(line):
            continue
        if re.search(r"www\.klett|Rechte vorbehalten|Kopiergebühren", line):
            continue
        out.append(line)
    return out


def usable_english_lines(lines: list[str]) -> list[str]:
    out = []
    for line in lines:
        if not line or HEADER_RE.match(line):
            continue
        if re.search(r"www\.klett|Rechte vorbehalten|Kopiergebühren|Glossar Deutsch", line):
            continue
        s = line.strip()
        if out:
            prev = out[-1]
            if (
                prev.count("(") > prev.count(")")
                or re.search(r"\b(at|for|of|to|a|the|everyone)$", prev, re.I)
                or re.match(r"^(during|night|holiday home\.\)|what|how|where|when|who)\b", s, re.I)
            ):
                out[-1] = prev + " " + s
                continue
        out.append(s)
    return out


def looks_like_heading(line: str) -> bool:
    if SECTION_RE.match(line) or CHAPTER_RE.match(line):
        return True
    am = ARTICLE_RE.match(line)
    if am and am.group(1)[0].islower():
        return False
    if re.match(rf"^[{UPPER}][\w{U}{LOWER}\s,!?-]+$", line) and len(line.split()) <= 5:
        return True
    return False


def looks_like_continuation(line: str) -> bool:
    if not line:
        return True
    if ARTICLE_RE.match(line):
        return False
    if line.startswith(("(", ")", ",", ".")):
        return True
    if re.match(r"^(dem|den|ist|hat|sind|war|wird|für|von)\b", line):
        return True
    if line.endswith(")") and not ARTICLE_RE.match(line) and not re.match(rf"^[{LOWER}|-]+", line):
        return True
    return False


def normalize_word(word: str) -> str:
    w = word.strip(" ,.;:!?()[]{}“”\"'")
    w = w.replace("|", "")
    for old, new in {
        "gnl": "an", "anl": "an", "gufl": "auf", "aufl": "auf",
        "gusl": "aus", "ausl": "aus", "einl": "ein", "nachl": "nach",
        "zuruckl": "zurück", "zurackl": "zurück", "durchl": "durch",
        "herunterl": "herunter", "wegl": "weg", "freil": "frei",
        "zusammenl": "zusammen", "gbl": "ab", "abl": "ab",
        "vorl": "vor", "uml": "um", "mitl": "mit", "davanl": "davon",
        "heruml": "herum", "heruorl": "hervor",
    }.items():
        if w.startswith(old):
            w = new + w[len(old):]
            break
    for old, new in OCR_FIXES.items():
        w = w.replace(old, new)
    return w


def edit_distance(a: str, b: str, limit: int) -> int:
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        row_min = cur[0]
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            val = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            cur.append(val)
            row_min = min(row_min, val)
        if row_min > limit:
            return limit + 1
        prev = cur
    return prev[-1]


def fold_ocr(s: str) -> str:
    return (
        s.lower()
        .replace("q", "a")
        .replace("j", "i")
        .replace("v", "u")
        .replace("ü", "u")
        .replace("ö", "o")
        .replace("ä", "a")
        .replace("ß", "ss")
        .replace("é", "e")
        .replace("è", "e")
        .replace("l", "i")
    )


def correct_lemma(word: str, kind: str, bank: dict[str, set[str]]) -> str:
    if word in bank[kind] or word.lower() in bank[kind]:
        return word
    # Only fuzzy-correct words that carry common OCR artifacts. This avoids
    # turning valid new glossary compounds into unrelated known bank entries
    # (for example Urlaubstyp -> Urlaubstag).
    if not re.search(r"[qQjvVüöéè]", word):
        return word
    folded = fold_ocr(word)
    limit = 1 if len(word) <= 6 else 2 if len(word) <= 11 else 3
    best = None
    best_dist = limit + 1
    for candidate in bank[kind]:
        if abs(len(candidate) - len(word)) > limit:
            continue
        if fold_ocr(candidate)[0:1] != folded[0:1]:
            continue
        dist = edit_distance(fold_ocr(candidate), folded, limit)
        if dist < best_dist:
            best = candidate
            best_dist = dist
            if dist == 0:
                break
    return best if best is not None and best_dist <= limit else word


def parse_noun(line: str, english: str | None, bank: dict[str, set[str]]) -> dict | None:
    m = ARTICLE_RE.match(line)
    if not m:
        return None
    if m.group(1)[0].isupper():
        return None
    article = m.group(1).split("/")[0].lower()
    rest = m.group(2).strip()
    wm = re.match(rf"([{UPPER}][\w{U}-]*)", rest)
    if not wm:
        return None
    word = correct_lemma(normalize_word(wm.group(1)), "noun", bank)
    if word in NOISE_WORDS:
        return None
    after = rest[wm.end():].strip()
    plural_hint = None
    pm = re.match(r'^\s*,\s*([-"„“]?\w+|-\w+|-[a-zäöüß]+|"-\w+|-\s*)', after)
    if pm:
        plural_hint = pm.group(1).replace(" ", "")
    modifiers = []
    if "(Sg" in line or "Sg.)" in line:
        modifiers.append("nur Sg.")
    if "(Pl" in line or "PL)" in line or "(PI" in line:
        modifiers.append("nur Pl.")
    return {
        "kind": "noun",
        "lemma": word,
        "article": article,
        "plural_hint": plural_hint,
        "modifiers": modifiers,
        "german": line,
        "english": english or "",
    }


def parse_verb_or_adj(line: str, english: str | None, bank: dict[str, set[str]]) -> dict | None:
    s = line.strip()
    if SECTION_RE.match(s) or len(s) < 3:
        return None
    if s in NOISE_WORDS:
        return None
    # Ignore obvious headings/sentences.
    if s[0].isupper() and not s.split()[0] in bank["adj"]:
        return None
    if " " in s and not re.match(r"^[a-zäöüß|]+(?:,|\s+\(sich\)|\s*\()", s):
        return None

    if s.startswith("sich "):
        body = s[5:]
        m = re.match(rf"([{LOWER}|-]+)", body)
        if m:
            return {"kind": "verb", "lemma": correct_lemma(normalize_word(m.group(1)), "verb", bank), "german": line, "english": english or "", "reflexive": True}

    m = re.match(rf"([{LOWER}|-]+)", s)
    if not m:
        return None
    word = normalize_word(m.group(1))
    if word in NOISE_WORDS or len(word) < 3:
        return None
    rest = s[m.end():].strip()
    english_says_verb = bool(english and re.match(r"^(to|hier: to|here: to)\b", english, re.I))
    if re.search(r"(en|eln|ern)$", word) and (
        word in bank["verb"] or english_says_verb or rest.startswith(",") or rest.startswith("(") or "(sich)" in s
    ):
        return {"kind": "verb", "lemma": correct_lemma(word, "verb", bank), "german": line, "english": english or "", "reflexive": "(sich)" in s}
    if word in bank["adj"] or word.lower() in bank["adj"] or not rest:
        return {"kind": "adj", "lemma": correct_lemma(word, "adj", bank), "german": line, "english": english or ""}
    return None


def parse() -> list[dict]:
    raw = RAW.read_text(encoding="utf-8")
    bank = load_bank_words()
    entries: list[dict] = []
    current_section = None

    for page, lines in pages_from_raw(raw):
        chapter = current_chapter(page)
        left, right = split_columns(lines)
        german_lines = usable_german_lines(left)
        english_lines = usable_english_lines(right)
        english_i = 0

        for line in german_lines:
            if SECTION_RE.match(line):
                current_section = line
                continue
            if looks_like_continuation(line):
                continue
            english = english_lines[english_i] if english_i < len(english_lines) else ""
            entry = parse_noun(line, english, bank)
            if entry is None:
                entry = parse_verb_or_adj(line, english, bank)
            if entry is not None:
                entry.update({
                    "chapter": chapter,
                    "chapter_title": CHAPTERS[chapter],
                    "section": current_section,
                    "page": page,
                })
                entries.append(entry)
            if entry is not None or not looks_like_heading(line):
                english_i += 1

    # De-duplicate repeated OCR/header artefacts while preserving first chapter occurrence.
    deduped = []
    seen = set()
    for e in entries:
        key = (e["chapter"], e["kind"], e["lemma"], e.get("section"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)
    return deduped


def main() -> None:
    entries = parse()
    PARSED.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = Counter(e["kind"] for e in entries)
    chapters = Counter(e["chapter"] for e in entries)
    lines = [
        "# Netzwerk neu B1 OCR parse summary",
        "",
        f"Parsed {len(entries)} entries from OCR lines.",
        "",
        "| Kind | Count |",
        "|---|---:|",
    ]
    for kind in ["noun", "verb", "adj"]:
        lines.append(f"| {kind} | {counts[kind]} |")
    lines.extend(["", "| Chapter | Entries |", "|---:|---:|"])
    for chapter in sorted(chapters):
        lines.append(f"| {chapter} | {chapters[chapter]} |")
    SUMMARY.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Parsed {len(entries)} entries -> {PARSED.relative_to(ROOT)}")
    print("Kinds:", dict(counts))
    print("Chapters:", dict(sorted(chapters.items())))


if __name__ == "__main__":
    main()
