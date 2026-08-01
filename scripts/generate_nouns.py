#!/usr/bin/env python3
"""
Generate enriched noun entries (ranks 5001-10000) from German-Words data,
matching the format and enrichment quality of the existing 5000 nouns.
"""

import json
import sys
import re
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')

# ── Load data ──────────────────────────────────────────────────────────────

with open('sources/German-Words/data/all.json', encoding='utf-8') as f:
    all_words = json.load(f)

with open('data/nouns.json', encoding='utf-8') as f:
    existing = json.load(f)

# Build a lookup of all known nouns for compound word translation fallback
all_nouns_by_lemma = {}
for w in all_words:
    if w['type'] == 'noun' and w['lemma'] not in all_nouns_by_lemma:
        all_nouns_by_lemma[w['lemma']] = w

existing_words = {n['word'] for n in existing['nouns']}

# ── Extract and rank nouns by frequency ────────────────────────────────────

nouns_raw = [w for w in all_words if w['type'] == 'noun' and w.get('frequency')]
nouns_raw.sort(key=lambda x: x['frequency'], reverse=True)

# Deduplicate by lemma (keep highest frequency)
seen = set()
unique_nouns = []
for n in nouns_raw:
    if n['lemma'] not in seen:
        seen.add(n['lemma'])
        unique_nouns.append(n)

print(f"Total unique nouns with frequency: {len(unique_nouns)}")

# ── Helper: detect plural pattern ──────────────────────────────────────────

def get_plural_form(noun_data):
    """Extract the nominative plural from cases."""
    cases = noun_data.get('cases', {})
    nom = cases.get('nominative', {})
    return nom.get('plural')

def get_article(gender):
    return {'m': 'der', 'f': 'die', 'n': 'das'}.get(gender, 'das')

def get_english(translations, lemma=''):
    en = translations.get('en', [])
    if en:
        # Take up to 3 translations, join with /
        return '/'.join(en[:3])
    # For compound nouns without translations, try to compose from parts
    if lemma and len(lemma) > 6:
        return try_compound_translation(lemma)
    return ''

def try_compound_translation(word):
    """Try to find translation by decomposing compound noun into parts."""
    # Try splitting at every position, find the best decomposition
    best_score = 0
    best_result = ''

    for split_pos in range(3, len(word) - 2):
        prefix_raw = word[:split_pos]
        suffix_raw = word[split_pos:]

        # Suffix must start with uppercase to be a valid German noun
        suffix_cap = suffix_raw[0].upper() + suffix_raw[1:]

        if suffix_cap not in all_nouns_by_lemma:
            continue

        suffix_data = all_nouns_by_lemma[suffix_cap]
        suffix_en = suffix_data.get('translations', {}).get('en', [])
        if not suffix_en:
            continue

        # Try to match prefix (strip linking elements: s, es, n, en, er, e, ns)
        prefix_candidates = [prefix_raw]
        for link in ['s', 'es', 'ns', 'en', 'er', 'n', 'e']:
            if prefix_raw.endswith(link) and len(prefix_raw) > len(link) + 2:
                prefix_candidates.append(prefix_raw[:-len(link)])

        prefix_trans = ''
        for pc in prefix_candidates:
            # Try exact match, then with -e suffix
            for try_word in [pc, pc + 'e', pc + 'E']:
                cap = try_word[0].upper() + try_word[1:] if try_word else ''
                if cap in all_nouns_by_lemma:
                    pen = all_nouns_by_lemma[cap].get('translations', {}).get('en', [])
                    if pen:
                        prefix_trans = pen[0]
                        break
            if prefix_trans:
                break

        # Score: prefer longer suffix matches, bonus for prefix match
        score = len(suffix_cap) + (20 if prefix_trans else 0)
        if score > best_score:
            best_score = score
            if prefix_trans:
                best_result = f"{prefix_trans} {suffix_en[0]}"
            else:
                best_result = suffix_en[0]

    return best_result

def syllable_count_approx(word):
    """Rough syllable count for German words."""
    vowels = 'aeiouäöüAEIOUÄÖÜ'
    count = 0
    prev_vowel = False
    for ch in word:
        if ch in vowels:
            if not prev_vowel:
                count += 1
            prev_vowel = True
        else:
            prev_vowel = False
    return max(1, count)

