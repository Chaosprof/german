#!/usr/bin/env python3
"""
Apply targeted fixes from the dataset review.
See conversation log for rationale on each fix.
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'

def load(p):
    return json.loads(Path(p).read_text(encoding='utf-8'))

def save(p, d):
    Path(p).write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


# ----------------------- NOUNS -----------------------
print('Fixing nouns.json…')
nd = load(DATA / 'nouns.json')
nouns = nd['nouns']
by_word = {n['word']: n for n in nouns}
changes = []

# 1) der Jugendlicher → der Jugendliche (adjectival noun, weak with article)
n = by_word.get('Jugendlicher')
if n:
    n['word'] = 'Jugendliche'
    n['plural'] = 'Jugendlichen'
    n['articleHelp'] = ('Adjectival noun (substantivized adjective). With definite article '
                        'it takes weak endings: der Jugendliche, die Jugendliche, des Jugendlichen, '
                        'dem Jugendlichen, den Jugendlichen. Without article (strong): ein Jugendlicher.')
    n['pluralHelp'] = ('die Jugendlichen (with article — weak adj. ending). Without article: '
                       '"Jugendliche" (strong adj. ending). Adjectival nouns are declined like '
                       'their corresponding adjectives.')
    changes.append('rank 54: Jugendlicher → Jugendliche (adjectival noun fix)')

# 2) das Alter pl=Alte → pl=— (no normal plural)
n = by_word.get('Alter')
if n and n['article'] == 'das':
    if n.get('plural') in ('Alte',):
        n['plural'] = '—'
        n['pluralHelp'] = ('das Alter (age) is normally singular only. The form "die Alter" exists '
                           'in fixed phrases ("in allen Altern") but is rare. "Alte" is unrelated '
                           '(plural of "der/die Alte" = old man/woman).')
        changes.append('rank 201: Alter pl=Alte → —')

# 3) das Fällen rank 245: lemma double-l + wrong gloss → das Fallen (substantivized "fallen")
n = by_word.get('Fällen')
if n:
    # If kept as Fällen (felling, from transitive fällen), gloss "falling/dropping" is wrong.
    # Most consistent fix: rename to Fallen (one l) with the existing gloss, since
    # the corpus likely picked up "Fällen" from forms of "Fall" plurals (lemmatization noise).
    n['word'] = 'Fallen'
    n['english'] = 'falling'
    n['plural'] = '—'
    n['articleHelp'] = ('Nominalized infinitive of "fallen" (to fall) → always das. '
                        'Note: "das Fällen" (with umlaut) would mean "the felling/rendering" '
                        '(from transitive "fällen"). Distinct lemma.')
    n['pluralHelp'] = 'Substantivized infinitives are normally singular only.'
    changes.append('rank 245: Fällen → Fallen (lemma + gloss correction)')

# 4) die Steuer pl=Steuer → Steuern
n = by_word.get('Steuer')
if n and n['article'] == 'die':
    if n.get('plural') == 'Steuer':
        n['plural'] = 'Steuern'
        n['pluralHelp'] = '-(e)n (die Steuern). Standard feminine plural — die Steuern (taxes).'
        changes.append('rank 750: Steuer pl=Steuer → Steuern')

# 5) die Post pl=Posten → —  (Post is uncountable; Posten is unrelated)
n = by_word.get('Post')
if n and n['article'] == 'die':
    if n.get('plural') in ('Posten',):
        n['plural'] = '—'
        n['pluralHelp'] = ('die Post (mail/post office) is normally singular only. '
                           'Note: "der Posten" is a different noun (post/position/item) and '
                           'should not be used as a plural of "die Post".')
        changes.append('rank 756: Post pl=Posten → —')

# 6) der Mond — strip duplicated "Moon"
n = by_word.get('Mond')
if n and 'Moon/' in n['english'] and '/moon' in n['english']:
    n['english'] = 'moon/crescent'
    changes.append('rank 2174: Mond gloss deduped → moon/crescent')

# 7) der Arm — strip "ass"
n = by_word.get('Arm')
if n and 'ass' in n['english']:
    n['english'] = 'arm'
    changes.append('rank 2086: Arm gloss → arm')

# 8) die Billion — false friend
n = by_word.get('Billion')
if n:
    n['english'] = 'trillion (10^12; NOT English billion — that is "Milliarde")'
    changes.append('rank 5175: Billion gloss → trillion (false-friend warning)')

# 9) der Beamer — fix typo
n = by_word.get('Beamer')
if n and 'projecto' in n['english'] and 'projector' not in n['english'].replace('projecto', '!'):
    # the existing string contains "digital projecto" without trailing r
    n['english'] = n['english'].replace('digital projecto', 'digital projector')
    changes.append('rank 3898: Beamer typo → digital projector')

# 10) Months — set plural to — uniformly
months = ['Januar','Februar','März','April','Mai','Juni','Juli','August',
          'September','Oktober','November','Dezember']
for m in months:
    n = by_word.get(m)
    if n and n.get('plural') and n['plural'] != '—':
        n['plural'] = '—'
        n['pluralHelp'] = ('Months are normally singular only in modern German. '
                           'Formal plurals exist in some dictionaries (Januare, Februare, …) '
                           'but are essentially unused.')
        changes.append(f'month {m}: plural → —')

# 11) -kosten compounds (plural-only): article das → die
kosten_fixed = 0
for n in nouns:
    if n['word'].endswith('kosten') and n['article'] != 'die':
        n['article'] = 'die'
        # plural is the same as the (only) form, which is plural
        n['plural'] = n['word']
        n['articleHelp'] = ('Plural-only compound noun ending in -kosten ("costs"). '
                            'Always plural: die ___kosten. The singular "die ___koste" does not exist; '
                            'this noun behaves like "die Kosten".')
        n['pluralHelp'] = ('Plurale tantum (plural only). Same form for all cases except '
                           'dative plural (___kosten + en is irregular here; see "Kosten").')
        kosten_fixed += 1
if kosten_fixed:
    changes.append(f'-kosten compounds: {kosten_fixed} entries article→die')

# 12) Add missing high-frequency plural-only nouns at end (rank > current max)
max_rank = max(n['rank'] for n in nouns)
plural_only_adds = [
    ('Eltern',     'parents',        'Plurale tantum: parents.'),
    ('Leute',      'people / folks', 'Plurale tantum: people (informal).'),
    ('Kosten',     'costs / expenses','Plurale tantum: costs (financial).'),
    ('Daten',      'data',           'Plurale tantum in modern usage; "das Datum" (date) is a different lemma.'),
    ('Ferien',     'holidays / vacation','Plurale tantum: school/work holidays.'),
    ('Ressourcen', 'resources',      'Plural; singular die Ressource exists but the plural is the common form.'),
    ('Medien',     'media',          'Plural of das Medium; commonly used as plurale tantum for "the media".'),
    ('Unterlagen', 'documents / records','Plurale tantum: paperwork, records, supporting documents.'),
    ('Hausaufgaben','homework',      'Plurale tantum in everyday use; singular die Hausaufgabe exists.'),
]
added = 0
for word, en, note in plural_only_adds:
    if word not in by_word:
        max_rank += 1
        nouns.append({
            'word': word,
            'article': 'die',
            'plural': word,
            'english': en,
            'rank': max_rank,
            'leipzigRank': None,
            'manuallyAdded': True,
            'pluraleTantum': True,
            'articleHelp': 'Plural-only noun (Plurale tantum). Always die.',
            'pluralHelp': note,
        })
        by_word[word] = nouns[-1]
        added += 1
if added:
    changes.append(f'added {added} missing plural-only nouns')

# Update meta count
nd['meta']['count'] = len(nouns)
save(DATA / 'nouns.json', nd)


# ----------------------- DUAL-GENDER -----------------------
print('Fixing dual-gender-nouns.json…')
dg = load(DATA / 'dual-gender-nouns.json')
dn = dg['nouns']

# Heide: drop "atheist" sense from der entry
for n in dn:
    if n['word'] == 'Heide':
        for g in n['genders']:
            if g['article'] == 'der' and 'atheist' in g['english'].lower():
                g['english'] = 'heathen/pagan'
                changes.append('dual-gender Heide: removed "atheist" gloss')

# Boot: remove the "der Boot = footwear" entry (marginal anglicism, not standard)
new_dn = []
for n in dn:
    if n['word'] == 'Boot':
        # filter out the footwear sense
        kept = [g for g in n['genders'] if not (g['article'] == 'der' and 'boot' in g['english'].lower() and 'footwear' in g['english'].lower())]
        if len(kept) <= 1:
            # no longer dual-gender — drop the whole entry from this file
            changes.append('dual-gender Boot: removed (footwear sense was non-standard)')
            continue
        n['genders'] = kept
    new_dn.append(n)
dg['nouns'] = new_dn
dg['meta']['count'] = len(new_dn)
save(DATA / 'dual-gender-nouns.json', dg)


# ----------------------- VERBS -----------------------
print('Fixing verbs.json…')
vd = load(DATA / 'verbs.json')
verbs = vd['verbs']
by_v = {v['word']: v for v in verbs}

# withSein → True for these motion/state-change verbs
for w in ['davonschwimmen','dabeibleiben','auseinanderlaufen','zuteilwerden','absterben','zerspringen']:
    v = by_v.get(w)
    if v and v.get('withSein') is False:
        v['withSein'] = True
        changes.append(f'verb {w}: withSein false→true')

# freuen: lead with reflexive sense in gloss
v = by_v.get('freuen')
if v:
    if 'sich freuen' not in v['english'] and 'reflex' not in v['english'].lower():
        v['english'] = '(reflexive: sich freuen) be glad / be happy'
        changes.append('verb freuen: gloss leads with reflexive sense')

save(DATA / 'verbs.json', vd)


# ----------------------- VERBS-WITH-PREPOSITIONS -----------------------
print('Fixing verbs-with-prepositions.json…')
vp = load(DATA / 'verbs-with-prepositions.json')
arr = vp['verbs']
new_arr = []
removed = []
for v in arr:
    # remove hinterfragen + nach (verb is transitive, no nach)
    if v['verb'] == 'hinterfragen' and v['preposition'] == 'nach':
        removed.append('hinterfragen + nach (verb is transitive, no preposition)')
        continue
    # remove sich widersetzen + gegen (verb takes Dat without preposition)
    if v['verb'] == 'sich widersetzen' and v['preposition'] == 'gegen':
        removed.append('sich widersetzen + gegen (verb takes Dat without preposition)')
        continue
    # fix anrechnen + als example (was a "hoch anrechnen" example)
    if v['verb'] == 'anrechnen' and v['preposition'] == 'als':
        v['example'] = 'Das wird dir als Berufserfahrung angerechnet.'
        changes.append('anrechnen + als: example replaced (now actually uses als)')
    new_arr.append(v)

# add helfen + bei (Dat)
have_helfen_bei = any(v['verb'] == 'helfen' and v['preposition'] == 'bei' for v in new_arr)
if not have_helfen_bei:
    next_rank = max(v['rank'] for v in new_arr) + 1
    new_arr.append({
        'verb': 'helfen',
        'preposition': 'bei',
        'case': 'Dat',
        'english': 'help with',
        'example': 'Ich helfe dir bei den Hausaufgaben.',
        'rank': next_rank,
        'manuallyAdded': True,
    })
    changes.append('verbs-with-prep: added helfen + bei (Dat)')

for r in removed:
    changes.append(f'verbs-with-prep removed: {r}')

vp['verbs'] = new_arr
vp['meta']['count'] = len(new_arr)
save(DATA / 'verbs-with-prepositions.json', vp)


# ----------------------- ADJECTIVES -----------------------
print('Fixing adjectives.json…')
ad = load(DATA / 'adjectives.json')
adj = ad['adjectives']
by_a = {a['word']: a for a in adj}

fixes_adj = {
    'brav': 'well-behaved/good/obedient',
    'höflich': 'polite/courteous',
    'kostenpflichtig': 'fee-based/subject to a charge',
    'sympathisch': 'likeable/nice',
}
for w, en in fixes_adj.items():
    a = by_a.get(w)
    if a and a['english'] != en:
        old = a['english']
        a['english'] = en
        changes.append(f'adj {w}: "{old}" → "{en}"')

save(DATA / 'adjectives.json', ad)


# ----------------------- SUMMARY -----------------------
print('\n--- changes applied ---')
for c in changes:
    print(' •', c)
print(f'\nTotal changes: {len(changes)}')
