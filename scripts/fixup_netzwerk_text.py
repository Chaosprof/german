"""Fix up Netzwerk PDF text where the font extraction dropped characters.

The PDF's embedded font has an incomplete ToUnicode CMap, causing certain
glyphs (random vowels) to be rendered as space when extracted. Words like
"nglisch" should be "Englisch", "Fl sche" should be "Flasche", etc.

We fix this by trying to insert/substitute each possible German letter at
each space gap (or at start of lowercase-broken words) and checking
against a known-words dictionary built from our bank + the English
translations on each line.

Reads:  audit/<level>_raw.txt
Writes: audit/<level>_fixed.txt
"""
import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


GERMAN_LETTERS = "abcdefghijklmnopqrstuvwxyzäöüß"


def load_dict():
    """Build a lowercase set of all known German words from the bank."""
    nouns = json.loads(Path("data/nouns.json").read_text(encoding="utf-8"))["nouns"]
    verbs = json.loads(Path("data/verbs.json").read_text(encoding="utf-8"))["verbs"]
    adjs = json.loads(Path("data/adjectives.json").read_text(encoding="utf-8"))["adjectives"]
    out = set()
    for n in nouns:
        if n.get("word"):
            out.add(n["word"].lower())
            # Also add inflected forms — plural
            if n.get("plural") and n["plural"] != "—":
                out.add(n["plural"].lower())
    for v in verbs:
        if v.get("word"):
            out.add(v["word"].lower())
            for f in ("prateritum", "perfekt"):
                if v.get(f):
                    out.add(v[f].lower())
    for a in adjs:
        if a.get("word"):
            out.add(a["word"].lower())
    return out


WORD_RE = re.compile(r"\b[A-Za-zäöüÄÖÜß][a-zäöüß]*\s+[a-zäöüß]+\b")


def try_fix_word(broken, dictionary):
    """`broken` is a string with at least one space inside, like 'Fl sche'.

    Try replacing each space with each possible German letter to find a
    match in the dictionary. Returns the fixed word or None.
    """
    candidates = []
    space_positions = [i for i, c in enumerate(broken) if c == " "]
    if not space_positions:
        return None
    if len(space_positions) > 2:
        return None  # too many gaps, ambiguous

    def fill(s, positions, depth=0):
        if depth >= len(positions):
            return [s]
        results = []
        pos = positions[depth]
        for letter in GERMAN_LETTERS:
            new_s = s[:pos] + letter + s[pos + 1:]
            results.extend(fill(new_s, positions, depth + 1))
            # Also try uppercase version of the letter at start
            if pos == 0:
                upper = letter.upper()
                new_s2 = s[:pos] + upper + s[pos + 1:]
                results.extend(fill(new_s2, positions, depth + 1))
        return results

    candidates = fill(broken, space_positions)
    for cand in candidates:
        if cand.lower() in dictionary:
            return cand
    return None


def try_fix_word_prepend(broken_lower, dictionary):
    """For words starting with lowercase that should start with a capital
    (e.g., "nglisch" -> "Englisch", "ngarisch" -> "Ungarisch"), try
    prepending each capital letter.
    """
    if not broken_lower:
        return None
    if not broken_lower[0].islower():
        return None
    for letter in GERMAN_LETTERS:
        cap = letter.upper()
        cand = cap + broken_lower
        if cand.lower() in dictionary:
            return cand
    return None


def try_fix_separable(broken, dictionary):
    """For verbs with vertical-bar prefix like 'zus|mmen|gehören' or
    'zu|ordnen', if the part before/after | has a missing letter, try to
    fix the whole compound.
    """
    if "|" not in broken:
        return None
    parts = broken.split("|")
    fixed_parts = []
    for part in parts:
        if " " in part:
            fixed = try_fix_word(part, dictionary)
            if not fixed:
                return None
            fixed_parts.append(fixed)
        else:
            fixed_parts.append(part)
    candidate = "".join(fixed_parts)
    if candidate.lower() in dictionary:
        return "|".join(fixed_parts)
    # Also try without the bar
    if "".join(fixed_parts).lower() in dictionary:
        return "|".join(fixed_parts)
    return None


