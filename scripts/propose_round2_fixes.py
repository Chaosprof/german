"""Tight-confidence round-2 fixes: only obvious garbage in noun glosses.

Two classes:
A) Suffix-fragment garbage: current is a 3-4 char fragment that is a SUFFIX of the
   German word. The MT got truncated. Examples: Konsultation 'ion', Reformator 'cage'.
B) Plainly-wrong short word: current is a short noun unrelated to the German word
   AND unrelated to DeepL's translation. Curated list of confident bad pairings.
"""
import json
import re
from collections import Counter
from pathlib import Path

# Class A: bad fragments. Auto-apply when German word matches the suffix pattern.
SUFFIX_GARBAGE = {
    'ion':   r'(ation|ition|tion|sion|gion|tion)$',  # -tion family
    'dung':  r'.ung$',  # -ung nouns (the dung is MT artifact)
    'cage':  r'(ator|or)$',  # -ator nouns
    'bed':   r'(lage|age)$',  # -lage nouns (bed is artifact)
}
# Special: skip these specific German words because they're real cognates
SUFFIX_EXCEPT = {
    'Ion',   # actually means "ion"
    'Bett',  # actually means "bed"
}

# Class B: hand-curated obvious word-level garbage. Each: (german_word, current_gloss)
WORD_GARBAGE = {
    ('Bundesanzeiger', 'hand'),
    ('Gymnasiast', 'back'),
    ('Verunsicherung', 'fuse'),
    ('Reinigen', 'gene'),
    ('Heimwerker', 'bay'),
    ('Verlass', 'ace'),
    ('Rechtsbehelf', 'elf'),
    ('Sammelband', 'band'),
    ('Themenseite', 'angle'),
    ('Volltext', 'lyric'),
    ('Nährboden', 'Loft'),
    ('Bewegtbild', 'idea'),
    ('Städtetag', 'day'),
    ('Entscheid', 'oath'),
    ('Selbstbehalt', 'hold'),
    ('Abwärtstrend', 'tide'),
    ('Dämmstoff', 'cloth'),
    ('Beisammensein', 'being'),
    ('Vorhandensein', 'being'),
    ('Sozialwesen', 'being'),
    ('Zweitstimme', 'voice'),
    ('Multitalent', 'flair'),
    ('Doppelpack', 'brace'),
    ('Lieferdienst', 'duty'),
    ('Alptraum', 'dream'),
    ('Impulsgeber', 'boar'),
    ('Namensgeber', 'boar'),
    ('Beanstandung', 'dung'),  # double-coverage
    ('Wohnlage', 'bed'),
    ('Eiablage', 'bed'),
    ('Steillage', 'bed'),
    ('Schräglage', 'bed'),
    ('Grassilage', 'bed'),
    ('Kolpingwerk', 'act'),
    ('Vorwerk', 'act'),
    ('Bauart', 'style'),
    ('Bestnote', 'grade'),
    ('Vizepräsidentin', 'chair'),
    ('Höhenunterschied', 'drop'),
    ('Gesamtjahr', 'age'),
    ('Schlich', 'I'),
    ('Galopprennbahn', 'e'),
    ('Schult�te', 'Schult�te/school cone'),  # already shows as garbage in audit
}


def normalize_deepl(s):
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
    nouns = json.loads(Path('data/nouns.json').read_text(encoding='utf-8'))['nouns']
    deepl = json.loads(Path('audit/deepl/nouns.json').read_text(encoding='utf-8'))

    word_count = Counter(n['word'] for n in nouns)
    dual = {w for w, n in word_count.items() if n > 1}

    fixes = []
    for n in nouns:
        if n['word'] in dual:
            continue
        cur = (n.get('english') or '').strip()
        d_raw = deepl.get(n['word'], '')
        d = normalize_deepl(d_raw)
        if not d:
            continue

        # Class A — suffix garbage
        if cur in SUFFIX_GARBAGE and n['word'] not in SUFFIX_EXCEPT:
            pat = SUFFIX_GARBAGE[cur]
            if re.search(pat, n['word'].lower()):
                if d.lower() != cur.lower():
                    fixes.append((n['rank'], n.get('article'), n['word'], cur, d, 'SUFFIX_GARBAGE'))
                    continue

        # Class B — curated word-level garbage
        if (n['word'], cur) in WORD_GARBAGE:
            fixes.append((n['rank'], n.get('article'), n['word'], cur, d, 'WORD_GARBAGE'))

    fixes.sort(key=lambda r: r[0])
    print(f'Total: {len(fixes)} round-2 fixes to apply\n')
    by_class = Counter(f[5] for f in fixes)
    for k, v in by_class.items():
        print(f'  {k}: {v}')
    print()
    for r, art, w, cur, d, cls in fixes:
        print(f'  r={r:>5}  {art or "":>3} {w:<25}  cur={cur!r:<10}  -> {d!r:<35}  ({cls})')

    Path('audit/deepl_diff/proposed_fixes_round2_tight.json').write_text(
        json.dumps([{'rank': r, 'article': a, 'word': w, 'current': c, 'deepl': d, 'class': cls}
                    for r, a, w, c, d, cls in fixes], ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


if __name__ == '__main__':
    main()
