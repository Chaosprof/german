"""Apply round-2 fixes to data/nouns.json.

Reads:  audit/deepl_diff/proposed_fixes_round2_tight.json
Writes: data/nouns.json (in place)

Manual overrides for entries where DeepL didn't translate (just echoed the German):
  - Schlich  → 'trick/ruse'  (DeepL gave 'schlich')
  - Vorwerk  → skip (no clean DeepL fix; German brand & noun)
"""
import json
from pathlib import Path

OVERRIDES = {
    'Schlich': 'trick/ruse',
}
SKIPS = {'Vorwerk'}


def main():
    proposals = json.loads(Path('audit/deepl_diff/proposed_fixes_round2_tight.json').read_text(encoding='utf-8'))

    new_gloss = {}
    for p in proposals:
        if p['word'] in SKIPS:
            continue
        if p['word'] in OVERRIDES:
            new_gloss[(p['word'], p['rank'])] = OVERRIDES[p['word']]
        else:
            new_gloss[(p['word'], p['rank'])] = p['deepl']

    print(f'Will update {len(new_gloss)} noun entries (skipped {len(SKIPS)})')

    src = Path('data/nouns.json')
    data = json.loads(src.read_text(encoding='utf-8'))

    applied = []
    for n in data['nouns']:
        key = (n['word'], n['rank'])
        if key in new_gloss:
            old = n.get('english', '')
            new = new_gloss[key]
            if old != new:
                n['english'] = new
                applied.append((n['rank'], n['word'], old, new))

    src.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f'Applied {len(applied)} changes')
    for r, w, o, nw in applied:
        print(f'  r={r:>5}  {w:<25}  {o!r:<15} -> {nw!r}')


if __name__ == '__main__':
    main()
