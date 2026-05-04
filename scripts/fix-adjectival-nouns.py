#!/usr/bin/env python3
"""
Fix systematically wrong adjectival-noun (substantivized adjective) headwords.

In German, adjectival nouns inflect like adjectives:
  - With definite article (weak decl): der Reiche, die Reiche, das Neugeborene
  - Without article (strong decl): ein Reicher, eine Reiche, ein Neugeborenes

The dataset has stored many entries combining the article (der/das) with the
strong-declension form (-er/-es), which is grammatically wrong:
  ✘ "der Reicher" / "der Beamter" / "das Neugeborenes"
  ✓ "der Reiche" / "der Beamte" / "das Neugeborene"

Detection: an entry is an adjectival noun if its plural (without article) ends
in -e and equals the word's stem after dropping the strong-decl ending. In
practice we detect:
  - article=der, word ends in -er, plural == word[:-1]   →  drop -r
  - article=das, word ends in -es, plural == word[:-1]   →  drop -s

Also fixes a few specific translation artifacts where the headword's suffix
was translated as a separate word:
  - "tiger" (from -iger suffix), "ester"/"stere" (from -ester), "fender"
    (from -ender), "blockhead" (compound translator garbage), etc.
"""
import json, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
NOUNS_PATH = ROOT / 'data' / 'nouns.json'