def has_umlaut_change(singular, plural):
    """Check if plural adds an umlaut compared to singular."""
    umlaut_map = {'a': 'ä', 'o': 'ö', 'u': 'ü', 'A': 'Ä', 'O': 'Ö', 'U': 'Ü'}
    if not singular or not plural:
        return False
    for s_ch, p_ch in zip(singular, plural):
        if s_ch in umlaut_map and p_ch == umlaut_map[s_ch]:
            return True
    return False

def is_weak_noun(noun_data):
    """Detect weak (n-Deklination) nouns."""
    if noun_data.get('gender') != 'm':
        return False
    cases = noun_data.get('cases', {})
    acc_sg = cases.get('accusative', {}).get('singular', '')
    dat_sg = cases.get('dative', {}).get('singular', '')
    gen_sg = cases.get('genitive', {}).get('singular', '')
    nom_sg = cases.get('nominative', {}).get('singular', '')
    if not nom_sg:
        return False
    # A strong genitive (-s) rules out n-Deklination — except the mixed
    # Name/Gedanke class whose genitive is nom + -ns (des Namens).
    if gen_sg and gen_sg.endswith('s') and gen_sg not in (nom_sg + 'ns', nom_sg + 'ens'):
        return False
    # Weak obliques must be exactly nom + -(e)n. Merely "ends in -n" misfires
    # when plural forms leak into the singular case slots (e.g. Mähroboter →
    # dative plural Mährobotern).
    weak_forms = {nom_sg + 'n', nom_sg + 'en'}
    return any(form in weak_forms for form in (acc_sg, dat_sg, gen_sg))

# ── Compound noun detection ────────────────────────────────────────────────

# Common final elements of compound nouns and their genders
COMPOUND_FINALS = {
    # Masculine
    'Platz': 'der', 'Punkt': 'der', 'Gang': 'der', 'Fall': 'der', 'Raum': 'der',
    'Markt': 'der', 'Hof': 'der', 'Schlag': 'der', 'Grund': 'der', 'Dienst': 'der',
    'Kampf': 'der', 'Schrank': 'der', 'Weg': 'der', 'Berg': 'der', 'Fluss': 'der',
    'Krieg': 'der', 'Preis': 'der', 'Rat': 'der', 'Schutz': 'der', 'Stoff': 'der',
    'Teil': 'der', 'Verband': 'der', 'Verein': 'der', 'Betrieb': 'der', 'Antrag': 'der',
    'Anspruch': 'der', 'Verkehr': 'der', 'Bereich': 'der', 'Bericht': 'der',
    'Wert': 'der', 'Erfolg': 'der', 'Anteil': 'der', 'Bedarf': 'der', 'Zugang': 'der',
    'Ausschuss': 'der', 'Ausgang': 'der', 'Eingang': 'der', 'Verlust': 'der',
    'Bezug': 'der', 'Zug': 'der', 'Baum': 'der', 'Flug': 'der', 'Vertrag': 'der',
    'Strom': 'der', 'Garten': 'der', 'Hafen': 'der', 'Laden': 'der', 'Verlag': 'der',
    'Tisch': 'der', 'Stuhl': 'der', 'Stock': 'der', 'Turm': 'der', 'Bau': 'der',
    # Feminine
    'Stelle': 'die', 'Kraft': 'die', 'Bahn': 'die', 'Straße': 'die', 'Schrift': 'die',
    'Arbeit': 'die', 'Schule': 'die', 'Pflicht': 'die', 'Stadt': 'die', 'Karte': 'die',
    'Wand': 'die', 'Seite': 'die', 'Zeit': 'die', 'Art': 'die', 'Form': 'die',
    'Hilfe': 'die', 'Lage': 'die', 'Fläche': 'die', 'Brücke': 'die', 'Kirche': 'die',
    'Küche': 'die', 'Grenze': 'die', 'Börse': 'die', 'Kasse': 'die', 'Klasse': 'die',
    'Liste': 'die', 'Masse': 'die', 'Presse': 'die', 'Szene': 'die', 'Anlage': 'die',
    'Ausgabe': 'die', 'Aufgabe': 'die', 'Angabe': 'die', 'Sache': 'die', 'Sprache': 'die',
    'Woche': 'die', 'Nacht': 'die', 'Macht': 'die', 'Pflege': 'die',
    # Neuter
    'Haus': 'das', 'Werk': 'das', 'Stück': 'das', 'Bild': 'das', 'Zeug': 'das',
    'Rad': 'das', 'Tier': 'das', 'Buch': 'das', 'Amt': 'das', 'Recht': 'das',
    'Geld': 'das', 'Feld': 'das', 'Spiel': 'das', 'Netz': 'das', 'Ziel': 'das',
    'Licht': 'das', 'Jahr': 'das', 'Land': 'das', 'Wort': 'das', 'Blatt': 'das',
    'Mittel': 'das', 'System': 'das', 'Modell': 'das', 'Konzept': 'das',
    'Heim': 'das', 'Gut': 'das', 'Bad': 'das', 'Band': 'das', 'Gebiet': 'das',
}

