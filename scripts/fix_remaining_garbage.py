#!/usr/bin/env python3
import json, sys, re
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def is_garbage(eng):
    if not eng or not eng.strip():
        return True
    patterns = [r'-y/-ish$', r'-ish/-ic$', r'-like/-ly$', r'^-like/', r'-like/mannered', r'-like/moderate']
    for p in patterns:
        if re.search(p, eng):
            return True
    if re.search(r'\w+-able$', eng):
        return True
    return False

FIXES = {
    'rassisch': 'racial', 'schriftstellerisch': 'literary/writerly',
    'tolerierbar': 'tolerable', 'verkraftbar': 'bearable/manageable',
    'volkskundlich': 'ethnographic/folklore', 'bretonisch': 'Breton',
    'bronzezeitlich': 'Bronze Age', 'episodisch': 'episodic',
    'fleckig': 'spotted/stained', 'gutachtlich': 'expert/advisory',
    'irrsinnig': 'insane/absurd', 'meisterlich': 'masterful',
    'nomadisch': 'nomadic', 'schelmisch': 'mischievous/roguish',
    'schleimig': 'slimy/smarmy', 'spätmittelalterlich': 'late medieval',
    'stapelbar': 'stackable', 'sudanesisch': 'Sudanese',
    'tiermedizinisch': 'veterinary', 'verbrecherisch': 'criminal',
    'wollig': 'woolly', 'auswertbar': 'evaluable/analyzable',
    'beweisbar': 'provable', 'brieflich': 'by letter/epistolary',
    'chorisch': 'choral', 'cineastisch': 'cinematic',
    'erdig': 'earthy', 'fundamentalistisch': 'fundamentalist',
    'gleichgewichtig': 'balanced/of equal weight', 'jazzig': 'jazzy',
    'langwellig': 'long-wave', 'mosaikartig': 'mosaic-like',
    'schwergewichtig': 'heavyweight', 'spätsommerlich': 'late summer',
    'stufig': 'stepped/tiered', 'wiedererkennbar': 'recognizable',
    'bauchig': 'bulbous/potbellied', 'blitzartig': 'lightning-fast',
    'duftig': 'fragrant/delicate', 'erfüllbar': 'fulfillable',
    'hochmittelalterlich': 'high medieval',
    'kleinbürgerlich': 'petty bourgeois', 'moorig': 'boggy/marshy',
    'nervlich': 'nerve-related', 'pfändbar': 'seizable',
    'rassig': 'spirited/racy', 'ritterlich': 'chivalrous/knightly',
    'therapierbar': 'treatable', 'untergewichtig': 'underweight',
    'vermittelbar': 'placeable/conveyable', 'wahnwitzig': 'insane/crazy',
    'agitatorisch': 'agitational', 'auflösbar': 'dissolvable/resolvable',
    'basaltisch': 'basaltic', 'begehrlich': 'covetous/desirous',
    'behebbar': 'fixable/remediable', 'bundesstaatlich': 'federal',
    'draufgängerisch': 'daring/reckless', 'einlagig': 'single-layer',
    'erforschbar': 'researchable/explorable', 'filzig': 'felted/stingy',
    'fraulich': 'womanly/feminine', 'gelartig': 'gel-like',
    'geldlich': 'monetary/financial', 'geleeartig': 'gelatinous',
    'gerichtsmedizinisch': 'forensic medical', 'glasartig': 'vitreous/glassy',
    'hellseherisch': 'clairvoyant', 'herstellbar': 'producible',
    'humanmedizinisch': 'human medicine',
    'käsig': 'cheesy/pale', 'kauzig': 'eccentric/quirky',
    'nachrichtlich': 'informational', 'nachsichtig': 'lenient/indulgent',
    'nebelig': 'foggy/misty', 'prognostizierbar': 'predictable',
    'schiedsrichterlich': 'referee/arbitral', 'schnulzig': 'cheesy/sentimental',
    'schwächlich': 'feeble/weak', 'sprachgeschichtlich': 'linguistic-historical',
    'tyrannisch': 'tyrannical', 'vererbbar': 'heritable',
    'verlustig': 'forfeiting', 'weltgeschichtlich': 'world-historical',
    'erregbar': 'excitable', 'fasslich': 'comprehensible',
    'freidenkerisch': 'freethinking', 'lautlich': 'phonetic',
    'schlagbar': 'beatable', 'schwärzlich': 'blackish',
    'schwielig': 'calloused', 'stereotypisch': 'stereotypical',
    'überseeisch': 'overseas', 'unlustig': 'unamused/reluctant',
    'waldig': 'wooded/forested', 'machtgierig': 'power-hungry',
    'mehrwertig': 'multivalent', 'mordsmäßig': 'tremendous/enormous',
    'oxidisch': 'oxidic', 'philatelistisch': 'philatelic',
    'planwirtschaftlich': 'planned economy', 'punkig': 'punk-like',
    'rentierlich': 'profitable', 'senatorisch': 'senatorial',
    'spitzig': 'pointed/spiky', 'zitronig': 'lemony',
    'münsterisch': 'of Munster', 'südsudanesisch': 'South Sudanese',
    'änderbar': 'changeable/modifiable',
    'gebetsmühlenartig': 'repetitive',
    'stichpunktartig': 'in bullet points',
    'stichwortartig': 'in keywords/briefly',
    'wesensmäßig': 'by nature/essentially',
    'gefühlsmäßig': 'emotional/instinctive',
    'geheimdienstlich': 'intelligence service',
    'gummiartig': 'rubbery', 'kirchengeschichtlich': 'church historical',
    'klägerisch': 'plaintiff (adj.)',
    'ideengeschichtlich': 'intellectual-historical',
    'kaleidoskopartig': 'kaleidoscopic', 'kostenmäßig': 'cost-wise',
    'literaturgeschichtlich': 'literary-historical',
    'sackartig': 'sack-shaped', 'säulenartig': 'columnar',
    'schaffbar': 'achievable', 'stoßartig': 'abrupt/jerky',
    'unterklassig': 'lower-class', 'urwaldartig': 'jungle-like',
    'weinig': 'vinous', 'weltmeisterlich': 'world-class',
    'abänderbar': 'amendable', 'abfragbar': 'queryable',
    'abwählbar': 'removable from office', 'abwischbar': 'wipeable',
    'achterlich': 'stern/aft', 'anteilmäßig': 'proportional',
    'arisch': 'Aryan', 'ballonartig': 'balloon-like',
    'breiig': 'mushy/pulpy', 'buckelig': 'hunchbacked/bumpy',
    'burisch': 'Boer', 'comicartig': 'comic-like',
    'dschungelartig': 'jungle-like', 'erpresserisch': 'extortionate',
    'etatmäßig': 'budgetary', 'farnartig': 'fern-like',
    'fünfeckig': 'pentagonal', 'geruchlich': 'olfactory',
    'geweihartig': 'antler-like', 'grünstichig': 'with a green tint',
    'halbkugelig': 'hemispherical', 'hallisch': 'of Halle',
    'herausziehbar': 'extractable', 'inschriftlich': 'inscriptional',
    'jesuitisch': 'Jesuit', 'kinematographisch': 'cinematographic',
    'knotenartig': 'nodular', 'kreditorisch': 'creditor-related',
    'kristallartig': 'crystalline', 'kuppelartig': 'dome-shaped',
    'lakritzartig': 'licorice-like', 'lawinenartig': 'avalanche-like',
    'lichtmikroskopisch': 'light-microscopic',
    'mantraartig': 'mantra-like/repetitive',
    'naturphilosophisch': 'natural philosophy',
    'ostseitig': 'east-facing',
    'papierartig': 'paper-like', 'pyramidenartig': 'pyramid-shaped',
    'reliefartig': 'relief-like/embossed',
    'röhrenartig': 'tubular', 'rückschrittlich': 'regressive/backward',
    'saalartig': 'hall-like', 'sängerisch': 'vocal/singing',
    'schlauchartig': 'tube-like', 'schlossartig': 'palatial',
    'schriftsprachlich': 'written language',
    'teerartig': 'tar-like', 'terrassenartig': 'terraced',
    'traumartig': 'dreamlike', 'unterteilbar': 'subdivisible',
    'vernehmbar': 'audible/perceptible', 'versetzbar': 'transferable',
    'volksfestartig': 'carnival-like/festive', 'wachsartig': 'waxy',
    'wallartig': 'rampart-like', 'wasserbaulich': 'hydraulic engineering',
    'wettkampfmäßig': 'competitive', 'wohlfahrtsstaatlich': 'welfare state',
    'zapfenartig': 'cone-shaped', 'zapotekisch': 'Zapotec',
    'zeltartig': 'tent-like', 'denkerisch': 'intellectual',
    'eremitisch': 'hermitic', 'förderbar': 'fundable',
    'greislich': 'senile', 'darstellbar': 'representable',
    'durchschaubar': 'transparent/obvious',
    'reproduzierbar': 'reproducible', 'wandelbar': 'changeable/versatile',
    'kalkulierbar': 'calculable', 'begreifbar': 'comprehensible',
    'belegbar': 'verifiable/documentable',
    'behandelbar': 'treatable', 'einsehbar': 'viewable/understandable',
    'faltbar': 'foldable', 'abschließbar': 'lockable',
    'verschiebbar': 'movable/shiftable', 'abbildbar': 'mappable',
    'abspielbar': 'playable', 'erfahrbar': 'experienceable',
    'ausleihbar': 'borrowable',
}

with open('data/adjectives.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

fixed = 0
for a in data['adjectives']:
    word = a['word']
    eng = a.get('english', '') or ''
    if word in FIXES and (not eng.strip() or is_garbage(eng)):
        a['english'] = FIXES[word]
        fixed += 1

still_garbage = sum(1 for a in data['adjectives'] if (a.get('english') or '').strip() and is_garbage(a.get('english', '')))
still_empty = sum(1 for a in data['adjectives'] if not (a.get('english') or '').strip())

print(f'Fixed {fixed} garbage translations')
print(f'Remaining: {still_empty} empty, {still_garbage} garbage')

with open('data/adjectives.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('Saved')
