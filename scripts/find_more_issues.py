"""Find more high-confidence MT garbage in nouns:

Heuristic: noun has a single-sense English gloss that is:
  - 1 word, ≤ 5 chars
  - NOT a substring of DeepL's translation (so "use" vs "Utilisation" → skip;
    "ion" vs "Consultation" → flag)
  - DeepL gives a substantive multi-word (≥2 words) or significantly longer answer

This catches the suffix-fragment class (-ion, -dung, -cage) and other random-bad
short glosses (Bundesanzeiger 'hand', Gymnasiast 'back', etc.) without false-flagging
correct cognates like Veranstaltung 'event'.
"""
import json
import re
from pathlib import Path

DATA = Path('data/nouns.json')
DEEPL = Path('audit/deepl/nouns.json')
OUT_MD = Path('audit/deepl_diff/proposed_fixes_round2.md')
OUT_JSON = Path('audit/deepl_diff/proposed_fixes_round2.json')


def normalize_deepl(s):
    """Lowercase title-case proper nouns -> common-noun style."""
    s = s.strip()
    if not s:
        return s
    PROPER = {'St.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Saint'}
    out = []
    for w in s.split():
        if w in PROPER or (w.isupper() and len(w) >= 2):
            out.append(w)
        elif w[0].isupper():
            out.append(w[0].lower() + w[1:])
        else:
            out.append(w)
    return ' '.join(out)


def main():
    nouns = json.loads(DATA.read_text(encoding='utf-8'))['nouns']
    deepl = json.loads(DEEPL.read_text(encoding='utf-8'))

    # Build dual-gender set
    from collections import Counter
    word_count = Counter(n['word'] for n in nouns)
    dual = {w for w, n in word_count.items() if n > 1}

    proposals = []
    for n in nouns:
        if n['word'] in dual:
            continue
        cur = (n.get('english') or '').strip()
        if not cur:
            continue
        if '/' in cur or '(' in cur or ' ' in cur:
            continue
        if len(cur) > 5:
            continue

        d_raw = deepl.get(n['word'], '')
        if not d_raw:
            continue
        d = normalize_deepl(d_raw)

        # Skip if current is a substring/prefix of DeepL (cognate variations)
        if cur.lower() in d.lower():
            continue
        # Skip if DeepL leads with "the X" — it's likely a near-cognate noun
        d_stripped = re.sub(r'^the\s+', '', d, flags=re.IGNORECASE)
        if cur.lower() in d_stripped.lower():
            continue
        # Skip if DeepL is just the German word (proper noun / unknown)
        if d.lower() == n['word'].lower():
            continue
        # Skip if DeepL gloss equals current after stripping common variations
        if d_stripped.lower().strip() == cur.lower():
            continue

        # Now: DeepL is substantively different. If DeepL is also short single-word,
        # less confidence — it's a synonym disagreement. Skip those.
        d_words = d_stripped.split()
        if len(d_words) == 1 and len(d_stripped) <= 7:
            continue
        # Skip if DeepL output looks broken
        if d_stripped.endswith((' for', ' to', ' of', ' in', ' at', ' on', ' by')):
            continue
        if d_stripped.startswith('('):
            continue

        proposals.append({
            'rank': n['rank'],
            'article': n.get('article'),
            'word': n['word'],
            'current': cur,
            'deepl': d_stripped,
        })

    proposals.sort(key=lambda p: p['rank'])
    OUT_JSON.write_text(json.dumps(proposals, ensure_ascii=False, indent=2), encoding='utf-8')

    lines = [f'# Round 2 proposals: short-gloss garbage\n', f'**{len(proposals)} entries**\n']
    lines.append('| rank | art | word | current | → DeepL |')
    lines.append('|---:|:---:|---|---|---|')
    for p in proposals:
        lines.append(f'| {p["rank"]} | {p["article"] or ""} | {p["word"]} | {p["current"]} | **{p["deepl"]}** |')
    OUT_MD.write_text('\n'.join(lines), encoding='utf-8')

    print(f'{len(proposals)} round-2 proposals')
    for p in proposals[:80]:
        print(f'  r={p["rank"]:>5}  {p["article"] or "":>3} {p["word"]:<25}  cur={p["current"]!r:<10}  -> {p["deepl"]!r}')
    if len(proposals) > 80:
        print(f'  ... ({len(proposals) - 80} more)')


if __name__ == '__main__':
    main()
