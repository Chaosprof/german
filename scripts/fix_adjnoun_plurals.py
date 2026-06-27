#!/usr/bin/env python3
"""For adjectival nouns (substantivized adjectives), switch the plural field
from the strong-ending form (e.g. "Vorsitzende") to the dictionary-standard
weak-ending form (e.g. "Vorsitzenden", as in "die Vorsitzenden").

Both forms are grammatically correct German — strong without article, weak
with definite article — but dictionaries cite the weak form, and the
pluralHelp text on these entries already presents "die Xen" as the
canonical form.
"""
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')


def main():
    path = 'data/nouns.json'
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    fixed = []
    skipped_neuter_abstract = []
    already_weak = []

    for n in data['nouns']:
        ah = (n.get('articleHelp') or '').lower()
        ph = (n.get('pluralHelp') or '').lower()
        is_adj_noun = ('adjectival noun' in ah or 'substantivized adjective' in ah
                       or 'adjectival noun' in ph or 'substantivized adjective' in ph)
        if not is_adj_noun:
            continue

        pl = n.get('plural') or ''
        if pl in ('—', ''):
            skipped_neuter_abstract.append(n['word'])
            continue
        if pl.endswith('n'):
            already_weak.append(n['word'])
            continue
        if pl.endswith('e'):
            new_pl = pl + 'n'
            old_pl = n['plural']
            n['plural'] = new_pl
            fixed.append((n['word'], n['article'], old_pl, new_pl))
        else:
            print(f'  ?? unexpected plural form: {n["word"]} -> {pl!r}')

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'Fixed: {len(fixed)}')
    for w, art, old, new in fixed[:20]:
        print(f'  {art} {w}: {old!r} -> {new!r}')
    if len(fixed) > 20:
        print(f'  ... and {len(fixed) - 20} more')
    print(f'\nAlready weak (skipped): {len(already_weak)}')
    print(f'Neuter abstract (no plural — skipped): {len(skipped_neuter_abstract)}')


if __name__ == '__main__':
    main()
