#!/usr/bin/env python3
"""Fix empty and garbage translations in adjectives and nouns."""
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

# ═══════════════════════════════════════════════════════════════
# ADJECTIVE TRANSLATION FIXES
# ═══════════════════════════════════════════════════════════════

# Direct translations for known empty/wrong adjectives
ADJ_DIRECT = {
    'personenbezogen': 'personal/person-related',
    'geplant': 'planned',
    'nachfolgend': 'following/subsequent',
    'komfortabel': 'comfortable',
    'weiterführend': 'advanced/further',
    'selbständig': 'independent/self-employed',
    'alleinerziehend': 'single-parent',
    'festgelegt': 'fixed/established',
    'potentiell': 'potential',
    'anstehend': 'upcoming/pending',
    'außerschulisch': 'extracurricular',
    'kaufmännisch': 'commercial/business',
    'namhaft': 'notable/well-known',
    'bevorzugt': 'preferred',
    'überregional': 'national/supraregional',
    'dazugehörig': 'associated/belonging to',
    'personell': 'personnel/staffing',
    'aufregend': 'exciting',
    'zugelassen': 'approved/licensed',
    'eingeschränkt': 'limited/restricted',
    'zugänglich': 'accessible',
    'zugeh\u00f6rig': 'belonging to/associated',
    'aufwändig': 'elaborate/costly',
    'datenschutzrechtlich': 'data protection (legal)',
    'kassenärztlich': 'statutory health insurance',
    'traumhaft': 'fantastic/dreamlike',
    'besetzt': 'occupied/busy',
    'zielgerichtet': 'targeted/purposeful',
    'dreijährig': 'three-year',
    'großflächig': 'large-scale/extensive',
    'herausragend': 'outstanding',
    'ausgezeichnet': 'excellent',
    'begeistert': 'enthusiastic',
    'beeindruckend': 'impressive',
    'anspruchsvoll': 'demanding/sophisticated',
    'ausreichend': 'sufficient',
    'auffällig': 'conspicuous/noticeable',
    'unglaublich': 'incredible/unbelievable',
    'übersichtlich': 'clear/well-arranged',
    'fehlerhaft': 'faulty/erroneous',
    'leistungsfähig': 'capable/efficient',
    'gewinnbringend': 'profitable',
    'aussagekräftig': 'meaningful/informative',
    'rechtswidrig': 'unlawful/illegal',
    'verfügbar': 'available',
    'bemerkenswert': 'remarkable/noteworthy',
    'grundlegend': 'fundamental',
    'eigenständig': 'independent/autonomous',
    'abwechslungsreich': 'varied/diverse',
    'erfahrungsgemäß': 'from experience',
    'sorgfältig': 'careful/thorough',
    'sachkundig': 'expert/knowledgeable',
    'umfangreich': 'extensive/comprehensive',
    'kurzfristig': 'short-term/at short notice',
    'langfristig': 'long-term',
    'mittelfristig': 'medium-term',
    'großzügig': 'generous/spacious',
    'kleinräumig': 'small-scale/local',
    'weitreichend': 'far-reaching',
    'tiefgreifend': 'profound/far-reaching',
    'leistungsstark': 'powerful/high-performance',
    'kostengünstig': 'cost-effective',
    'kostenlos': 'free (of charge)',
    'kostenpflichtig': 'chargeable/paid',
    'steuerfrei': 'tax-free',
    'gebührenfrei': 'fee-free',
    'zollfrei': 'duty-free',
    'alkoholfrei': 'non-alcoholic',
    'rauchfrei': 'smoke-free',
    'gentechnisch': 'genetically modified',
    'handwerklich': 'artisanal/craft',
    'landwirtschaftlich': 'agricultural',
    'forstwirtschaftlich': 'forestry',
    'marktwirtschaftlich': 'market economy',
    'betriebswirtschaftlich': 'business management',
    'arbeitsrechtlich': 'labor law',
    'verfassungsrechtlich': 'constitutional',
    'verwaltungsrechtlich': 'administrative law',
    'strafrechtlich': 'criminal law',
    'zivilrechtlich': 'civil law',
    'völkerrechtlich': 'international law',
    'urheberrechtlich': 'copyright',
    'wettbewerbsrechtlich': 'competition law',
    'wahlberechtigt': 'eligible to vote',
    'verantwortungsvoll': 'responsible',
    'verantwortungsbewusst': 'responsible/conscientious',
    'umweltbewusst': 'environmentally conscious',
    'gesundheitsbewusst': 'health-conscious',
    'naturbelassen': 'natural/unprocessed',
    'maßgeschneidert': 'tailor-made/custom',
    'handgemacht': 'handmade',
    'hausgemacht': 'homemade',
    'selbstgemacht': 'self-made/homemade',
    'zweisprachig': 'bilingual',
    'mehrsprachig': 'multilingual',
    'einsprachig': 'monolingual',
    'vierjährig': 'four-year',
    'fünfjährig': 'five-year',
    'sechsjährig': 'six-year',
    'zehnjährig': 'ten-year',
    'zwanzigjährig': 'twenty-year',
    'hundertjährig': 'centennial',
    'zweijährig': 'two-year/biennial',
    'einjährig': 'one-year/annual',
    'halbjährig': 'semi-annual',
    'ganzjährig': 'year-round',
    'ganztägig': 'all-day/full-time',
    'halbtägig': 'half-day',
    'mehrtägig': 'multi-day',
    'zweitägig': 'two-day',
    'dreitägig': 'three-day',
    'einwöchig': 'one-week',
    'zweiwöchig': 'two-week',
    'einmonatig': 'one-month',
    'dreimonatig': 'three-month',
    'sechsmonatig': 'six-month',
    # Geographic/national
    'niedersächsisch': 'Lower Saxon',
    'schleswig-holsteinisch': 'Schleswig-Holsteinian',
    'mecklenburgisch': 'Mecklenburgian',
    'brandenburgisch': 'Brandenburgian',
    'thüringisch': 'Thuringian',
    'sächsisch': 'Saxon',
    'bayerisch': 'Bavarian',
    'schwäbisch': 'Swabian',
    'hessisch': 'Hessian',
    'fränkisch': 'Franconian',
    'rheinisch': 'Rhenish',
    'westfälisch': 'Westphalian',
    'preußisch': 'Prussian',
    'afrikanisch': 'African',
    'asiatisch': 'Asian',
    'lateinamerikanisch': 'Latin American',
    'südamerikanisch': 'South American',
    'nordamerikanisch': 'North American',
    'karibisch': 'Caribbean',
    'baltisch': 'Baltic',
    'skandinavisch': 'Scandinavian',
    'osteuropäisch': 'Eastern European',
    'westeuropäisch': 'Western European',
    'australisch': 'Australian',
    'brasilianisch': 'Brazilian',
    'mexikanisch': 'Mexican',
    'koreanisch': 'Korean',
    'schwedisch': 'Swedish',
    'norwegisch': 'Norwegian',
    'dänisch': 'Danish',
    'finnisch': 'Finnish',
    'niederländisch': 'Dutch',
    'belgisch': 'Belgian',
    'portugiesisch': 'Portuguese',
    'tschechisch': 'Czech',
    'ungarisch': 'Hungarian',
    'rumänisch': 'Romanian',
    'bulgarisch': 'Bulgarian',
    'kroatisch': 'Croatian',
    'serbisch': 'Serbian',
    'ukrainisch': 'Ukrainian',
    'vietnamesisch': 'Vietnamese',
    'thailändisch': 'Thai',
    'ägyptisch': 'Egyptian',
    'marokkanisch': 'Moroccan',
    'argentinisch': 'Argentinian',
    'chilenisch': 'Chilean',
    'peruanisch': 'Peruvian',
    'kubanisch': 'Cuban',
    'iranisch': 'Iranian',
    'israelisch': 'Israeli',
    'palästinensisch': 'Palestinian',
    'syrisch': 'Syrian',
    'irakisch': 'Iraqi',
    'afghanisch': 'Afghan',
    'pakistanisch': 'Pakistani',
    'indonesisch': 'Indonesian',
    'philippinisch': 'Philippine',
    'mongolisch': 'Mongolian',
    'tibetisch': 'Tibetan',
    'hawaiianisch': 'Hawaiian',
    # Scientific/technical -isch
    'olympisch': 'Olympic',
    'akademisch': 'academic',
    'diplomatisch': 'diplomatic',
    'dramatisch': 'dramatic',
    'dynamisch': 'dynamic',
    'elektrisch': 'electric',
    'elektronisch': 'electronic',
    'energetisch': 'energetic',
    'exotisch': 'exotic',
    'fanatisch': 'fanatical',
    'fantastisch': 'fantastic',
    'genetisch': 'genetic',
    'heroisch': 'heroic',
    'historisch': 'historic/historical',
    'hygienisch': 'hygienic',
    'ironisch': 'ironic',
    'kategorisch': 'categorical',
    'klassisch': 'classical',
    'kosmisch': 'cosmic',
    'logisch': 'logical',
    'magnetisch': 'magnetic',
    'mechanisch': 'mechanical',
    'melodisch': 'melodic',
    'methodisch': 'methodical',
    'mystisch': 'mystical',
    'neurotisch': 'neurotic',
    'nostalgisch': 'nostalgic',
    'optimistisch': 'optimistic',
    'organisch': 'organic',
    'panisch': 'panicky',
    'patriotisch': 'patriotic',
    'pessimistisch': 'pessimistic',
    'philosophisch': 'philosophical',
    'physisch': 'physical',
    'poetisch': 'poetic',
    'polemisch': 'polemical',
    'populistisch': 'populist',
    'pragmatisch': 'pragmatic',
    'problematisch': 'problematic',
    'prophetisch': 'prophetic',
    'protestantisch': 'Protestant',
    'psychiatrisch': 'psychiatric',
    'realistisch': 'realistic',
    'rhetorisch': 'rhetorical',
    'romantisch': 'romantic',
    'satirisch': 'satirical',
    'schematisch': 'schematic',
    'skeptisch': 'skeptical',
    'sozialistisch': 'socialist',
    'spezifisch': 'specific',
    'statistisch': 'statistical',
    'strategisch': 'strategic',
    'symbolisch': 'symbolic',
    'synthetisch': 'synthetic',
    'systematisch': 'systematic',
    'therapeutisch': 'therapeutic',
    'tragisch': 'tragic',
    'tropisch': 'tropical',
    'typisch': 'typical',
    'utopisch': 'utopian',
    'zynisch': 'cynical',
    'chronisch': 'chronic',
    'klinisch': 'clinical',
    'toxisch': 'toxic',
    'ethnisch': 'ethnic',
    'ethisch': 'ethical',
    'ästhetisch': 'aesthetic',
    'authentisch': 'authentic',
    'chaotisch': 'chaotic',
    'demokratisch': 'democratic',
    'didaktisch': 'didactic',
    'empirisch': 'empirical',
    'erotisch': 'erotic',
    'evangelisch': 'Protestant/evangelical',
    'forensisch': 'forensic',
    'geologisch': 'geological',
    'hierarchisch': 'hierarchical',
    'ideologisch': 'ideological',
    'journalistisch': 'journalistic',
    'juristisch': 'legal/juridical',
    'katholisch': 'Catholic',
    'kommunistisch': 'communist',
    'linguistisch': 'linguistic',
    'marxistisch': 'Marxist',
    'mathematisch': 'mathematical',
    'metaphorisch': 'metaphorical',
    'militärisch': 'military',
    'monarchisch': 'monarchical',
    'moralisch': 'moral',
    'mythologisch': 'mythological',
    'ökologisch': 'ecological',
    'ökonomisch': 'economic',
    'pädagogisch': 'pedagogical',
    'parlamentarisch': 'parliamentary',
    'pharmazeutisch': 'pharmaceutical',
    'physiologisch': 'physiological',
    'politisch': 'political',
    'psychologisch': 'psychological',
    'rassistisch': 'racist',
    'rhythmisch': 'rhythmic',
    'semantisch': 'semantic',
    'soziologisch': 'sociological',
    'technologisch': 'technological',
    'theologisch': 'theological',
    'theoretisch': 'theoretical',
    'traumatisch': 'traumatic',
    'volkswirtschaftlich': 'macroeconomic',
    'zoologisch': 'zoological',
    'astronomisch': 'astronomical',
    'biologisch': 'biological',
    'chemisch': 'chemical',
    'chirurgisch': 'surgical',
    'diagnostisch': 'diagnostic',
    'epidemiologisch': 'epidemiological',
    'gynäkologisch': 'gynecological',
    'kardiologisch': 'cardiological',
    'meteorologisch': 'meteorological',
    'mikroskopisch': 'microscopic',
    'neurologisch': 'neurological',
    'onkologisch': 'oncological',
    'orthopädisch': 'orthopedic',
    'pathologisch': 'pathological',
    'radiologisch': 'radiological',
    'seismisch': 'seismic',
    'thermisch': 'thermal',
    'urologisch': 'urological',
    'vulkanisch': 'volcanic',
}

