#!/usr/bin/env python3
"""Fix withSein field for irregular verbs that use 'sein' in Perfekt."""
import json

# Verbs that use "sein" in Perfekt:
# 1. Motion verbs (movement from A to B)
# 2. Change of state verbs
# 3. sein, bleiben, werden, geschehen, passieren, gelingen, etc.
SEIN_VERBS = {
    # Core sein verbs
    'sein', 'werden', 'bleiben',
    # Motion verbs
    'gehen', 'kommen', 'fahren', 'fliegen', 'laufen', 'reisen', 'rennen',
    'schwimmen', 'reiten', 'springen', 'treten', 'fallen', 'steigen',
    'sinken', 'gleiten', 'kriechen', 'schreiten', 'wandern',
    # Change of state
    'sterben', 'wachsen', 'entstehen', 'erscheinen', 'verschwinden',
    'aufwachen', 'einschlafen', 'erkranken', 'genesen', 'verblühen',
    'schrumpfen', 'schmelzen', 'gefrieren', 'erfrieren', 'verdorren',
    'vertrocknen', 'verfaulen', 'verrotten', 'platzen', 'zerbrechen',
    'explodieren', 'implodieren',
    # Happening/succeeding
    'geschehen', 'passieren', 'gelingen', 'misslingen', 'scheitern',
    'stattfinden', 'vorkommen', 'vorfallen', 'untergehen',
    # Prefixed motion verbs
    'ankommen', 'abfahren', 'ausgehen', 'eingehen', 'aufgehen',
    'zurückkehren', 'zurückkommen', 'zurückgehen', 'zurückfahren',
    'herkommen', 'hingehen', 'hinfahren', 'mitfahren', 'mitkommen',
    'mitgehen', 'vorbeikommen', 'vorbeigehen', 'vorbeifahren',
    'eintreten', 'austreten', 'auftreten', 'betreten',
    'einsteigen', 'aussteigen', 'aufsteigen', 'absteigen', 'umsteigen',
    'aufstehen', 'aufwachsen',
    'losfahren', 'losgehen', 'loslaufen', 'losrennen',
    'wegfahren', 'weggehen', 'weglaufen', 'wegrennen', 'wegfliegen',
    'wegziehen',
    'herausfinden', 'herauskommen', 'herausgehen', 'herausfliegen',
    'hereinkommen', 'hereingehen',
    'hinausgehen', 'hinausfahren',
    'herunterkommen', 'herunterfallen',
    'aufbrechen', 'einbrechen', 'ausbrechen', 'durchbrechen', 'zerbrechen',
    'aufkommen', 'unterkommen', 'nachkommen', 'entgegenkommen',
    'davonlaufen', 'davonrennen',
    'entkommen', 'entfliehen', 'entlaufen', 'entgleiten', 'entgleisen',
    'fliehen', 'flüchten',
    'verreisen', 'einreisen', 'ausreisen', 'anreisen', 'abreisen',
    'zureisen',
    'zufahren', 'zufahren',
    'anlaufen', 'auslaufen', 'einlaufen', 'ablaufen',
    'auffliegen', 'abfliegen', 'einfliegen', 'weiterfliegen',
    'schwarzfahren', 'vortreten',
    'nachfahren', 'durchfahren',
    'eintreffen',
    'antreten',
    'vorangehen', 'voranschreiten', 'vorankommen',
    'fortschreiten', 'fortfahren',
    'hervortreten', 'hervorgehen',
    'herantreten', 'herankommen',
    'umlaufen', 'weglaufen', 'zerlaufen',
    'schieflaufen', 'weiterlaufen',
    'nachgehen', 'entgegengehen',
    'zugehen',
    'weiterfahren', 'weiterreisen', 'weitergehen',
    'rausfliegen',
    'zusammenkommen', 'zusammenlaufen',
    'niedergehen',
    # Change of state with prefixes
    'aufwachen', 'erwachen',
    'einschlafen',
    'versterben', 'umkommen', 'ertrinken',
    'abstürzen', 'einstürzen', 'zusammenbrechen',
    'auftauchen', 'untertauchen',
    'abhauen', 'durchbrennen',
    'ansteigen', 'absinken',
    'zunehmen',  # actually hat
    'eintrocknen',
    'erblühen', 'aufblühen',
    'gerinnen', 'erstarren',
    'aussterben',
    'einfrieren', 'auftauen',
    'verdunsten', 'verdampfen',
    'anlaufen', 'einlaufen',
    'anwachsen',
    'zufrieren',
    # Additional sein verbs
    'landen',
    'starten',  # hat when transitive, ist when intransitive - mostly hat
    'rutschen', 'gleiten', 'stolpern', 'stürzen',
    'klettern',
    'abrutschen',
    'entarten',
    'verfallen',
    'versinken',
    'aufgehen',
    'untergehen',
    'herausstellen',  # hat actually
    'einziehen',  # both, but mostly ist for "move in"
    'umziehen',  # ist for moving house
    'ausziehen',  # ist for moving out
    'einwandern', 'auswandern', 'zuwandern',
    'pendeln',
    'radeln',
    'segeln',
    'schlittern',
    'spazieren',
    'wandeln',
    'einhergehen',
    'bergsteigen',
    'rodeln',
    'skifahren',
    'dazukommen',
    'feststehen',  # actually hat
    'gegenüberstehen',  # actually hat
    'aufsteigen', 'absteigen',
    'herabsteigen', 'emporsteigen',
    'niederschlagen',  # hat
    'zurückweichen',
    'ausweichen',
    'vordringen', 'eindringen',
    'durchdringen',
    'zurückbleiben',
    'zurücktreten',
    'abbiegen',
    'abkommen',
    'entsprießen', 'sprießen',
    'quellen',
    'festfahren',
    'vorschießen',
    'anfrieren',
    'verscheiden',
    'ertönen',  # ist
    'zerfallen',
    'vergehen',
}