def detect_compound_final(word, gender):
    """Try to find a known compound final element, or dynamically from all_nouns_by_lemma."""
    if len(word) < 6:
        return None
    # First check static list
    for final, art in sorted(COMPOUND_FINALS.items(), key=lambda x: -len(x[0])):
        if word.endswith(final) and len(word) > len(final) + 1:
            return final
    # Dynamic: try to find the longest matching final noun in the dictionary
    best = None
    for length in range(len(word) - 3, 2, -1):
        candidate = word[-length:]
        # Must start with uppercase (German noun)
        if not candidate[0].isupper():
            candidate = candidate[0].upper() + candidate[1:]
        if candidate in all_nouns_by_lemma and candidate != word:
            nd = all_nouns_by_lemma[candidate]
            nd_gender = nd.get('gender', '')
            nd_article = get_article(nd_gender)
            if nd_gender == gender:  # Only match if gender agrees (confirms compound)
                best = candidate
                break
    return best

# ── articleHelp generation ─────────────────────────────────────────────────

def generate_article_help(noun_data):
    word = noun_data['lemma']
    gender = noun_data.get('gender', '')
    article = get_article(gender)
    weak = is_weak_noun(noun_data)
    hints = []

    lower = word.lower()
    syllables = syllable_count_approx(word)

    articleless_countries = {'Deutschland', 'Österreich', 'Luxemburg', 'Europa', 'Griechenland', 'Finnland', 'Mexiko'}
    article_countries_die = {'Schweiz', 'Türkei', 'Ukraine'}

    if noun_data.get('pluralOnly', False):
        return "Plural-only noun (Pluralia tantum). It has no singular form and always uses die."

    if word in articleless_countries:
        return "Country and region names like Deutschland, Finnland, Mexiko, and Europa are normally used without an article. When an article is required, they are neuter: das Deutschland der 1990er."

    if word in article_countries_die:
        return "Some country names are used with a fixed article. Feminine examples take die: die Türkei, die Schweiz, die Ukraine."

    # Check compound noun first
    compound_final = detect_compound_final(word, gender)
    if compound_final:
        final_article = COMPOUND_FINALS.get(compound_final, get_article(all_nouns_by_lemma.get(compound_final, {}).get('gender', '')))
        hints.append(f"Compound noun — gender follows the last element: {compound_final} ({final_article}). This is the #1 rule in German: always look at the final component.")

    # Suffix rules (100% reliable)
    if lower.endswith('ung'):
        hints.append("Suffix rule: -ung → always die. Zero exceptions. One of the first rules to learn.")
    elif lower.endswith('keit'):
        hints.append("Suffix rule: -keit → always die. Variant of -heit (used after -ig, -lich, -bar, -sam). No exceptions.")
    elif lower.endswith('heit'):
        hints.append("Suffix rule: -heit → always die. Abstract quality nouns from adjectives/nouns. No exceptions.")
    elif lower.endswith('schaft'):
        hints.append("Suffix rule: -schaft → always die. Collective/abstract nouns. No exceptions. Think: Mannschaft, Gesellschaft, Wirtschaft.")
    elif lower.endswith('tion'):
        hints.append("Suffix rule: -tion → always die. Latin-origin. Stress on last syllable: NaTION, SituaTION. No exceptions.")
    elif lower.endswith('sion'):
        hints.append("Suffix rule: -sion → always die. Same Latin pattern as -tion. E.g. Diskussion, Explosion.")
    elif lower.endswith('tät'):
        hints.append("Suffix rule: -tät → always die. From Latin -tās. E.g. Universität, Qualität, Realität.")
    elif lower.endswith('ismus'):
        hints.append("Suffix rule: -ismus → always der. All -ismus words (ideologies, movements, conditions) are masculine.")
    elif lower.endswith('ling'):
        hints.append("Suffix rule: -ling → always der. E.g. Frühling, Flüchtling, Schmetterling, Lehrling, Säugling.")
    elif lower.endswith('chen'):
        hints.append("Suffix rule: -chen (diminutive) → always das. Overrides the base noun's gender. das Mädchen (from die Magd), das Brötchen (from das Brot).")
    elif lower.endswith('lein'):
        hints.append("Suffix rule: -lein (diminutive) → always das. Like -chen, overrides base gender. das Büchlein (from das Buch), das Fräulein.")
    elif lower.endswith('erei'):
        hints.append("Suffix rule: -erei → always die. Denotes repeated action or a place. E.g. Bäckerei, Bücherei.")
    elif lower.endswith('ei') and not lower.endswith('erei'):
        if gender == 'f':
            hints.append("Suffix pattern: -ei → usually die. E.g. Polizei, Partei, Türkei.")

    # Strong suffix patterns (very reliable, not 100%)
    elif lower.endswith('enz'):
        hints.append("Suffix rule: -enz → die. Latin origin, very reliable. E.g. Konkurrenz, Konferenz, Differenz.")
    elif lower.endswith('anz'):
        hints.append("Suffix rule: -anz → die. Latin origin, reliable. E.g. Toleranz, Distanz, Substanz.")
    elif lower.endswith('ik') and not lower.endswith('stik'):
        hints.append("Suffix pattern: -ik → usually die. E.g. Musik, Kritik, Logik, Technik, Fabrik, Statistik.")
    elif lower.endswith('stik'):
        hints.append("Suffix pattern: -ik → usually die. E.g. Musik, Kritik, Logik, Technik, Fabrik, Statistik.")
    elif lower.endswith('ur') and syllables >= 2:
        if gender == 'f':
            hints.append("Suffix pattern: -ur → usually die (Latin origin). E.g. Natur, Kultur, Struktur, Temperatur.")
    elif lower.endswith('ie') and syllables >= 2:
        if gender == 'f':
            hints.append("Suffix pattern: Stressed -ie → usually die (French/Latin origin). E.g. Energie, Philosophie, Therapie, Industrie.")
    elif lower.endswith('ment') and syllables >= 2:
        if gender == 'n':
            hints.append("Suffix pattern: -ment → usually das (Latin). E.g. Dokument, Instrument, Medikament. Careful: der Moment (point in time) is masculine!")
        elif gender == 'm':
            hints.append("Exception: -ment is usually das, but der Moment is the famous exception.")
    elif lower.endswith('um') and syllables >= 2:
        if gender == 'n':
            hints.append("Suffix pattern: -um (Latin/Greek) → usually das. E.g. Museum, Studium, Datum, Zentrum, Publikum.")
    elif lower.endswith('nis'):
        if gender == 'n':
            hints.append("Suffix pattern: -nis → often das (Ergebnis, Verständnis, Gefängnis, Geheimnis). But ~20% are die (Erkenntnis, Erlaubnis, Finsternis) — check each one.")
        elif gender == 'f':
            hints.append("Exception: Most -nis nouns are das, but this one is die. The feminine -nis words (Erkenntnis, Erlaubnis, Kenntnis, Finsternis, Besorgnis) must simply be memorized.")
    elif lower.endswith('or') and syllables >= 2:
        if gender == 'm':
            hints.append("Suffix pattern: -or → usually der (Latin agent noun). E.g. Motor, Autor, Professor, Doktor. Plural shifts stress: Motóren, Autóren.")
    elif lower.endswith('ist') and not lower.endswith(('geist', 'mist', 'zwist', 'twist')):
        # Stem words (Geist, Mist, Zwist, Twist) are not the -ist suffix.
        if gender == 'm':
            hint = "Suffix pattern: -ist → usually der (denotes a person). E.g. Optimist, Journalist, Polizist."
            if weak:
                hint += " Also a weak noun (n-Deklination)."
            hints.append(hint)
    elif lower.endswith('ent') and syllables >= 2:
        if gender == 'm':
            if weak:
                hints.append("Suffix pattern: -ent → usually der (Latin). Often a weak noun. E.g. Student→Studenten, Präsident→Präsidenten, Patient→Patienten.")
            else:
                hints.append("Suffix pattern: -ent → usually der (Latin). But unlike the -ent person nouns (Student, Präsident, Patient — which are weak nouns), this word declines strong (genitive -s).")
    elif lower.endswith('ant') and syllables >= 2:
        if gender == 'm':
            if weak:
                hints.append("Suffix pattern: -ant → usually der (Latin). Often also a weak noun. E.g. Elefant→Elefanten, Kandidat→Kandidaten.")
            else:
                hints.append("Suffix pattern: -ant → usually der (Latin). But unlike the -ant person/weak nouns (Elefant, Kandidat), this word declines strong (genitive -s).")

    # Loanword patterns
    elif lower.endswith('age') and syllables >= 2:
        if gender == 'f':
            hints.append("Loanword pattern: -age (French) → die. E.g. Garage, Etage, Massage, Passage.")
    elif lower.endswith('ette'):
        if gender == 'f':
            hints.append("Loanword pattern: -ette (French) → die. E.g. Tablette, Marionette, Kassette.")
    elif lower.endswith('ade'):
        if gender == 'f':
            hints.append("Loanword pattern: -ade (French) → die. E.g. Fassade, Marmelade, Parade, Limonade.")
    elif lower.endswith('eur'):
        if gender == 'm':
            hints.append("Loanword pattern: -eur (French) → der. E.g. Ingenieur, Friseur, Regisseur. Person nouns from French.")

    # Morphological patterns
    if word.startswith('Ge') and not any(word.startswith(p) for p in ['Gegen', 'Gesund', 'Gesell', 'Gesetz', 'Geschw']):
        if gender == 'n' and not hints:
            hints.append("Morphological: Ge- prefix → often das. This prefix creates collective or result nouns: Gebiet, Gesetz, Gehirn, Gewicht, Gespräch, Gebirge, Getränk, Geschenk. Strong pattern with few exceptions (der Gedanke, der Gebrauch, die Gefahr, die Geschichte).")
        elif gender == 'm' and not hints:
            hints.append("Exception: Most Ge- nouns are das, but this one is der. Notable masculine Ge- exceptions: der Gedanke, der Gebrauch, der Gehalt, der Genuss, der Geruch, der Geschmack, der Gewinn.")
        elif gender == 'f' and not hints:
            hints.append("Exception: Most Ge- nouns are das, but this one is die. Notable feminine Ge- exceptions: die Gefahr, die Geburt, die Geduld, die Gemeinde, die Geschichte, die Gestalt, die Gewalt.")

    # Nominalized infinitive
    if lower.endswith('en') and gender == 'n' and not hints:
        # Check if it could be a nominalized infinitive
        if word[0].isupper() and syllables >= 2:
            # Heuristic: if it ends in -en and is neuter, likely nominalized infinitive
            hints.append("Morphological: Nominalized infinitive → always das. Any German verb can be used as a noun (capitalize it), and it's always neuter. das Leben (to live → life), das Essen (to eat → food).")

    # -er ending
    if lower.endswith('er') and syllables >= 2 and not hints:
        if gender == 'm':
            if lower.endswith('ler') or lower.endswith('ner') or lower.endswith('rer') or lower.endswith('zer'):
                hints.append("Agent noun pattern: -er (person/thing that does X) → usually der. This is one of the most productive German suffixes. der Lehrer (one who teaches), der Fahrer (one who drives). Even tools/machines follow this: der Computer, der Fernseher.")
            else:
                hints.append("Pattern: -er ending → usually der. Covers agents, tools, instruments, and many other categories. But beware: das Fenster, das Wasser, das Messer, das Feuer, das Zimmer are common neuter exceptions.")
        elif gender == 'n':
            hints.append("Exception: Most -er nouns are der, but this one is das. The common neuter -er nouns (Fenster, Wasser, Messer, Feuer, Zimmer, Leder, Futter, Wetter) are among the most frequent words in German — they must simply be memorized.")

    # -e ending
    if lower.endswith('e') and not lower.endswith('keit') and not lower.endswith('heit') and not lower.endswith('sche') and not hints:
        if gender == 'f':
            hints.append("Ending pattern: ~90% of nouns ending in -e are die. This is one of the strongest gender-guessing heuristics in German. When in doubt on an -e noun, guess die.")
        elif gender == 'm':
            hints.append("Exception: ~90% of -e nouns are die, but this is der. Masculine -e nouns are rare and mostly 'weak nouns' (n-Deklination). Worth memorizing as a set.")
        elif gender == 'n':
            hints.append("Rare exception: ~90% of -e nouns are die, but this is das. Very few -e nouns are neuter: das Ende, das Auge, das Erbe, das Interesse, das Gebäude. Memorize these individually.")

    # Feminine -in suffix (person nouns)
    if lower.endswith('in') and gender == 'f' and not lower.endswith(('tion', 'sion', 'izin')) and syllables >= 2 and not hints:
        if lower.endswith('erin') or lower.endswith('ärin'):
            hints.append("Suffix pattern: -erin → always die. Feminine form of masculine agent nouns (-er → -erin). E.g. Lehrerin, Fahrerin.")
        else:
            hints.append("Suffix pattern: -in (feminine person noun) → always die. Marks the feminine form of a masculine noun. E.g. Ärztin, Freundin, Köchin, Studentin. Plural always -innen.")

    # Weak noun warning
    if weak:
        hints.append("⚠ Weak noun (n-Deklination): This noun takes -(e)n in ALL cases except nominative singular. den Menschen, dem Menschen, des Menschen. Recognizing weak nouns is crucial for correct case usage beyond just the article.")

    # Fallback for monosyllabic
    if not hints and syllables == 1:
        if gender == 'm':
            hints.append("Short/monosyllabic noun — no suffix or semantic rule applies. Statistically, ~60% of monosyllabic German nouns are der, ~25% das, ~15% die. But that's a gamble, not a rule. Best memorized in a phrase: 'der Hund bellt', 'der Weg ist lang'.")
        elif gender == 'n':
            hints.append("Short/monosyllabic noun — no suffix or semantic rule applies. Short neuter nouns are less common (~25% of monosyllables). Many short das-nouns form -er plurals (Buch→Bücher, Kind→Kinder, Haus→Häuser). Memorize in context.")
        elif gender == 'f':
            hints.append("Short/monosyllabic noun — no suffix or semantic rule applies. Short feminine nouns are the rarest monosyllables (~15%). Many form plurals with umlaut + -e (Hand→Hände, Nacht→Nächte, Stadt→Städte).")

    # Generic fallback
    if not hints:
        if gender == 'm':
            hints.append("No standard suffix, semantic, or morphological rule applies cleanly. Masculine gender must be memorized. Tip: associate it with a vivid image or phrase to anchor the article.")
        elif gender == 'f':
            hints.append("No standard suffix, semantic, or morphological rule applies cleanly. Feminine gender must be memorized. Tip: learn it in a short phrase — contextual memory is stronger than isolated flashcards.")
        elif gender == 'n':
            hints.append("No standard suffix, semantic, or morphological rule applies cleanly. Neuter gender must be memorized. Tip: learn it as a chunk — 'das Ziel erreichen', not just 'das Ziel'.")

    return ' · '.join(hints)


