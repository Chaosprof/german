"""Apply proposed DeepL fixes to data/nouns.json (replacements + reorderings).

Reads:  audit/deepl_diff/proposed_fixes.json (replacements)
        audit/deepl_diff/proposed_reorderings.json (reorderings)
Writes: data/nouns.json (in place)

For each entry, only the `english` field is changed; rank, article, plural,
articleHelp, pluralHelp etc. are preserved.
"""
import json
from pathlib import Path


def main():
    fixes = json.loads(Path('audit/deepl_diff/proposed_fixes.json').read_text(encoding='utf-8'))
    reorders = json.loads(Path('audit/deepl_diff/proposed_reorderings.json').read_text(encoding='utf-8'))

    # Build lookup: word + rank -> new english
    # (rank disambiguates dual-gender words, though we excluded those)
    new_gloss = {}
    for r in fixes['nouns']:
        new_gloss[(r['word'], r['rank'])] = r['deepl']
    for r in reorders:
        new_gloss[(r['word'], r['rank'])] = r['proposed']

    print(f'Will update {len(new_gloss)} noun entries')

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
        print(f'  r={r:>5}  {w:<25}  {o!r:<45} -> {nw!r}')


if __name__ == '__main__':
    main()