# Translation overrides for cases where the existing English is corrupted by
# suffix-stripped MT (e.g. "Erwerbstätiger" → "tiger"). Keys are the FIXED
# (weak-decl) headword without the strong-decl ending.
TRANSLATION_FIX = {
    'Erwerbstätige':       'gainfully employed person',
    'Steuerpflichtige':    'taxpayer',
    'Bedürftige':          'person in need',
    'Schwächste':          'weakest one',
    'Jüngste':             'youngest one',
    'Vermisste':           'missing person',
    'Älteste':             'eldest / elder',
    'Jahrgangsbeste':      'top of the class / valedictorian',
    'Schaulustige':        'onlooker / rubberneck',
    'Mächtige':            'powerful person',
    'Flüchtige':           'fugitive',
    'Tabellenzweite':      'second-place team / runner-up (in standings)',
    'Tabellenfünfte':      'fifth-place team (in standings)',
    'Tabellenletzte':      'bottom-of-the-table team',
    'Filmschaffende':      'filmmaker / film professional',
    'Kulturschaffende':    'cultural professional / creative artist',
    'Kunstschaffende':     'artist / creative professional',
    'Schlafende':          'sleeper / sleeping person',
    'Gehörlose':           'deaf person',
    'Erwerbslose':         'unemployed person',
    'Sehende':             'sighted person',
    'Westdeutsche':        'West German',
    'Süddeutsche':         'South German',
    'Ostdeutsche':         'East German',
    'Alteingesessene':     'long-time resident',
    'Ältester':            'eldest / elder',  # in case it survives as -ester
    'Tatverdächtige':      'suspect',
    'Bundesvorsitzende':   'national chairperson',
    'Ratsvorsitzende':     'council chairperson',
    'Bürgerbeauftragte':   'citizens\' commissioner / ombudsperson',
    'Heimatvertriebene':   'expellee / displaced person',
    'Kriegstote':          'war casualty / war dead',
    'Schwerkranke':        'seriously ill person',
    'Brauner':             'bay (horse colour) / brown one',
    'Brauner_FIXED':       'bay (horse colour) / brown one',  # placeholder
    'Braune':              'bay (horse) / brown one',
    'Bahnreisende':        'rail traveller',
    'Normale':             'ordinary person',
    'Kurze':               'shot (of spirits)',
    'Untote':              'undead',
    'Drogentote':          'drug-related fatality',
    'Synodale':            'synod member',
    'Indigene':            'indigenous person',
    'Adelige':             'noble / aristocrat',
    'Abhängige':           'dependent / addict',
    'Gefallene':           'fallen soldier',
    'Verheiratete':        'married person',
    'Trauernde':           'mourner',
    'Benachteiligte':      'disadvantaged person',
    'Sechsjährige':        'six-year-old',
    'Neugierige':          'curious person',
    'Verfolgte':           'persecuted person / victim of persecution',
    'Adlige':              'noble / aristocrat',
    'Zweijährige':         'two-year-old',
    'Infizierte':          'infected person',
    'Krankenversicherte':  'health-insurance holder',
    'Liebende':            'lover',
    'Asylberechtigte':     'asylum entitlee',
    'Ortsansässige':       'local resident',
    'Verrückte':           'crazy person / madman',
    'Geübte':              'experienced person',
    'Inhaftierte':         'detainee / inmate',
    'Kurzentschlossene':   'spur-of-the-moment decider',
    'Getötete':            'person killed',
    'Verwundete':          'wounded person',
    'Protestierende':      'protester',
    'Hochqualifizierte':   'highly qualified person',
    'Eingeweihte':         'initiate / insider',
    'Elfjährige':          'eleven-year-old',
    'Geringqualifizierte': 'low-qualified person',
    'Illegale':            'undocumented person / illegal',
    'Intersexuelle':       'intersex person',
    'Krebskranke':         'cancer patient',
    'Porträtierte':        'portrait subject',
    'Transsexuelle':       'transsexual person',
    'Drittplatzierte':     'third-place finisher',
    'Hartgesottene':       'hard-boiled person',
    'Hungrige':            'hungry person',
    'Schwerhörige':        'hard-of-hearing person',
    'Superreiche':         'super-rich person',
    'Ungläubige':          'non-believer',
    'Frommer':             'devout one',  # if survives
    'Fromme':              'devout person',
    'Geretteter':          'rescued person',
    'Gerettete':           'rescued person',
    'Gesuchte':            'wanted person',
    'Hauptverdächtige':    'chief suspect',
    'Vermögende':          'wealthy person',
    'Aufständische':       'insurgent',
    'Untergebene':         'subordinate',
    'Ermordete':           'murder victim',
    'Geliebte':            'beloved / lover',
    'Süchtige':            'addict',
    'Allerwerteste':       'rear end / posterior (humorous)',
    'Auserwählte':         'chosen one',
    'Einjährige':          'one-year-old',
    'Erstgeborene':        'firstborn',
    'Schiffbrüchige':      'castaway',
    'Hungernde':           'starving person',
    'Gerechte':            'just person / righteous one',
    'Gejagte':             'hunted person / quarry',
    'Eisheilige':          'Ice Saint (mid-May tradition)',
    'Rechtsradikale':      'far-right person',
    'Übergewichtige':      'overweight person',
    'Zuständige':          'person in charge',
    'Autonome':            'autonomist (politics)',
    'Betrunkene':          'drunk person',
    'Industrielle':        'industrialist',
    'Strafgefangene':      'inmate / prisoner',
    'Unschuldige':         'innocent person',
    'Vierjährige':         'four-year-old',
    'Angeschuldigte':      'accused / defendant',
    'Binnenvertriebene':   'internally displaced person',
    'Erfahrene':           'experienced person',
    'Gehbehinderte':       'mobility-impaired person',
    'Schiffbrüchige':      'castaway',
    'Siebte':              'seventh (one)',
    'Umweltbeauftragte':   'environmental commissioner',
    'Unparteiische':       'impartial party / referee',
    'Sechste':             'sixth (one)',
    'Ungläubige':          'non-believer / infidel',
    'Holocaustüberlebende':'Holocaust survivor',
    'Hauptverdächtige':    'chief suspect',
    'Generalbevollmächtigte':'general representative',
    'Führende':            'leader / leading figure',
    'Finanzbeamte':        'tax officer',
    'Farbige':             'person of colour',
    'Verwaltungsangestellte':'administrative employee',
    'Verwaltungsbeamte':   'administrative civil servant',
    'Hygienebeauftragte':  'hygiene officer',
    'Ministerialbeauftragte':'ministerial commissioner',
    'Landesdatenschutzbeauftragte':'state data protection commissioner',
    'Leidtragende':        'sufferer',
    'Neunjährige':         'nine-year-old',
    'Schwächste':          'weakest one',
    'Zollbeamte':          'customs officer',
    'Außerirdische':       'alien / extraterrestrial',
    'Konservative':        'conservative (person)',
    'Mitreisende':         'fellow traveller',
    'Sterbende':           'dying person',
    'Zehnte':              'tenth (one)',
    'Zweitplatzierte':     'runner-up',
    'Irre':                'crazy person',
    'Schuldige':           'guilty person / culprit',
    'Volljährige':         'adult (legally of age)',
    'Andersdenkende':      'dissenter',
    'Dreijährige':         'three-year-old',
    'Zwölfjährige':        'twelve-year-old',
    'Adlige':              'noble / aristocrat',
    'Oppositionelle':      'opposition member',
    'Parteivorsitzende':   'party chair',
    'Vereinsvorsitzende':  'club chair',
    'Westdeutsche':        'West German',
    'Gesandte':            'envoy / ambassador',
    'Drogenabhängige':     'drug addict',
    'Handelnde':           'actor / agent',
    'Jobsuchende':         'job seeker',
    'Schwerverletzte':     'seriously injured person',
    'Synodale':            'synod member',
    'Untote':              'undead person',
    'Bundesfreiwillige':   'federal volunteer service participant',
    'Europaabgeordnete':   'Member of European Parliament',
    'Fünfjährige':         'five-year-old',
    'Hausangestellte':     'domestic worker',
    'Heimatvertriebene':   'expellee',
    'Herrschende':         'ruler / ruling figure',
    'Sechste':             'sixth one',
    'Siebenjährige':       'seven-year-old',
    'Streikende':          'striker',
    'Arbeitsuchende':      'job seeker',
    'Schutzsuchende':      'person seeking protection',
    'Ortsansässige':       'local resident',
    'Bankangestellte':     'bank employee',
    'Ausschussvorsitzende':'committee chair',
}