# ── pluralHelp generation ──────────────────────────────────────────────────

def generate_plural_help(noun_data):
    word = noun_data['lemma']
    gender = noun_data.get('gender', '')
    article = get_article(gender)
    plural = get_plural_form(noun_data)
    singular_only = noun_data.get('singularOnly', False)
    plural_only = noun_data.get('pluralOnly', False)

    if singular_only or not plural:
        return "This noun is singular only (Singularetantum) — it has no plural form. Common for abstract concepts, materials, and collective nouns."

    if plural_only:
        return f"This noun is plural only (Pluraletantum) — it has no singular form. Die {plural}. Similar to English 'scissors' or 'pants'."

    umlaut = has_umlaut_change(word, plural)

    # Determine the plural pattern
    if plural == word:
        # No change
        return f"No change (die {plural}). Rule: Masculine and neuter nouns ending in -er, -el, -en usually keep the same plural form. Some add an umlaut (Vater→Väter), but many don't (Wagen→Wagen)."

    # Check suffix added
    lower_word = word.lower()
    lower_plural = plural.lower()

    # -n (nouns ending in -e add -n)
    if lower_word.endswith('e') and plural == word + 'n':
        if gender == 'f':
            return f"+n (die {plural}). Rule: Nouns ending in -e simply add -n. Extremely consistent for feminine nouns (Straße→Straßen, Lampe→Lampen, Schule→Schulen). Also applies to masculine weak nouns ending in -e (Kollege→Kollegen, Löwe→Löwen)."
        elif gender == 'm':
            return f"+n (die {plural}). Rule: Masculine nouns ending in -e that add -n are usually weak nouns (n-Deklination). E.g. Kollege→Kollegen, Junge→Jungen, Löwe→Löwen."
        else:
            return f"+n (die {plural}). Rule: Nouns ending in -e simply add -n. Extremely consistent for feminine nouns (Straße→Straßen, Lampe→Lampen, Schule→Schulen)."

    # +nen (feminine -in nouns)
    if lower_word.endswith('in') and plural == word + 'nen':
        return f"+nen (die {plural}). Rule: Feminine person nouns ending in -in double the n: Königin→Königinnen, Lehrerin→Lehrerinnen, Ärztin→Ärztinnen. 100% consistent."

    # -s plural (loanwords)
    if plural == word + 's':
        return f"+s (die {plural}). Rule: The -s plural is used for recent loanwords (Auto→Autos, Kino→Kinos) and nouns ending in vowels other than -e (Sofa→Sofas, Radio→Radios). This is the newest plural pattern in German, borrowed from French/English."

    # -(e)n plural
    if plural.endswith('en') and not word.endswith('en'):
        if gender == 'f':
            return f"-(e)n (die {plural}). Rule: The most common feminine plural. Nearly all die-nouns that don't end in -e take -(e)n: Frau→Frauen, Tür→Türen, Uhr→Uhren, Zahl→Zahlen. Exceptions to the usual -e → -n pattern are mainly recent loanwords, which often take -s: die Homepage→Homepages, die Website→Websites, die Performance→Performances, die Challenge→Challenges, die Lounge→Lounges."
        elif gender == 'm':
            return f"-(e)n (die {plural}). Some masculine nouns take -(e)n plural, especially weak nouns (n-Deklination). E.g. Mensch→Menschen, Staat→Staaten, Typ→Typen."
        else:
            return f"-(e)n (die {plural}). Less common for neuter nouns, but occurs with Latin/Greek-origin words. E.g. Auge→Augen, Ohr→Ohren, Interesse→Interessen."

    # -er plural (with or without umlaut)
    if plural.endswith('er') and not word.endswith('er'):
        if umlaut:
            return f"-er + umlaut (die {plural}). Rule: The -er plural with umlaut is a signature neuter pattern. E.g. Buch→Bücher, Haus→Häuser, Wald→Wälder. Almost exclusive to das-nouns, with a few der-exceptions (Mann→Männer)."
        else:
            return f"-er (die {plural}). Rule: The -er plural is the signature neuter pattern for short nouns. E.g. Kind→Kinder, Buch→Bücher, Haus→Häuser, Bild→Bilder. Almost always adds umlaut if possible."

    # -e plural (with or without umlaut)
    if plural.endswith('e') and not word.endswith('e'):
        if umlaut:
            if gender == 'f':
                return f"-e + umlaut (die {plural}). Feminine nouns with -e plural are less common but important. They almost always umlaut: Hand→Hände, Nacht→Nächte, Stadt→Städte, Kraft→Kräfte, Wand→Wände."
            elif gender == 'm':
                return f"-e + umlaut (die {plural}). Rule: Many masculine monosyllabic nouns take -e with umlaut: Stuhl→Stühle, Kopf→Köpfe, Arzt→Ärzte, Sohn→Söhne. One of the most common masculine plural patterns."
            else:
                return f"-e + umlaut (die {plural}). Unusual for neuter nouns — das Floß→Flöße is one of the rare examples. Most neuter -e plurals do NOT umlaut."
        else:
            if gender == 'm':
                return f"-e (die {plural}). Rule: The default masculine plural. Monosyllabic der-nouns very often take -e, frequently with umlaut: Tag→Tage, Stuhl→Stühle, Kopf→Köpfe, Hund→Hunde."
            elif gender == 'n':
                return f"-e (die {plural}). Rule: Some neuter nouns take -e, usually WITHOUT umlaut: Jahr→Jahre, Spiel→Spiele, Ziel→Ziele, Tier→Tiere. Neuter -e plurals rarely umlaut (exception: das Floß→Flöße)."
            else:
                return f"-e (die {plural}). Less common for feminine nouns. Most feminine -e plurals also umlaut (Stadt→Städte), but a few don't."

    # Irregular / Latin-Greek plurals (e.g. Thema→Themen, Datum→Daten, Lexikon→Lexika)
    if lower_word.endswith('um') and lower_plural.endswith('en'):
        return f"Latin plural: {word}→{plural}. Latin/Greek-origin words often have irregular plurals. The -um → -en shift is common: Datum→Daten, Museum→Museen, Zentrum→Zentren."

    if lower_word.endswith('on') and lower_plural.endswith('en'):
        return f"Latin/Greek plural: {word}→{plural}. Words ending in -on often shift to -en in plural: Lexikon→Lexiken, Stadion→Stadien."

    if lower_word.endswith('a') and lower_plural.endswith('en'):
        return f"Latin plural: {word}→{plural}. Latin/Greek words ending in -a often form plural with -en: Thema→Themen, Firma→Firmen, Komma→Kommata/Kommas."

    # Umlaut only (no suffix change visible)
    if umlaut and len(plural) == len(word):
        if gender == 'm':
            return f"Umlaut only (die {plural}). Some masculine/neuter nouns in -er, -el, -en add only an umlaut: Vater→Väter, Bruder→Brüder, Apfel→Äpfel."
        else:
            return f"Umlaut only (die {plural}). Rare pattern where only the stem vowel changes. E.g. Mutter→Mütter, Tochter→Töchter."

    # Generic fallback
    return f"die {plural}. Irregular or mixed plural pattern. Best memorized directly."

