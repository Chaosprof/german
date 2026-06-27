#!/usr/bin/env python3
"""Fix nonsense English glosses in data/nouns.json caused by Wiktionary/Kaikki
auto-extraction picking obscure/slang senses for the head morpheme.

Patterns fixed:
- Theater compounds picked up "ruckus" (slang from "Theater machen")
- Haus compounds picked up "bod" (slang for body)
- Speicher compounds picked up "attic" (older sense; modern = storage/memory)
- Buehne compounds picked up "attic" (regional Austrian sense; standard = stage)
- Puppe(ntheater/spiel) picked up "chick" (slang)
- A handful of other one-off nonsense glosses spotted in the same sweep
"""
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

FIXES = {
    # Theater compounds (ruckus -> theater)
    'Staatstheater': 'state theater',
    'Theateraufführung': 'theater performance',
    'Puppentheater': 'puppet theater',
    'Theaterbühne': 'theater stage',
    'Theaterpädagogin': 'drama teacher (f.)',
    'Filmtheater': 'cinema/movie theater',
    'Theaterpädagogik': 'drama education/theater pedagogy',
    'Theatervorstellung': 'theater performance',
    'Figurentheater': 'puppet theater/figure theater',
    'Kindertheater': "children's theater",
    'Theaterbesuch': 'theater visit',
    'Theaterkasse': 'theater box office',
    'Theaterpädagoge': 'drama teacher (m.)',
    'Hoftheater': 'court theater',
    'Theaterabend': 'theater evening',
    'Theaterszene': 'theater scene',

    # Haus compounds (bod -> house)
    'Hauswirtschaft': 'home economics/housekeeping',
    'Hausbau': 'house building/house construction',
    'Hausrat': 'household goods',
    'Kurhaus': 'spa house',
    'Hausverwaltung': 'property management',
    'Backhaus': 'bakehouse',
    'Schulhaus': 'schoolhouse',
    'Hausschwein': 'domestic pig',
    'Königshaus': 'royal house/dynasty',
    'Traumhaus': 'dream house',
    'Literaturhaus': 'literature house',
    'Gutshaus': 'manor house',
    'Vereinshaus': 'clubhouse',
    'Funkhaus': 'broadcasting house',
    'Hausärztin': 'family doctor (f.)/GP (f.)',
    'Gewandhaus': 'concert hall (Gewandhaus)',
    'Hausgerät': 'household appliance',
    'Haussperling': 'house sparrow',
    'Hausverbot': 'ban from premises',
    'Hauskauf': 'house purchase',
    'Hausarrest': 'house arrest',
    'Hausgarten': 'home garden',
    'Hausgebrauch': 'domestic use',
    'Hausverwalter': 'property manager (m.)',
    'Vogelhaus': 'birdhouse',
    'Badehaus': 'bathhouse',
    'Hausberg': 'local mountain',
    'Hausflur': 'hallway',
    'Nachbarhaus': 'neighboring house',
    'Patrizierhaus': 'patrician house',
    'Glashaus': 'greenhouse/glasshouse',
    'Hausrind': 'domestic cattle',
    'Torfhaus': 'peat house',
    'Hausgemeinschaft': 'house community/residents',
    'Hausverkauf': 'house sale',
    'Reformhaus': 'health food store',
    'Sommerhaus': 'summer house',
    'Gewerkschaftshaus': 'trade union building',
    'Hausbewohner': 'house occupant/resident',
    'Hausfassade': 'house façade',

    # Speicher compounds (attic -> storage/memory)
    'Speicherkapazität': 'storage capacity',
    'Speichermedium': 'storage medium',
    'Stromspeicher': 'electricity storage',
    'Energiespeicher': 'energy storage',
    'Batteriespeicher': 'battery storage',
    'Speicherstadt': 'warehouse district',
    'Wasserspeicher': 'water reservoir/water tank',
    'Fehlerspeicher': 'error memory/fault memory',

    # Bühne compounds (attic -> stage) — Theaterbühne already covered above
    'Hauptbühne': 'main stage',
    'Bühnentechnik': 'stage technology',

    # Puppe (chick -> doll/puppet)
    'Puppe': 'doll/puppet',
    'Puppenspiel': 'puppet play',

    # Other one-off fixes
    'Aktienhandel': 'stock trading',
    'Aktienkauf': 'share purchase',
    'Bauchdecke': 'abdominal wall',
    'Lastenfahrrad': 'cargo bike',
    'Belastungsgrenze': 'load limit',
    'Achslast': 'axle load',
    'Traglast': 'load capacity',
    'Nachweisgrenze': 'detection limit',
    'Strahlenbelastung': 'radiation exposure',

    # Other suspect glosses
    'Hase': 'hare/rabbit',
    'Schnitte': 'slice/sandwich',

    # User-reported nonsense (round 2)
    'Wettquote': 'betting odds',
    'Hautfarbe': 'skin color/skin colour/complexion',
    'Hirsch': 'deer/stag',
    'Tarifvertragspartei': 'party to a collective bargaining agreement',
    'Hinterkopf': 'back of the head',

    # "frog" = horse-anatomy sense of Strahl (the V-pad on a hoof). Not what
    # anyone learning German needs first.
    'Strahl': 'ray/beam/jet',
    'Strahlenschutz': 'radiation protection',
    'Strahlentherapie': 'radiation therapy',
    'Strahlenquelle': 'radiation source',
    'Strahlkraft': 'radiance/charisma',

    # "litter" = stretcher sense of Trage. Carrying / wearing is the modern sense.
    'Trage': 'stretcher',
    'Tragekomfort': 'wearing comfort',
    'Tragegurt': 'carrying strap',

    # Misc first-sense-is-slang
    'Elch': 'elk/moose',
    'Pfote': 'paw',
}


def main():
    path = 'data/nouns.json'
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    nouns = data['nouns']
    fixed = []
    skipped_already_good = []
    not_found = list(FIXES.keys())

    for n in nouns:
        word = n.get('word')
        if word not in FIXES:
            continue
        not_found.remove(word)
        new_eng = FIXES[word]
        old_eng = n.get('english', '') or ''
        if old_eng == new_eng:
            skipped_already_good.append(word)
            continue
        n['english'] = new_eng
        fixed.append((word, old_eng, new_eng))

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'Fixed {len(fixed)} entries.')
    for w, old, new in fixed:
        print(f'  {w}: {old!r} -> {new!r}')
    if skipped_already_good:
        print(f'\nAlready correct: {len(skipped_already_good)}')
    if not_found:
        print(f'\nWord not found in dataset: {not_found}')


if __name__ == '__main__':
    main()