def main():
    nd = json.loads(NOUNS_PATH.read_text(encoding='utf-8'))
    nouns = nd['nouns']

    fixed_word = 0
    fixed_translation = 0
    skipped = []

    for n in nouns:
        w = n['word']
        a = n['article']
        pl = n.get('plural', '')

        new_word = None

        # Pattern 1: der + word ending in -er, plural == word[:-1]
        if a == 'der' and w.endswith('er') and pl and pl == w[:-1]:
            new_word = w[:-1]

        # Pattern 2: das + word ending in -es, plural == word[:-1]
        elif a == 'das' and w.endswith('es') and pl and pl == w[:-1]:
            new_word = w[:-1]

        if new_word:
            n['word'] = new_word
            n['adjectivalNoun'] = True
            # Update help text
            n['articleHelp'] = (
                'Adjectival noun (substantivized adjective). With the definite '
                'article it takes weak adjective endings: '
                f'der/die {new_word} (sg.), die {new_word + ("n" if not new_word.endswith("n") else "")} (pl.). '
                'Without article (strong endings): '
                f'ein {new_word + ("r" if a=="der" else "s") if a in ("der","das") else new_word}, '
                f'{new_word} (pl.).'
            )
            n['pluralHelp'] = (
                f'die {new_word + ("n" if not new_word.endswith("n") else "")} (with article — weak endings). '
                f'Without article: "{new_word}" (strong endings). '
                'Adjectival nouns are declined like their corresponding adjectives.'
            )
            fixed_word += 1

            # Apply translation override if present and current looks corrupt
            override = TRANSLATION_FIX.get(new_word)
            if override:
                cur = n.get('english', '').strip()
                # heuristic: replace if current is short, empty, or matches known MT noise tokens
                bad_tokens = ('tiger', 'ester', 'stere', 'fender', 'blockhead', 'pus',
                              'vest German', 'flaw stere', 'Essene', 'artist',
                              'home displaced', 'war corpse', 'ear blockhead',
                              'acquirement blockhead', 'business searcher', 'care searcher',
                              'job searcher', 'act suspect', 'asylum entitlee',
                              'Cancer sick person')
                if (not cur) or any(b in cur for b in bad_tokens) or len(cur) < 4:
                    n['english'] = override
                    fixed_translation += 1

    NOUNS_PATH.write_text(json.dumps(nd, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Fixed adjectival-noun headword on {fixed_word} entries')
    print(f'Also corrected {fixed_translation} corrupted translations')


if __name__ == '__main__':
    main()