# Pattern-based translation for garbage -y/-ish, -like/-ly, -ish/-ic patterns
GARBAGE_PATTERNS = [
    re.compile(r'^-(?:like|mannered)\s'),   # "-like/mannered X"
    re.compile(r'-y/-ish$'),                 # "X-y/-ish"
    re.compile(r'-ish/-ic$'),                # "X-ish/-ic"
    re.compile(r'-like/-ly$'),               # "X-like/-ly"
    re.compile(r'^-like/'),                  # "-like/..."
]

def is_garbage_translation(eng):
    """Check if a translation looks auto-generated/garbage"""
    if not eng:
        return True
    for pat in GARBAGE_PATTERNS:
        if pat.search(eng):
            return True
    return False


# ═══════════════════════════════════════════════════════════════
# NOUN TRANSLATION FIXES
# ═══════════════════════════════════════════════════════════════

NOUN_DIRECT = {
    'Überschreitung': 'exceeding/violation',
    'Minderung': 'reduction/decrease',
    'Unklarheit': 'uncertainty/ambiguity',
    'Vertraulichkeit': 'confidentiality',
    'Verhinderung': 'prevention',
    'Buchen': 'booking/reservation',
    'Schenkung': 'donation/gift',
    'Socken': 'sock',
    'Stehen': 'standing',
    'Strukturierung': 'structuring',
    'Assistenz': 'assistance',
    'Zuzahlung': 'co-payment',
    'Anlieger': 'resident/neighbor',
    'Amphibium': 'amphibian',
    'Belag': 'coating/topping/flooring',
    'Biographie': 'biography',
    'Mailing': 'mailing',
    'Leichtigkeit': 'ease/lightness',
    'Mathe': 'math',
    'Saatgut': 'seed/seeds',
    'Betreten': 'entering/entry',
    'Deutschunterricht': 'German class/lesson',
    'Gemeinwohl': 'common good',
    'Leistungssport': 'competitive sports',
    'Neurologie': 'neurology',
    'Pubertät': 'puberty',
    'Treue': 'loyalty/faithfulness',
}


