#!/usr/bin/env node
/**
 * Fix known errors in nouns.json identified during audit.
 * Run: node scripts/fix-nouns.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'nouns.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let fixCount = 0;

function findByRank(rank) {
  return data.nouns.find(n => n.rank === rank);
}

function findByWord(word) {
  return data.nouns.filter(n => n.word === word);
}

function fix(noun, field, oldVal, newVal, reason) {
  if (!noun) return;
  if (noun[field] === oldVal || (oldVal === undefined && noun[field] !== newVal)) {
    console.log(`[FIX] Rank ${noun.rank} "${noun.word}": ${field} "${noun[field]}" -> "${newVal}" (${reason})`);
    noun[field] = newVal;
    fixCount++;
  }
}

// ============================================================
// 1. WRONG ARTICLES
// ============================================================
console.log('\n=== FIXING WRONG ARTICLES ===');

fix(findByRank(201), 'article', 'der', 'das', 'das Alter = age');
fix(findByRank(201), 'articleHelp', undefined,
  'Morphological: Nominalized adjective/verbal stem. "das Alter" (age) is neuter. Do not confuse with "der Alte" (the old man), which is a substantivized adjective.',
  'was wrong because article was wrong');

fix(findByRank(210), 'article', 'die', 'das', 'das Foto, not die Foto');
fix(findByRank(210), 'articleHelp', undefined,
  'Loanword from Greek/Latin "photo". Short loanwords ending in -o are often neuter: das Foto, das Auto, das Kino, das Büro.',
  'was wrong because article was wrong');

fix(findByRank(709), 'article', 'der', 'das', 'das Drittel - fractions in -tel are neuter');
fix(findByRank(709), 'articleHelp', undefined,
  'Suffix rule: -tel (fraction) → always das. Das Drittel, das Viertel, das Fünftel, das Zehntel. One of the most reliable neuter patterns.',
  'fractions are neuter');

fix(findByRank(747), 'article', 'der', 'das', 'das Update - standard German');
fix(findByRank(747), 'articleHelp', undefined,
  'English loanword. Most English loanwords in German are neuter (das Update, das Meeting, das Team, das Ticket). When in doubt with English loans, guess das.',
  'English loanword → neuter');

fix(findByRank(750), 'article', 'das', 'die', 'die Steuer = tax');
fix(findByRank(750), 'articleHelp', undefined,
  'Dual-gender noun: die Steuer = tax, das Steuer = steering wheel. Since the meaning here is "tax," the article is die.',
  'tax = die Steuer');

fix(findByRank(760), 'article', 'der', 'das', 'das Event - standard German');
fix(findByRank(760), 'articleHelp', undefined,
  'English loanword. Most English loanwords in German are neuter: das Event, das Ticket, das Meeting. "Der Event" exists in Swiss German but is not standard.',
  'English loanword → neuter');

fix(findByRank(1465), 'article', 'der', 'das', 'das Bauteil - compound follows das Teil');
fix(findByRank(1465), 'articleHelp', undefined,
  'Compound noun — gender follows the last element: Teil (das in compounds). Das Bauteil, das Ersatzteil, das Gegenteil.',
  'compound with -teil → das');

fix(findByRank(1526), 'article', 'das', 'die', 'die Bar = pub/bar');
fix(findByRank(1526), 'articleHelp', undefined,
  'Loanword from English/French. Die Bar (pub/drinking establishment) is feminine. Do not confuse with das Bar (unit of pressure).',
  'die Bar = pub');

fix(findByRank(1767), 'article', 'der', 'das', 'das Zubehör');
fix(findByRank(1767), 'articleHelp', undefined,
  'Prefix Ge-/Zu- collective noun. Das Zubehör (accessories) is neuter, like many collective nouns: das Gepäck, das Geschirr.',
  'das Zubehör');

fix(findByRank(2119), 'article', 'der', 'das', 'das Level - English loanword');
fix(findByRank(2119), 'articleHelp', undefined,
  'English loanword → typically neuter. Das Level, das Label, das Sample. When in doubt with English loans, guess das.',
  'English loanword → neuter');

// Rank 5130 Gewerke
const gewerke = findByRank(5130);
if (gewerke && gewerke.word === 'Gewerke') {
  fix(gewerke, 'article', 'der', 'das', 'das Gewerk');
  fix(gewerke, 'word', 'Gewerke', 'Gewerk', 'base form is Gewerk');
  fix(gewerke, 'articleHelp', undefined,
    'Prefix rule: Ge- collective noun → almost always das. Das Gewerk, das Gebäude, das Geschenk, das Getränk.',
    'Ge- prefix → das');
}

// ============================================================
// 2. WRONG / CONTRADICTORY PLURALS
// ============================================================
console.log('\n=== FIXING WRONG PLURALS ===');

// Euro: plural field says "Euro" but help says "+s (die Euros)" - make consistent
const euro = findByRank(8);
if (euro) {
  fix(euro, 'pluralHelp', undefined,
    'No change (die Euro). Rule: In counting/financial contexts, "Euro" stays unchanged: "5 Euro". Colloquially "Euros" exists but the official plural is invariant. Similar to "100 Prozent".',
    'contradictory plural/help');
}

fix(findByRank(213), 'plural', 'Schutze', '—',
  'Schutz has no standard plural');
fix(findByRank(213), 'pluralHelp', undefined,
  'No standard plural. "Der Schutz" is an abstract/mass noun used only in singular. For different types, use compounds: Datenschutz, Umweltschutz.',
  'no plural');

fix(findByRank(284), 'plural', 'Sporte', '—',
  'Sport has no standard plural; use Sportarten');
fix(findByRank(284), 'pluralHelp', undefined,
  'No standard plural. "Der Sport" is typically singular. For different kinds, use "Sportarten" (types of sport).',
  'no practical plural');

// Media → should be Medium
const media = findByRank(796);
if (media && media.word === 'Media') {
  fix(media, 'word', 'Media', 'Medium', 'correct German word');
  fix(media, 'article', 'die', 'das', 'das Medium');
  fix(media, 'plural', 'Mediä', 'Medien', 'die Medien');
  fix(media, 'english', undefined, 'medium', 'correct translation');
  fix(media, 'articleHelp', undefined,
    'Latin-origin noun ending in -um → das. Das Medium, das Museum, das Stadium, das Zentrum. Plural replaces -um with -en: Medien, Museen, Stadien.',
    'Latin -um → das');
  fix(media, 'pluralHelp', undefined,
    'Latin -um → -en (die Medien). Same pattern: Museum→Museen, Stadium→Stadien, Zentrum→Zentren.',
    'Latin plural');
}

fix(findByRank(1466), 'plural', 'Milche', '—', 'Milch is a mass noun');
fix(findByRank(1466), 'pluralHelp', undefined,
  'No standard plural. "Die Milch" is a mass noun. "Milche" exists only in technical dairy contexts for different milk types.',
  'mass noun');

fix(findByRank(1511), 'plural', 'Umbaue', 'Umbauten', 'standard plural is Umbauten');
fix(findByRank(1511), 'pluralHelp', undefined,
  '-bauten plural (die Umbauten). Compound nouns with -bau take -bauten in plural: Umbau→Umbauten, Neubau→Neubauten, Ausbau→Ausbauten.',
  'correct plural pattern');

fix(findByRank(1621), 'plural', 'Denkmale', 'Denkmäler', 'Denkmäler is strongly preferred');
fix(findByRank(1621), 'pluralHelp', undefined,
  '-er + umlaut (die Denkmäler). While "Denkmale" exists, "Denkmäler" is the strongly preferred form in modern German.',
  'preferred plural');

fix(findByRank(2285), 'plural', 'Monitore', 'Monitoren', 'Latin -or → -oren pattern');
fix(findByRank(2285), 'pluralHelp', undefined,
  '-oren (die Monitoren). Latin-origin nouns ending in -or take -oren: Monitor→Monitoren, Professor→Professoren, Doktor→Doktoren.',
  'Latin plural pattern');

// ============================================================
// 3. INDIVIDUAL TRANSLATION FIXES
// ============================================================
console.log('\n=== FIXING INDIVIDUAL TRANSLATIONS ===');

fix(findByRank(1949), 'english', 'eye boogers/eye gunk/rheum', 'sleep',
  'Schlaf = sleep, not eye boogers');

fix(findByRank(375), 'english', undefined, 'ribbon/tape/band',
  'das Band = ribbon/tape, not volume');
// Only fix if current translation mentions "volume"
const band375 = findByRank(375);
if (band375 && band375.english && band375.english.includes('volume')) {
  band375.english = 'ribbon/tape/band';
  console.log(`[FIX] Rank 375 "Band": english fixed to "ribbon/tape/band"`);
}

fix(findByRank(488), 'english', 'young', 'young animal/cub',
  'das Junge = young animal');

fix(findByRank(1706), 'english', 'environment', 'ambiance/atmosphere',
  'Ambiente = ambiance');

fix(findByRank(1892), 'english', undefined, 'rehabilitation/rehab',
  'fix misspelling and primary meaning');
const rehab = findByRank(1892);
if (rehab && rehab.english && rehab.english.includes('exonoration')) {
  rehab.english = 'rehabilitation/rehab';
  console.log(`[FIX] Rank 1892: fixed misspelling and translation`);
}

fix(findByRank(2015), 'english', 'exoneration', 'relief/easing/discharge',
  'Entlastung primary meaning is relief');

fix(findByRank(2225), 'english', undefined, 'female singer/singer',
  'singeress is not English');
const saengerin = findByRank(2225);
if (saengerin && saengerin.english && saengerin.english.includes('singeress')) {
  saengerin.english = 'female singer/singer';
  console.log(`[FIX] Rank 2225: fixed non-word "singeress"`);
}

fix(findByRank(2243), 'english', undefined, 'midwife',
  'use modern English');
const hebamme = findByRank(2243);
if (hebamme && hebamme.english && (hebamme.english.includes('accoucheur') || hebamme.english.includes('man-midwife'))) {
  hebamme.english = 'midwife';
  console.log(`[FIX] Rank 2243: simplified to "midwife"`);
}

fix(findByRank(245), 'english', 'felling', 'falling/dropping',
  'das Fallen = falling');

// ============================================================
// 4. SYSTEMATIC COMPOUND MISTRANSLATIONS
// ============================================================
console.log('\n=== FIXING SYSTEMATIC COMPOUND MISTRANSLATIONS ===');

// Build a map of compound translation fixes
const compoundFixes = {
  // Weg compounds - "method" should be "path/way/route"
  'Fahrradweg': 'bicycle path/bike lane',
  'Spazierweg': 'walking path/footpath',
  'Postweg': 'postal route',
  'Bildungsweg': 'educational path',
  'Arbeitsweg': 'commute/way to work',
  'Wanderweg': 'hiking trail',
  'Radweg': 'bike path/cycle lane',
  'Fußweg': 'footpath/walkway',
  'Gehweg': 'sidewalk/pavement',
  'Feldweg': 'field path/dirt road',
  'Kreuzweg': 'crossroads/Way of the Cross',
  'Schienenweg': 'railway/rail route',
  'Wasserweg': 'waterway',
  'Handelsweg': 'trade route',
  'Fluchtweg': 'escape route',
  'Schulweg': 'way to school',
  'Heimweg': 'way home',
  'Dienstweg': 'official channels',
  'Rechtsweg': 'legal recourse/legal channels',
  'Umweg': 'detour',
  'Irrweg': 'wrong path/dead end',
  'Leidensweg': 'path of suffering',
  'Lebensweg': 'life path/life journey',
  'Berufsweg': 'career path',
  'Pilgerweg': 'pilgrimage route',
  'Rundweg': 'circular trail/loop trail',
  'Holzweg': 'wrong track (idiom)',
  'Rückweg': 'way back/return journey',
  'Hinweg': 'way there/outward journey',
  'Seeweg': 'sea route',
  'Landweg': 'overland route',
  'Querweg': 'cross path',

  // Verkehr compounds - "communication" should be "traffic/transport"
  'Verkehrsbelastung': 'traffic load/traffic burden',
  'Verkehrsministerium': 'transport ministry',
  'Verkehrsinfrastruktur': 'transport infrastructure',
  'Verkehrsmittel': 'means of transport',
  'Verkehrsweg': 'traffic route/transport route',
  'Verkehrsnetz': 'transport network',
  'Verkehrsanbindung': 'transport connection/link',
  'Verkehrspolitik': 'transport policy',
  'Verkehrsplanung': 'transport/traffic planning',
  'Verkehrsfluss': 'traffic flow',
  'Verkehrslage': 'traffic situation',
  'Verkehrssicherheit': 'road/traffic safety',
  'Verkehrszeichen': 'traffic sign',
  'Verkehrsunfall': 'traffic accident',
  'Verkehrsaufkommen': 'traffic volume',
  'Verkehrsbetrieb': 'transport operator',
  'Verkehrswende': 'transport transition',
  'Verkehrsdelikt': 'traffic offense',
  'Verkehrsstau': 'traffic jam',
  'Verkehrskontrolle': 'traffic check/roadblock',

  // Wahl compounds - "adoption" should be "election/choice"
  'Wahlleiter': 'returning officer/election supervisor',
  'Wahlgang': 'ballot/round of voting',
  'Wahlheimat': 'adopted homeland',
  'Wahlkampf': 'election campaign',
  'Wahlrecht': 'right to vote/suffrage',
  'Wahlkreis': 'electoral district/constituency',
  'Wahlbeteiligung': 'voter turnout',
  'Wahllokal': 'polling station',
  'Wahlprogramm': 'election manifesto/platform',
  'Wahlabend': 'election night',

  // Amt compounds - "velvet" should be "office/authority"
  'Wohnungsamt': 'housing office/housing authority',
  'Straßenverkehrsamt': 'road traffic authority/DMV',
  'Standesamt': 'registry office',
  'Bezirksamt': 'district office',
  'Bürgeramt': 'citizens\' office',

  // Schlaf compounds - "eye boogers" should be "sleep"
  'Schlafzimmer': 'bedroom',
  'Schlafstörung': 'sleep disorder',
  'Schlafmittel': 'sleeping pill/sedative',
  'Schlafplatz': 'sleeping place',
  'Schlaflosigkeit': 'insomnia/sleeplessness',

  // Nest compounds - "hicksville" should be "nest"
  'Schwalbennest': 'swallow\'s nest',
  'Osternest': 'Easter nest/Easter basket',
  'Vogelnest': 'bird\'s nest',

  // Gang compounds - "aisle" corrections
  'Tauchgang': 'dive',
  'Nachgang': 'follow-up',
  'Rundgang': 'tour/walkabout',
  'Lehrgang': 'training course',
  'Durchgang': 'passage/walkthrough',
  'Rückgang': 'decline/decrease',
  'Zugang': 'access/entrance',
  'Ausgang': 'exit/outcome',
  'Eingang': 'entrance/entry',
  'Übergang': 'transition/crossing',
  'Vorgang': 'process/procedure',
  'Aufgang': 'stairway/ascent',
  'Hergang': 'course of events',
  'Abgang': 'departure/exit',

  // Other individual fixes from the tail audit
  'Schweißgerät': 'welding device/welder',
  'Seelenleben': 'inner life/emotional life',
  'Sehstörung': 'visual impairment/vision disorder',
  'Schutzschild': 'protective shield',
  'Seemannsgarn': 'tall tale/yarn',
  'Vorspann': 'opening credits/introduction',
  'Schweben': 'hovering/floating',
};

let compoundFixCount = 0;
for (const noun of data.nouns) {
  if (compoundFixes[noun.word]) {
    const oldEnglish = noun.english;
    noun.english = compoundFixes[noun.word];
    if (oldEnglish !== noun.english) {
      console.log(`[FIX] Rank ${noun.rank} "${noun.word}": "${oldEnglish}" -> "${noun.english}"`);
      compoundFixCount++;
      fixCount++;
    }
  }
}
console.log(`Fixed ${compoundFixCount} compound translations`);

// ============================================================
// 5. SYSTEMATIC articleHelp FIXES
// ============================================================
console.log('\n=== FIXING SYSTEMATIC articleHelp BUGS ===');

let articleHelpFixCount = 0;

for (const noun of data.nouns) {
  // Fix false French -age: native German words ending in -age/-lage/-rage/-sage
  if (noun.articleHelp && noun.articleHelp.includes('Loanword pattern: -age (French)')) {
    // Check if it's a genuine French loanword
    const frenchAgeWords = ['Garage', 'Etage', 'Massage', 'Passage', 'Collage', 'Montage',
      'Sabotage', 'Reportage', 'Blamage', 'Courage', 'Bandage', 'Tonnage',
      'Fuselage', 'Camouflage', 'Spionage', 'Drainage', 'Dressage', 'Visage',
      'Hostage', 'Bagage', 'Entourage', 'Persiflage', 'Triage', 'Mirage',
      'Bricolage', 'Vernissage', 'Arbitrage', 'Karambolage', 'Plantage'];

    if (!frenchAgeWords.includes(noun.word)) {
      const oldHelp = noun.articleHelp;
      if (noun.word.endsWith('e')) {
        noun.articleHelp = `Ending pattern: ~90% of nouns ending in -e are die. E.g. Straße, Lampe, Schule, Frage, Anlage. This is one of the most reliable gender rules in German.`;
      }
      console.log(`[FIX] Rank ${noun.rank} "${noun.word}": removed false French -age label`);
      articleHelpFixCount++;
      fixCount++;
    }
  }

  // Fix "monosyllabic" label on multi-syllable words
  if (noun.articleHelp && noun.articleHelp.includes('monosyllabic')) {
    // Simple syllable count heuristic: count vowel clusters
    const vowelClusters = noun.word.toLowerCase().match(/[aeiouyäöü]+/g);
    const syllableCount = vowelClusters ? vowelClusters.length : 1;
    // Diphthongs (ei, eu, au, äu, ie) count as one syllable
    const diphthongs = noun.word.toLowerCase().match(/(ei|eu|au|äu|ie|ey|ay)/g);
    const adjustedCount = syllableCount - (diphthongs ? diphthongs.length : 0) + (diphthongs ? diphthongs.length : 0);
    // Actually a simpler approach: just check well-known multi-syllable words
    if (syllableCount > 1) {
      // Only fix if it genuinely has multiple syllables
      // Replace with a generic helpful message based on article
      const oldHelp = noun.articleHelp;
      if (noun.article === 'der') {
        noun.articleHelp = `No standard suffix or semantic rule applies cleanly. Masculine gender must be memorized. Tip: ~60% of monosyllabic German nouns are der, but "${noun.word}" has ${syllableCount} syllables — memorize with a phrase.`;
      } else if (noun.article === 'die') {
        noun.articleHelp = `No standard suffix or semantic rule applies cleanly. Feminine gender must be memorized. Tip: learn in context — "die ${noun.word}".`;
      } else {
        noun.articleHelp = `No standard suffix or semantic rule applies cleanly. Neuter gender must be memorized. Tip: learn in context — "das ${noun.word}".`;
      }
      // But check for specific patterns we can give better help for
      if (noun.word.endsWith('e') && noun.article === 'die') {
        noun.articleHelp = `Ending pattern: ~90% of nouns ending in -e are die. E.g. Straße, Lampe, Schule, Frage. This is one of the most reliable gender rules.`;
      }
      if (noun.word.endsWith('o') && noun.article === 'das') {
        noun.articleHelp = `Loanword ending in -o → often das. Das Auto, das Kino, das Büro, das Foto. Most -o loanwords are neuter.`;
      }
      if (noun.word.endsWith('ma') && noun.article === 'das') {
        noun.articleHelp = `Greek/Latin origin ending in -ma → das. Das Thema, das Drama, das Klima, das Dogma, das Trauma. Very reliable neuter pattern.`;
      }
      if (noun.word.endsWith('ion') && noun.article === 'die') {
        noun.articleHelp = `Suffix rule: -ion → always die. Die Union, die Station, die Religion, die Nation. 100% reliable for die.`;
      }
      if (noun.word.endsWith('el') && noun.article === 'die') {
        noun.articleHelp = `Ending pattern: Nouns ending in -el can be any gender, but must be memorized. Die Regel, der Schlüssel, das Mittel.`;
      }
      if (noun.word.endsWith('el') && noun.article === 'der') {
        noun.articleHelp = `Ending pattern: Many nouns ending in -el are masculine (der Schlüssel, der Artikel, der Mantel), but this varies. Memorize in context.`;
      }
      console.log(`[FIX] Rank ${noun.rank} "${noun.word}": removed false "monosyllabic" label`);
      articleHelpFixCount++;
      fixCount++;
    }
  }

  // Fix -in suffix nouns getting "no rule applies"
  if (noun.word.endsWith('in') && noun.article === 'die' &&
      noun.word.length > 3 && // exclude short words like "Bin"
      noun.articleHelp && noun.articleHelp.includes('No standard suffix')) {
    // Check it's actually a feminine person suffix (the base word without -in should exist or word > 5 chars)
    if (noun.word.length >= 5) {
      noun.articleHelp = `Suffix rule: -in (female person) → always die. Die Lehrerin, die Ärztin, die Schülerin, die Kollegin. This is one of the most reliable feminine markers — 100% consistent.`;
      console.log(`[FIX] Rank ${noun.rank} "${noun.word}": added -in suffix rule`);
      articleHelpFixCount++;
      fixCount++;
    }
  }

  // Fix nominalized infinitives getting wrong help
  if (noun.article === 'das' && noun.articleHelp &&
      noun.articleHelp.includes('must be memorized') &&
      noun.word.endsWith('en') && noun.word[0] === noun.word[0].toUpperCase()) {
    // Check if it looks like a nominalized infinitive (ends in -en, common pattern)
    const possibleVerb = noun.word.toLowerCase();
    // Common nominalized infinitives
    const nomInfinitives = ['lernen', 'leben', 'essen', 'trinken', 'laufen', 'schreiben',
      'lesen', 'schwimmen', 'kochen', 'wandern', 'reisen', 'spielen', 'tanzen',
      'singen', 'rauchen', 'verhalten', 'verfahren', 'vorgehen', 'vergnügen',
      'versagen', 'vergessen', 'verstehen', 'vermögen', 'vorhaben', 'befinden',
      'bestehen', 'erscheinen', 'verschwinden', 'entstehen', 'geschehen'];
    if (nomInfinitives.includes(possibleVerb)) {
      noun.articleHelp = `Morphological: Nominalized infinitive → always das. Any German verb can be used as a noun (capitalize it), and it's always neuter: das ${noun.word}, das Leben, das Essen.`;
      console.log(`[FIX] Rank ${noun.rank} "${noun.word}": added nominalized infinitive rule`);
      articleHelpFixCount++;
      fixCount++;
    }
  }

  // Fix Aufwand-type false compound analysis
  if (noun.word === 'Aufwand' && noun.articleHelp && noun.articleHelp.includes('Wand')) {
    noun.articleHelp = `Derived from "aufwenden" (to expend). Der Aufwand (effort/expenditure) is masculine. Not a compound of "die Wand" (wall).`;
    console.log(`[FIX] Rank ${noun.rank} "Aufwand": fixed false compound analysis`);
    articleHelpFixCount++;
    fixCount++;
  }

  // Fix Meer articleHelp (-er exception applied to -eer word)
  if (noun.word === 'Meer' && noun.articleHelp && noun.articleHelp.includes('-er nouns')) {
    noun.articleHelp = `Short/monosyllabic noun — no suffix or semantic rule applies. Das Meer (sea/ocean) is neuter. Memorize in context: "das weite Meer".`;
    console.log(`[FIX] Rank ${noun.rank} "Meer": fixed wrong -er pattern match`);
    articleHelpFixCount++;
    fixCount++;
  }

  // Fix Papier articleHelp
  if (noun.word === 'Papier' && noun.articleHelp && noun.articleHelp.includes('-er nouns')) {
    noun.articleHelp = `Latin/French origin loanword. Das Papier is neuter. The stressed -ier ending (from French/Latin) is not the same as the German agentive -er suffix.`;
    console.log(`[FIX] Rank ${noun.rank} "Papier": fixed wrong -er pattern match`);
    articleHelpFixCount++;
    fixCount++;
  }

  // Fix Wetter articleHelp
  if (noun.word === 'Wetter' && noun.articleHelp && noun.articleHelp.includes('Weather nouns are usually der')) {
    noun.articleHelp = `"Das Wetter" is neuter. Weather nouns span all genders (der Regen, die Sonne, das Gewitter), so there is no reliable gender rule for weather — memorize individually.`;
    console.log(`[FIX] Rank ${noun.rank} "Wetter": fixed false weather rule`);
    articleHelpFixCount++;
    fixCount++;
  }

  // Fix Homepage articleHelp
  if (noun.word === 'Homepage' && noun.articleHelp && noun.articleHelp.includes('French')) {
    noun.articleHelp = `English loanword ending in -page. Die Homepage follows the pattern of "die Seite" (page). Not to be confused with the French -age suffix pattern.`;
    console.log(`[FIX] Rank ${noun.rank} "Homepage": fixed false French label`);
    articleHelpFixCount++;
    fixCount++;
  }

  // Fix Krieg etymology
  if (noun.word === 'Krieg' && noun.articleHelp && noun.articleHelp.includes('kriegen')) {
    noun.articleHelp = `Short/monosyllabic noun — der Krieg (war) is masculine. Statistically ~60% of monosyllabic German nouns are der. Memorize in context.`;
    console.log(`[FIX] Rank ${noun.rank} "Krieg": fixed misleading etymology`);
    articleHelpFixCount++;
    fixCount++;
  }
}

console.log(`Fixed ${articleHelpFixCount} articleHelp entries`);

// ============================================================
// 6. REMOVE BRAND NAMES / NON-WORDS
// ============================================================
console.log('\n=== REMOVING NON-WORDS ===');

const removeWords = ['RUF', 'UNIX'];
const beforeCount = data.nouns.length;
data.nouns = data.nouns.filter(n => {
  if (removeWords.includes(n.word)) {
    console.log(`[REMOVE] Rank ${n.rank} "${n.word}": not a German vocabulary word`);
    fixCount++;
    return false;
  }
  return true;
});
console.log(`Removed ${beforeCount - data.nouns.length} non-word entries`);

// Update meta count
data.meta.count = data.nouns.length;

// ============================================================
// WRITE OUTPUT
// ============================================================
console.log(`\n=== TOTAL FIXES: ${fixCount} ===`);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Written to ${filePath}`);