def fix_token(token, dictionary):
    """Fix a single token (no internal whitespace expected aside from
    intentional gaps from font drops).

    `token` may contain digit/hyphen/etc. Don't touch those.
    """
    # Quick path: if entire token is in dict, return.
    if token.lower() in dictionary:
        return token
    # Otherwise leave intact.
    return token


def fix_line(line, dictionary):
    """Fix a single line of text.

    Find sequences of letters that are obviously a broken word (contain a
    single internal space gap or start with lowercase but should be Cap).
    """
    # First, try to fix multi-token broken words like "Fl sche" or "B tterbrot".
    # Pattern: a letter run + single-space + letter run, both alphabetic.
    def replace(m):
        candidate = m.group(0)
        # Must contain at least one letter on each side of space
        parts = candidate.split()
        if len(parts) < 2:
            return candidate
        # Try concatenating with each space replaced by each letter
        joined_with_gap = " ".join(parts)
        if joined_with_gap.lower() in dictionary:
            return candidate  # already valid
        fixed = try_fix_word(joined_with_gap, dictionary)
        if fixed:
            return fixed
        return candidate

    # Pattern matches a broken word: letter run (with potential umlauts),
    # space, letter run, but must be inside a single token "boundary".
    # Use a careful regex that captures a candidate broken word.
    line = re.sub(
        r"\b([A-Za-zäöüÄÖÜß][a-zäöüß]*)\s([a-zäöüß]+)\b",
        lambda m: try_fix_word(f"{m.group(1)} {m.group(2)}", dictionary) or m.group(0),
        line,
    )

    # Also handle separable verb forms like 'zus mmen|gehören' -> after first
    # round above, this becomes 'zusammen|gehören' if 'zusammen' is in dict.
    # If a token still has a space inside the compound part, try harder.
    # (We already did one pass; do another for nested cases.)
    line = re.sub(
        r"\b([A-Za-zäöüÄÖÜß][a-zäöüß]*)\s([a-zäöüß]+)\b",
        lambda m: try_fix_word(f"{m.group(1)} {m.group(2)}", dictionary) or m.group(0),
        line,
    )

    # Fix words that lost their leading capital letter (e.g. "nglisch" → "Englisch").
    # These appear as a lowercase token at position where a capitalised word
    # is expected. Heuristic: if the line starts with a lowercase token AND
    # a known word formed by capitalising + prepending a letter exists, swap.
    # Be conservative — only at start of line or after a separator.
    def fix_lead_lc(m):
        word = m.group(1)
        fixed = try_fix_word_prepend(word, dictionary)
        return fixed if fixed else word

    # Match a lowercase-leading token at start of line or after whitespace,
    # only if it's clearly a glossary entry (followed by spaces+lowercase = English).
    line = re.sub(
        r"^([a-zäöüß][a-zäöüß]{2,})(?=\s)",
        lambda m: fix_lead_lc(m),
        line,
    )

    return line


def main():
    if len(sys.argv) < 3:
        print("Usage: fixup_netzwerk_text.py <input.txt> <output.txt>")
        sys.exit(1)
    inp = Path(sys.argv[1])
    out = Path(sys.argv[2])

    dictionary = load_dict()
    print(f"Dictionary: {len(dictionary)} German words", flush=True)

    raw = inp.read_text(encoding="utf-8")
    fixed_lines = []
    n_lines = 0
    for line in raw.splitlines():
        fixed = fix_line(line, dictionary)
        fixed_lines.append(fixed)
        n_lines += 1
    out.write_text("\n".join(fixed_lines) + "\n", encoding="utf-8")

    # Stats
    raw_broken = sum(1 for l in raw.splitlines() if re.search(r"\b[A-Za-zäöüÄÖÜß][a-zäöüß]+\s[a-zäöüß]+\b", l))
    fixed_broken = sum(1 for l in fixed_lines if re.search(r"\b[A-Za-zäöüÄÖÜß][a-zäöüß]+\s[a-zäöüß]+\b", l))
    print(f"Lines: {n_lines}; lines containing potential gap-words: raw={raw_broken}, fixed={fixed_broken}")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