def main():
    # ── Fix adjectives ──
    with open('data/adjectives.json', 'r', encoding='utf-8') as f:
        adj_data = json.load(f)

    adjs = adj_data['adjectives']

    adj_fixed_direct = 0
    adj_fixed_garbage = 0

    for a in adjs:
        word = a['word']
        eng = a.get('english', '') or ''

        # Fix direct known translations (empty or wrong)
        if word in ADJ_DIRECT:
            if not eng.strip() or is_garbage_translation(eng):
                a['english'] = ADJ_DIRECT[word]
                adj_fixed_direct += 1
                continue

        # Fix garbage pattern translations
        if eng and is_garbage_translation(eng):
            if word in ADJ_DIRECT:
                a['english'] = ADJ_DIRECT[word]
                adj_fixed_garbage += 1

    print(f'Adjectives: fixed {adj_fixed_direct} empty, {adj_fixed_garbage} garbage translations')

    still_empty = sum(1 for a in adjs if not (a.get('english') or '').strip())
    still_garbage = sum(1 for a in adjs if is_garbage_translation(a.get('english', '')))
    print(f'Adjectives remaining: {still_empty} empty, {still_garbage} garbage')

    adj_data['adjectives'] = adjs
    with open('data/adjectives.json', 'w', encoding='utf-8') as f:
        json.dump(adj_data, f, ensure_ascii=False, indent=2)
    print('Saved adjectives.json')

    # ── Fix nouns ──
    with open('data/nouns.json', 'r', encoding='utf-8') as f:
        noun_data = json.load(f)

    nouns_list = noun_data['nouns']
    noun_fixed = 0

    for n in nouns_list:
        word = n['word']
        eng = n.get('english', '') or ''

        if word in NOUN_DIRECT and not eng.strip():
            n['english'] = NOUN_DIRECT[word]
            noun_fixed += 1

    still_empty_nouns = sum(1 for n in nouns_list if not (n.get('english') or '').strip())
    print(f'\nNouns: fixed {noun_fixed} empty translations')
    print(f'Nouns remaining empty: {still_empty_nouns}')

    noun_data['nouns'] = nouns_list
    with open('data/nouns.json', 'w', encoding='utf-8') as f:
        json.dump(noun_data, f, ensure_ascii=False, indent=2)
    print('Saved nouns.json')


if __name__ == '__main__':
    main()
