"""Propose targeted fixes from DeepL output for known MT-garbage patterns.

Generates audit/deepl_diff/proposed_fixes.{json,md}. Does NOT modify data.

Strategy: only flag entries in DIVERGENT_SINGLE (current is single-sense, DeepL
disagrees) where the current gloss matches a high-confidence MT-failure pattern.
Skips dual-gender duplicates entirely.
"""
import json
import re
from collections import Counter
from pathlib import Path

DIFF = Path('audit/deepl_diff')
OUT_JSON = DIFF / 'proposed_fixes.json'
OUT_MD = DIFF / 'proposed_fixes.md'

# Patterns where the CURRENT gloss is almost certainly wrong.
# Each is (regex, reason). Matched case-insensitively against current english.
# Restricted to entries that are SINGLE-SENSE (no '/'); multi-sense entries
# are handled via reordering instead.
GARBAGE_PATTERNS = [
    # Unambiguous nonsense from previous MT failures
    (r'\bat the expense of\b', 'MT failure: -kosten compound'),
    (r'\bverb belly\b', 'MT failure: nonsense compound'),
    (r'\bcircle bod\b', 'MT failure: nonsense compound'),
    (r'\bcompartment earth\b', 'MT failure: nonsense compound'),
    (r'\bfinance bed\b', 'MT failure: nonsense compound'),
    (r'\bnavigation structure\b', 'MT failure: nonsense compound'),
    (r'\bfine action\b', 'MT failure: nonsense compound'),
    (r'\bbeer head\b', 'MT failure: Kron-/Krone- compound'),
    # Specific bad single-word glosses
    (r'\bcellarer\b|\bcellarman\b|\bcellarmaster\b', 'MT failure: Kellner = waiter'),
    (r'\blandspout\b', 'MT failure: Hose-related (meteorological mis-sense)'),
    (r'^pantaloon$', 'MT failure: pantaloon archaic'),
    (r'\botto engine\b', 'MT failure: should be petrol/gasoline engine'),
    (r'\bcancer foresight\b', 'MT failure: Krebsvorsorge = cancer screening'),
    (r'^depuration$', 'MT failure: depuration archaic'),
    (r'\bcircle class\b', 'MT failure: Kreis- compound'),
    (r'\bcredit file\b', 'MT failure: Kreditlinie = credit line'),
    (r'\bborrower group\b', 'MT failure: Benutzergruppe = user group'),
    (r'\bcare duration\b', 'MT failure: -dauer compound'),
    (r'\badaptation duration\b', 'MT failure: Bearbeitungsdauer = processing time'),
    (r'\bbusiness branch\b', 'MT failure: -zweig compound'),
    (r'\bbusiness high school\b', 'MT failure: Berufsoberschule'),
    (r'\bactivity prohibition\b', 'MT failure: Beschäftigungsverbot = employment ban'),
    (r'\bsnack shack\b', 'MT failure: Imbissbude = snack bar'),
    (r'\bidea discussion\b', 'MT failure: Ideenaustausch = exchange of ideas'),
    (r'\bidyllic life\b', 'MT failure: Idyll = idyll'),
    (r'^baloney\b', 'MT failure: baloney as primary'),
    # Compound-only patterns: these tokens are wrong only in known compound contexts
    (r'\bpreservation\b', '-haltung MT failure (only in compound contexts)', 'COMPOUND'),
]

# German words where 'preservation' is a known wrong gloss (compound context).
COMPOUND_CONTEXT_HINTS = {
    'preservation': lambda w: w not in {'Erhaltung', 'Klassenerhalt'} and (
        w.endswith('haltung') or 'erhalt' in w.lower() or w.endswith('halt')
    ),
}

# Suspicious DeepL artifacts that should DISQUALIFY a proposed replacement.
DEEPL_BAD_PATTERNS = [
    (r'^the\s+', 'DeepL added definite article'),
    (r'\s+for$|\s+in$|\s+of$|\s+to$|\s+at$|\s+on$|\s+by$', 'DeepL added trailing preposition'),
    (r'\(.*\)$', 'DeepL added parenthetical'),
]


