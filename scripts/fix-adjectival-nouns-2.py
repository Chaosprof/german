#!/usr/bin/env python3
"""
Pass 2: handle das + -es adjectival nouns that have no plural (so the previous
script's plural-equality check missed them). Examples: das Süßes → das Süße.
"""
import json, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
NOUNS_PATH = ROOT / 'data' / 'nouns.json'

# Verified manually: these are substantivized adjectives where the strong-decl
# form was incorrectly stored as the headword combined with article "das".
TO_FIX = {
    'Unbekanntes':     'the unknown',
    'Böses':           'evil',
    'Süßes':           'something sweet / sweets',
    'Schönes':         'something beautiful',
    'Bares':           'cash',
    'Äußeres':         'appearance / exterior',
    'Erspartes':       'savings',
    'Sonstiges':       'other / miscellaneous',
    'Kleingedrucktes': 'fine print / small print',
    'Landesinneres':   'interior of the country',
    'Körperinneres':   'body interior',
    'Wunderbares':     'something marvellous',
    'Menschliches':    'human aspect / something human',
}

def main():
    nd = json.loads(NOUNS_PATH.read_text(encoding='utf-8'))
    nouns = nd['nouns']
    by = {n['word']: n for n in nouns}
    fixed = 0
    for old, en in TO_FIX.items():
        n = by.get(old)
        if not n:
            continue
        new = old[:-1]  # drop the -s
        if n['article'] != 'das':
            continue
        n['word'] = new
        n['english'] = en
        n['adjectivalNoun'] = True
        n['articleHelp'] = (
            'Adjectival noun (substantivized adjective). With definite article '
            f'(weak decl): das {new}, des {new}n. Without article (strong decl): '
            f'(etwas) {old} — common in fixed phrases like "etwas {old}".'
        )
        n['pluralHelp'] = ('Substantivized adjectives of this type are typically '
                           'singular only.')
        fixed += 1
        print(f"  {old} → {new}")
    NOUNS_PATH.write_text(json.dumps(nd, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"\nFixed {fixed} entries")

if __name__ == '__main__':
    main()
