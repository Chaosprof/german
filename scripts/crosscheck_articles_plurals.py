import json, os, glob

app = {n['word']: n for n in json.load(open('data/nouns.json', encoding='utf-8'))['nouns']}
src_list = json.load(open('sources/German-Words/data/all.json', encoding='utf-8'))
# upstream may have multiple genders per lemma; collect all
from collections import defaultdict
src_gender = defaultdict(set)
src_plural = defaultdict(set)
for e in src_list:
    if e.get('type') != 'noun':
        continue
    lem = e.get('lemma')
    g = e.get('gender')
    if g:
        src_gender[lem].add(g)
    pl = (e.get('cases') or {}).get('nominative', {}).get('plural')
    if pl:
        src_plural[lem].add(pl)

deckwords = set()
for mf in glob.glob('data/*/manifest.json'):
    base = os.path.dirname(mf)
    for ref in json.load(open(mf, encoding='utf-8'))['decks']:
        p = os.path.join(base, ref['file'])
        if os.path.exists(p):
            for w in json.load(open(p, encoding='utf-8')).get('nouns') or []:
                deckwords.add(w)

G2ART = {'m': 'der', 'f': 'die', 'n': 'das'}

art_disagree = []
plural_disagree = []
not_in_src = 0
for w in sorted(deckwords):
    n = app.get(w)
    if not n:
        continue
    if w not in src_gender:
        not_in_src += 1
        continue
    src_arts = {G2ART[g] for g in src_gender[w] if g in G2ART}
    if src_arts and n.get('article') not in src_arts:
        art_disagree.append((w, n.get('article'), '/'.join(sorted(src_arts))))
    # plural compare (only if app asserts a plural and src has one)
    appl = (n.get('plural') or '').strip()
    if appl and src_plural.get(w):
        if appl not in src_plural[w]:
            plural_disagree.append((w, appl, '/'.join(sorted(src_plural[w]))))

print(f'deck nouns: {len(deckwords)}, not found in upstream: {not_in_src}')
print(f'\nARTICLE disagreements vs upstream: {len(art_disagree)}')
for w, a, s in art_disagree:
    print(f'  {w}: app={a}  upstream={s}')

# classify plural disagreements
buckets = {'malformed_truncated': [], 'doubled_stem': [], 'singular_left': [],
           'app_dash': [], 'other': []}
for w, appl, srcs in plural_disagree:
    src_forms = srcs.split('/')
    if appl == '—':
        buckets['app_dash'].append((w, appl, srcs))
    elif appl == w:
        buckets['singular_left'].append((w, appl, srcs))
    elif appl.startswith(w) and len(appl) > len(w) + 2 and \
            appl[len(w):] not in ('e', 'er', 'en', 'n', 's', 'nen', 'se', 'es', 'innen'):
        buckets['doubled_stem'].append((w, appl, srcs))
    elif any(s.startswith(appl) and len(s) > len(appl) for s in src_forms):
        buckets['malformed_truncated'].append((w, appl, srcs))
    else:
        buckets['other'].append((w, appl, srcs))

print(f'\nPLURAL disagreements vs upstream: {len(plural_disagree)}  (classified)')
for b in ('doubled_stem', 'malformed_truncated', 'singular_left', 'app_dash', 'other'):
    print(f'\n--- {b}: {len(buckets[b])} ---')
    for w, a, s in buckets[b]:
        print(f'  {w}: app={a!r}  upstream={s!r}')