def is_dual_gender_word(rows, word):
    """Find dual-gender duplicate words (appear in 2 rows for nouns)."""
    return sum(1 for r in rows if r['word'] == word) > 1


def deepl_looks_clean(deepl):
    if not deepl:
        return False
    for pat, _ in DEEPL_BAD_PATTERNS:
        if re.search(pat, deepl, re.IGNORECASE):
            return False
    # Empty / single trivial token
    return len(deepl.strip()) > 0


def find_garbage_match(current, german_word):
    cur = (current or '').lower()
    # Skip multi-sense entries — handled via reordering, not replacement
    if '/' in current:
        return None
    for entry in GARBAGE_PATTERNS:
        pat, reason = entry[0], entry[1]
        flags = entry[2] if len(entry) > 2 else None
        if not re.search(pat, cur, re.IGNORECASE):
            continue
        if flags == 'COMPOUND':
            # Look up which token matched and apply context guard
            for tok, predicate in COMPOUND_CONTEXT_HINTS.items():
                if tok in cur and not predicate(german_word):
                    break
            else:
                return reason
            continue
        return reason
    return None


def main():
    proposals = {'nouns': [], 'verbs': [], 'adjectives': []}
    skipped_dual = 0
    skipped_deepl_bad = 0

    for kind in ['nouns', 'verbs', 'adjectives']:
        rows = json.loads((DIFF / f'{kind}_classified.json').read_text(encoding='utf-8'))
        # Build dual-gender set
        word_count = Counter(r['word'] for r in rows)
        dual = {w for w, n in word_count.items() if n > 1}

        for r in rows:
            if r['word'] in dual:
                if r['category'] == 'DUAL_GENDER':
                    skipped_dual += 1
                continue
            if r['category'] != 'DIVERGENT_SINGLE':
                continue

            reason = find_garbage_match(r['current'], r['word'])
            if not reason:
                continue
            if not deepl_looks_clean(r['deepl']):
                skipped_deepl_bad += 1
                continue

            proposals[kind].append({
                'word': r['word'],
                'rank': r['rank'],
                'article': r.get('article'),
                'current': r['current'],
                'deepl': r['deepl'],
                'category': r['category'],
                'reason': reason,
            })

    OUT_JSON.write_text(json.dumps(proposals, ensure_ascii=False, indent=2), encoding='utf-8')

    # Markdown
    lines = ['# Proposed DeepL fixes\n']
    lines.append(f'_Skipped {skipped_dual} dual-gender entries; skipped {skipped_deepl_bad} where DeepL output looked unclean._\n')
    total = sum(len(v) for v in proposals.values())
    lines.append(f'**Total proposals: {total}**\n')
    for kind in ['nouns', 'verbs', 'adjectives']:
        items = sorted(proposals[kind], key=lambda r: r.get('rank') or 0)
        lines.append(f'\n## {kind} ({len(items)})\n')
        if not items:
            lines.append('_(none)_\n')
            continue
        if kind == 'nouns':
            lines.append('| rank | art | word | current | → DeepL | reason |')
            lines.append('|---:|:---:|---|---|---|---|')
            for r in items:
                lines.append(f'| {r["rank"]} | {r["article"] or ""} | {r["word"]} | {r["current"]} | **{r["deepl"]}** | {r["reason"]} |')
        else:
            lines.append('| rank | word | current | → DeepL | reason |')
            lines.append('|---:|---|---|---|---|')
            for r in items:
                lines.append(f'| {r["rank"]} | {r["word"]} | {r["current"]} | **{r["deepl"]}** | {r["reason"]} |')
    OUT_MD.write_text('\n'.join(lines), encoding='utf-8')

    print(f'Skipped {skipped_dual} dual-gender entries')
    print(f'Skipped {skipped_deepl_bad} with unclean DeepL output')
    for kind, items in proposals.items():
        print(f'{kind}: {len(items)} proposed fixes')
    print(f'\nReports: {OUT_JSON}, {OUT_MD}')


if __name__ == '__main__':
    main()
