"""Parse the Vielfalt C1.1 glossary PDF text into structured entries."""
import json
import re
import sys
import io
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

RAW = open("audit/glossar_raw.txt", encoding="utf-8").read()

# Strip page headers/footers
LINES = []
for ln in RAW.splitlines():
    s = ln.rstrip()
    if not s.strip():
        continue
    if s.startswith("=== PAGE"):
        continue
    if s.startswith("Kurs- und Arbeitsbuch Vielfalt"):
        continue
    if s.startswith("Lernwortschatz"):
        continue
    if s.startswith("Vielfalt C1.1 – Glossar blanko"):
        continue
    LINES.append(s)

# Find first MODUL line and skip preamble
start = next((i for i, ln in enumerate(LINES) if ln.startswith("MODUL ")), 0)
LINES = LINES[start:]

UNDERSCORE_RE = re.compile(r"_{5,}")
SECTION_RE = re.compile(r"^(MODUL\s+\d+|Lektion\s+\d+)\b")

entries = []
current_module = None
current_lektion = None
current_section_title = None

i = 0
N = len(LINES)
while i < N:
    ln = LINES[i]
    if ln.startswith("MODUL "):
        current_module = ln.strip()
        i += 1
        continue
    if ln.startswith("Lektion "):
        current_lektion = ln.strip()
        if i + 1 < N and not SECTION_RE.match(LINES[i + 1]):
            current_section_title = LINES[i + 1].strip()
            i += 2
        else:
            current_section_title = None
            i += 1
        continue
    if re.fullmatch(r"\d+", ln.strip()):
        i += 1
        continue

    accumulated = []
    has_underscore = False
    while i < N:
        cur = LINES[i]
        if SECTION_RE.match(cur):
            break
        if re.fullmatch(r"\d+", cur.strip()):
            break
        m = UNDERSCORE_RE.search(cur)
        if m:
            german_part = cur[: m.start()].rstrip()
            if german_part:
                accumulated.append(german_part)
            has_underscore = True
            i += 1
            break
        else:
            accumulated.append(cur)
            i += 1
    if has_underscore:
        text = " ".join(s.strip() for s in accumulated if s.strip())
        # Soft-hyphen joining: "Selbstbewusst- sein" -> "Selbstbewusstsein"
        text = re.sub(r"(\S)-\s+(\S)", r"\1\2", text)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            entries.append({
                "module": current_module,
                "lektion": current_lektion,
                "lektion_title": current_section_title,
                "text": text,
            })

print(f"Total raw entries: {len(entries)}")


def parse_noun(text):
    """If text begins with a German article, extract noun lemma + plural hint.

    Returns (article, word, plural_form, modifiers) or None.
    """
    # die/der pair (e.g., "der Pate, -n / die Patin, -nen")
    # Also "der/die Beteiligte, -n", "die/der Befragte, -n"
    m = re.match(r"^(der|die|das)\s+([A-ZÄÖÜ][\wäöüÄÖÜß]*)", text)
    if not m:
        return None
    article = m.group(1)
    word = m.group(2)
    rest = text[m.end():].strip()
    # Re-glue PDF column-wrap artifacts: "Selbstwahr nehmung" -> "Selbstwahrnehmung",
    # "Anforderungs profil" -> "Anforderungsprofil". The pattern is a capitalized stem
    # followed by a lowercase tail. Only glue if the tail is followed by `,` or `(` or
    # end-of-string — NOT followed by a preposition like "der Streit um + Akk.".
    cont = re.match(r"^([a-zäöüß]+)(?=,|\s*\(|$)", rest)
    if cont:
        word = word + cont.group(1)
        rest = rest[cont.end():].strip()
    # Plural hint: ", <hint>" — accept "-suffix", bare "-", or ".. suffix"
    plural = None
    pm = re.match(r",\s*(\-\w*|\.\.\s*\w+|\-)", rest)
    if pm:
        plural = pm.group(1).strip()
    modifiers = []
    if "(nur Sg.)" in text:
        modifiers.append("nur Sg.")
    if "(nur Pl.)" in text:
        modifiers.append("nur Pl.")
    return {"article": article, "word": word, "plural": plural, "modifiers": modifiers}