if __name__ == "__main__":
    # ── Main generation ────────────────────────────────────────────────────────

    # Take nouns ranked 5001-25000
    new_nouns = unique_nouns[5000:25000]

    print(f"Generating {len(new_nouns)} new noun entries (ranks 5001-25000)...")

    new_entries = []
    for i, noun_data in enumerate(new_nouns):
        rank = 5001 + i
        word = noun_data['lemma']
        gender = noun_data.get('gender', '')
        article = 'die' if noun_data.get('pluralOnly', False) and not gender else get_article(gender)
        plural = get_plural_form(noun_data)
        english = get_english(noun_data.get('translations', {}), word)

        if noun_data.get('singularOnly', False):
            plural_str = None
        elif noun_data.get('pluralOnly', False):
            plural_str = plural or word
        else:
            plural_str = plural

        entry = {
            "word": word,
            "article": article,
            "plural": plural_str,
            "english": english,
            "rank": rank,
            "articleHelp": generate_article_help(noun_data),
            "pluralHelp": generate_plural_help(noun_data),
        }
        new_entries.append(entry)

    # Merge with existing (only the original 5000)
    existing_5000 = [n for n in existing['nouns'] if n['rank'] <= 5000]
    all_nouns = existing_5000 + new_entries

    output = {
        "meta": {
            "version": 2,
            "source": "Leipzig Web-public Germany 2019 1M Corpus via German-Words repo",
            "count": len(all_nouns),
            "generatedAt": datetime.now(timezone.utc).isoformat()
        },
        "nouns": all_nouns
    }

    with open('data/nouns.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Done! Written {len(all_nouns)} nouns to data/nouns.json")
    print(f"  Existing: {len(existing['nouns'])}")
    print(f"  New: {len(new_entries)}")
    print(f"  Sample new entry:")
    print(json.dumps(new_entries[0], ensure_ascii=False, indent=2))
    print(f"  ...")
    print(json.dumps(new_entries[2499], ensure_ascii=False, indent=2))
    print(f"  ...")
    print(json.dumps(new_entries[-1], ensure_ascii=False, indent=2))
