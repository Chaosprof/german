#!/usr/bin/env python3
"""
Fix machine-translated noun glosses where the wrong sense of a head morpheme
was chosen (e.g., Steuer→"controls" instead of "tax", Fach→"compartment"
instead of "subject/specialty", -kosten→"at the expense of" instead of "costs").

Translations were verified against Wiktionary/dict.cc/Duden where ambiguous.
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
NOUNS = ROOT / 'data' / 'nouns.json'

# Targeted fixes — keyed by exact German word.
# Translations chosen for compactness + accuracy, matching the dataset's house
# style of slash-separated sense glosses.
FIXES = {
    # --- "at the expense of" group (-kosten compounds + Kosten- prefixes) ---
    'Personalkosten':       'personnel costs / staff costs',
    'Kostenerstattung':     'cost reimbursement',
    'Stromkosten':          'electricity costs / power costs',
    'Verwaltungskosten':    'administrative costs',
    'Sachkosten':           'material costs / overhead costs',
    'Materialkosten':       'material costs',
    'Behandlungskosten':    'treatment costs / medical costs',
    'Kostendruck':          'cost pressure',
    'Kostenfalle':          'cost trap',
    'Kostensteigerung':     'cost increase',
    'Lohnkosten':           'wage costs / labour costs',
    'Transportkosten':      'transport costs / shipping costs',
    'Mietkosten':           'rental costs',
    'Umzugskosten':         'moving costs / relocation costs',
    'Kostensenkung':        'cost reduction / cost cutting',
    'Portokosten':          'postage costs',
    'Fixkosten':            'fixed costs',
    'Prozesskosten':        'court costs / litigation costs',
    'Kostenrechnung':       'cost accounting',
    'Verfahrenskosten':     'procedural costs / legal costs',
    'Herstellkosten':       'production costs / manufacturing costs',
    'Kostenreduktion':      'cost reduction',
    'Druckkosten':          'printing costs',
    'Kostenentwicklung':    'cost trend / cost development',
    'Bestattungskosten':    'funeral costs / burial costs',
    'Kostenexplosion':      'cost explosion / surge in costs',
    'Kostenkalkulation':    'cost calculation / costing',

    # --- "compartment" group (Fach-/Abteilung when meaning specialty/subject) ---
    # Note: das Fach itself can mean compartment/drawer or subject/specialty —
    # current gloss "subject/compartment" already captures both. Leaving alone.
    'Fachkenntnis':         'specialist knowledge / expertise',
    'Fachlehrer':           'subject teacher / specialist teacher',
    'Fachoberschule':       'specialized upper secondary school (FOS)',
    'Fachpublikum':         'specialist audience / professional audience',
    'Fachmagazin':          'trade magazine / specialist magazine',
    'Fachunterricht':       'subject classes / specialized instruction',
    'Fachartikel':          'specialist article / trade article',
    'Fachbuch':             'specialist book / reference book / textbook',
    'Fachwirt':             'certified specialist / business administrator',
    'Wahlpflichtfach':      'compulsory elective subject',
    'Rechtsabteilung':      'legal department',
    'Fachwelt':             'professional community / experts in the field',
    'Fachpresse':           'trade press / specialist press',
    'Fachlehrerin':         'subject teacher (female)',
    'Pflichtfach':          'compulsory subject / required subject',
    'Fachbibliothek':       'specialist library / academic library',
    'Fachwissenschaft':     'specialist discipline / academic field',
    'Gefrierfach':          'freezer compartment',
    'Fachabitur':           'vocational university-entrance qualification',
    'Fachjournal':          'trade journal / specialist journal',
    'Finanzabteilung':      'finance department',
    # 'Abteil' already correctly "compartment/section" — leave
    'Fachanwältin':         'specialist lawyer (female)',
    'Lieblingsfach':        'favourite subject',
    'Eisfach':              'freezer compartment / ice box',
    'Fachterminus':         'technical term / specialist term',
    'Fachwissenschaftler':  'subject specialist / academic expert',
    'Fachtext':             'specialist text / technical text',
    'Fachvertreter':        'specialist representative',
    'Fachwirtin':           'certified specialist (female)',
    'Fachwortschatz':       'specialist vocabulary / technical vocabulary',

    # --- "controls" group (Steuer-/-steuer compounds; Steuer = tax) ---
    'Gewerbesteuer':        'trade tax / business tax',
    'Steuereinnahme':       'tax revenue',
    'Steuerklasse':         'tax bracket / tax class',
    'Einkommenssteuer':     'income tax',
    'Steuernummer':         'tax number',
    'Steuerbefreiung':      'tax exemption',
    'Erbschaftsteuer':      'inheritance tax / estate tax',
    'Abgeltungssteuer':     'withholding tax / flat-rate capital-gains tax',
    'Steuerentlastung':     'tax relief',
    'Abgeltungsteuer':      'withholding tax / flat-rate capital-gains tax',
    'Steueridentifikationsnummer': 'tax identification number',
    'Steuerzahlung':        'tax payment',
    'Vermögensteuer':       'wealth tax',
    'Kraftfahrzeugsteuer':  'motor vehicle tax',
    'Steuerbetrag':         'tax amount',

    # --- Specific egregious errors flagged in review ---
    'Navigationssystem':    'navigation system',
    'Problemlösung':        'solution / problem-solving',
    'Strafverfahren':       'criminal proceedings',
    'Testergebnis':         'test result',
    'Versicherungssumme':   'sum insured / coverage amount',
    'Ärztekammer':          'medical association / chamber of physicians',
    'Kreishaus':            'district administrative building',
    'Ortsgruppe':           'local branch / local chapter',
    'Verbleib':             'whereabouts / disposition',
    'Klarstellung':         'clarification',
    'Lehrjahr':             'apprenticeship year',
    'Lernzeit':             'study time / learning period',
    'Liegewiese':           'sunbathing lawn',
    'Menschenbild':         'view of humanity / image of humankind',
    'Fertigungsverfahren':  'manufacturing process / production process',
    'Finanzlage':           'financial situation',
    'Naturereignis':        'natural event / natural phenomenon',
    'Steilvorlage':         'perfect setup / open invitation (sports)',
    'Pflichtfach':          'compulsory subject',
    'Fachgebiet':           'specialty / area of expertise',  # if present
    'Aufsteiger':           'climber / promoted team / upwardly mobile person',
    'Pflanzgut':            'planting material',  # if present
    'Strafverteidiger':     'criminal defence lawyer',  # if present

    # --- Other clearly-wrong glosses spotted ---
    'Beihilfe':             'aiding and abetting / subsidy / benefit',
    'Kinderspiel':          "child's play / piece of cake",
    'Maul':                 'mouth / muzzle / snout (of an animal)',
    'Nassfutter':           'wet pet food',
}


def main():
    nd = json.loads(NOUNS.read_text(encoding='utf-8'))
    nouns = nd['nouns']
    by_word = {n['word']: n for n in nouns}

    applied = 0
    skipped_missing = []
    for word, en in FIXES.items():
        n = by_word.get(word)
        if not n:
            skipped_missing.append(word)
            continue
        if n.get('english') != en:
            old = n.get('english', '')
            n['english'] = en
            print(f"  rank={n['rank']:>5}: {n['article']} {word:<32} '{old[:55]}' → '{en[:55]}'")
            applied += 1

    NOUNS.write_text(json.dumps(nd, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"\nApplied {applied} translation fixes")
    if skipped_missing:
        print(f"Not found in dataset (skipped): {', '.join(skipped_missing)}")


if __name__ == '__main__':
    main()