def parse_verb(text):
    """If text looks like a verb entry, extract lemma.

    A verb entry is one of:
      - a single lowercase token ending in -en/-eln/-ern (e.g. "vererben")
      - a separable form with "|" (e.g. "an|vertrauen")
      - one of the above followed by reflexive/preposition info or a conjugation
        paren (e.g. "verweisen auf + Akk. (verweist, verwies, hat verwiesen)")
      - "sich <verb-form>"
    Excludes phrases like "jemanden auf die Palme bringen" where the first token
    is a pronoun rather than the verb.
    """
    body = text
    is_reflexive = False
    if body.startswith("sich "):
        body = body[5:]
        is_reflexive = True
    tokens = body.split()
    if not tokens:
        return None
    tok = tokens[0].rstrip(",")
    # Reject obvious non-verb leading tokens
    if tok in {"jemand", "jemanden", "jemandem", "jdm.", "jdn.", "etwas", "etw.", "in", "im",
               "auf", "an", "zu", "zur", "zum", "außer", "wenn", "Schwamm", "Bestand",
               "folgendermaßen", "entgegen", "wohingegen", "infolgedessen", "weswegen"}:
        return None
    # Separable form with bar
    if "|" in tok:
        lemma = tok.replace("|", "")
        if re.match(r"^[a-zäöüß]+(en|eln|ern|n)$", lemma):
            # Verify the rest is verb-like: nothing OR "(sich)" OR "<prep> + <case>" OR conjugation paren
            rest = body[len(tokens[0]):].strip()
            if rest_is_verby(rest):
                return {"lemma": lemma, "reflexive": is_reflexive, "separable": True}
        return None
    # Plain infinitive
    if re.match(r"^[a-zäöüß]+(en|eln|ern)$", tok):
        rest = body[len(tokens[0]):].strip()
        if rest_is_verby(rest):
            return {"lemma": tok, "reflexive": is_reflexive, "separable": False}
    return None


_VERBY_REST_RE = re.compile(
    r"^(?:"
    r"|\(sich\).*"                               # "(sich)" optionally followed by conjugation
    r"|\([^)]*\)"                                # just a conjugation paren
    r"|(?:auf|an|zu|in|bei|mit|von|über|um|für|nach|gegenüber|unter)\s*\+\s*(Akk\.|Dat\.|Gen\.).*"
    r"|sich\s.*"
    r")$",
    re.IGNORECASE,
)


def rest_is_verby(rest):
    if not rest:
        return True
    return bool(_VERBY_REST_RE.match(rest))


def parse_adj(text):
    """If text is a single lowercase word (adjective/adverb)."""
    if " " in text:
        return None
    m = re.match(r"^([a-zäöüß][a-zäöüß\-]+?)(-)?$", text)
    if not m:
        return None
    word = m.group(1)
    is_stem = bool(m.group(2))
    return {"lemma": word, "stem": is_stem}


def classify(text):
    n = parse_noun(text)
    if n:
        return ("noun", n["word"], {**n, "raw": text})
    v = parse_verb(text)
    if v:
        return ("verb", v["lemma"], {**v, "raw": text})
    a = parse_adj(text)
    if a:
        kind = "adj_stem" if a["stem"] else "adj"
        return (kind, a["lemma"], {**a, "raw": text})
    return ("expression", text, {"raw": text})


classified = []
for e in entries:
    kind, lemma, meta = classify(e["text"])
    classified.append({**e, "kind": kind, "lemma": lemma, "meta": meta})

with open("audit/glossar_parsed.json", "w", encoding="utf-8") as f:
    json.dump(classified, f, ensure_ascii=False, indent=2)

ctr = Counter(c["kind"] for c in classified)
print("Kinds:", dict(ctr))
print()

# Show all expressions to manually verify
print("=== All expressions (need manual review) ===")
exprs = [c for c in classified if c["kind"] == "expression"]
for e in exprs:
    print(f"  {e['text']}")