# These should NOT be sein (remove false positives)
HAT_VERBS = {
    'stattfinden',  # hat stattgefunden
    'zunehmen',  # hat zugenommen
    'feststehen',  # hat festgestanden
    'gegenüberstehen',  # hat gegenübergestanden
    'herausstellen',  # hat herausgestellt
    'niederschlagen',  # hat niedergeschlagen
    'starten',  # usually hat gestartet
    'betreten',  # hat betreten (transitive)
    'auftreten',  # hat/ist - mostly ist
    'nachgehen',  # hat/ist - depends on meaning
    'einziehen',  # both, but hat for "collect"
    'umziehen',  # both
    'ausziehen',  # both
}

# Remove false positives from SEIN_VERBS
SEIN_VERBS -= HAT_VERBS

# Actually let me be more careful. These specific verbs ARE sein:
# auftreten (ist aufgetreten when "to appear/occur")
# nachgehen (ist nachgegangen when "to pursue")
# einziehen (ist eingezogen when "to move in")
# umziehen (ist umgezogen when "to move house")
# Let's keep them as sein since the primary game meaning is the intransitive one
SEIN_VERBS.add('auftreten')
SEIN_VERBS.add('einziehen')
SEIN_VERBS.add('umziehen')
SEIN_VERBS.add('ausziehen')

with open('data/verbs.json', encoding='utf-8') as f:
    data = json.load(f)

changed_to_sein = 0
changed_to_hat = 0
for verb in data['verbs']:
    if not verb.get('irregular'):
        continue
    word = verb['word']
    if word in SEIN_VERBS and not verb.get('withSein'):
        verb['withSein'] = True
        changed_to_sein += 1
        print(f"  -> ist: {word} (ist {verb['perfekt']})")

with open('data/verbs.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nChanged {changed_to_sein} verbs to 'ist'.")
