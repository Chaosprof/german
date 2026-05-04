#!/usr/bin/env node
/**
 * Fix known errors in adjectives.json identified during audit.
 * Run: node scripts/fix-adjectives.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'adjectives.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let fixCount = 0;

function findByRank(rank) {
  return data.adjectives.find(a => a.rank === rank);
}

function fix(adj, field, newVal, reason) {
  if (!adj) return;
  const old = adj[field];
  if (old !== newVal) {
    console.log(`[FIX] Rank ${adj.rank} "${adj.word}": ${field} "${old}" -> "${newVal}" (${reason})`);
    adj[field] = newVal;
    fixCount++;
  }
}

// ============================================================
// 1. FIX INFLECTED FORMS → BASE FORMS
// ============================================================
console.log('\n=== FIXING INFLECTED FORMS ===');

const inflectedToBase = {
  // Ordinals
  15: { word: 'letzt', english: 'last' },
  22: { word: 'erst', english: 'first' },
  24: { word: 'besonder', english: 'special/particular' },
  133: { word: 'zweit', english: 'second' },
  286: { word: 'dritt', english: 'third' },
  626: { word: 'viert', english: 'fourth' },
  870: { word: 'fünft', english: 'fifth' },
  1329: { word: 'sechst', english: 'sixth' },
  1424: { word: 'siebt', english: 'seventh' },
  1517: { word: 'vorletzt', english: 'second to last' },
  1575: { word: 'zehnt', english: 'tenth' },
  1654: { word: 'allererst', english: 'very first' },
  1894: { word: 'acht', english: 'eighth' },
  2692: { word: 'neunt', english: 'ninth' },
  3566: { word: 'zwölft', english: 'twelfth' },
  3603: { word: 'elft', english: 'eleventh' },
  5267: { word: 'zwanzigst', english: 'twentieth' },
  5601: { word: 'siebent', english: 'seventh' },
  6566: { word: 'dreizehnt', english: 'thirteenth' },
  7657: { word: 'dreiundzwanzigst', english: 'twenty-third' },
  7819: { word: 'fünfzigst', english: 'fiftieth' },
  7994: { word: 'hundertst', english: 'hundredth' },
  8245: { word: 'millionst', english: 'millionth' },
  8693: { word: 'tausendst', english: 'thousandth' },
  8930: { word: 'vorvorletzt', english: 'third from last' },
  9051: { word: 'zweihundertst', english: 'two hundredth' },
};

for (const [rank, correction] of Object.entries(inflectedToBase)) {
  const adj = findByRank(Number(rank));
  if (adj) {
    fix(adj, 'word', correction.word, 'base form, not inflected');
    fix(adj, 'english', correction.english, 'correct translation');
  }
}

// Note: "acht" at rank 1894 is tricky — it's the same as the number 8.
// As an ordinal "achte" → "acht" is the base. This is correct but may
// be confused with the cardinal number. Leave as is since context matters.

// ============================================================
// 2. REMOVE INFLECTED SUPERLATIVE COMPOUNDS
// ============================================================
console.log('\n=== REMOVING INFLECTED SUPERLATIVE COMPOUNDS ===');

const removeRanks = new Set([
  1035, // zweitgrößte
  1520, // drittgrößte
  1602, // letztere
  1652, // weltgrößte
  2655, // viertgrößte
  2661, // allerbeste
  2779, // erstere
  3089, // zweitbeste
  3425, // allerletzte
  3713, // zweitälteste
  3936, // dienstälteste
  4090, // zweitkleinste
  4155, // fünftgrößte
  4358, // erstbeste
  4633, // drittwichtigste
  5524, // nächstbeste
  5595, // sechstgrößte
  5856, // drittstärkste
  6437, // allerkleinste
  7353, // zweitlängste
  7659, // drittmächtigste
  9056, // zweitmächtigste
]);

const beforeCount = data.adjectives.length;
data.adjectives = data.adjectives.filter(a => {
  if (removeRanks.has(a.rank)) {
    console.log(`[REMOVE] Rank ${a.rank} "${a.word}": inflected superlative compound`);
    fixCount++;
    return false;
  }
  return true;
});
console.log(`Removed ${beforeCount - data.adjectives.length} inflected superlative compounds`);

// ============================================================
// 3. FIX TRANSLATION ERRORS
// ============================================================
console.log('\n=== FIXING TRANSLATIONS ===');

const translationFixes = {
  109: 'rare/seldom',           // selten: remove adverb "rarely"
  120: 'renewed/repeated',      // erneut: remove adverb "again"
  161: 'complete/utter/total',  // völlig: remove adverb "completely"
  215: 'original',              // ursprünglich: remove "originally"
  236: 'sudden',                // plötzlich: was only "suddenly"
  248: 'predominant/prevailing', // überwiegend: was only adverbial
  251: 'cozy/comfortable',      // gemütlich: add "cozy"
  296: 'stationary/inpatient',   // stationär: add medical meaning
  549: 'cheap/inexpensive',      // billig: remove archaic "fitting"
  1096: 'tired/weary',           // müde: primary meaning is "tired"
  3491: 'purple/violet',         // lila: not "lilac"
};

for (const [rank, newEnglish] of Object.entries(translationFixes)) {
  const adj = findByRank(Number(rank));
  if (adj) {
    fix(adj, 'english', newEnglish, 'more accurate translation');
  }
}

// ============================================================
// 4. FIX CORPUS ARTIFACTS
// ============================================================
console.log('\n=== FIXING CORPUS ARTIFACTS ===');

const klass = findByRank(2207);
if (klass && klass.word === 'klass') {
  fix(klass, 'word', 'klasse', 'truncated word');
  fix(klass, 'english', 'great/awesome (colloquial)', 'correct translation');
}

// Remove "oed" (duplicate of öde at rank 3042)
const oedRank = 8328;
const oed = findByRank(oedRank);
if (oed && oed.word === 'oed') {
  data.adjectives = data.adjectives.filter(a => a.rank !== oedRank);
  console.log(`[REMOVE] Rank ${oedRank} "oed": duplicate of "öde"`);
  fixCount++;
}

// ============================================================
// 5. REMOVE ADVERBS-ONLY
// ============================================================
console.log('\n=== REMOVING ADVERB-ONLY ENTRIES ===');

const adverbOnlyRanks = [2485]; // getrost
for (const rank of adverbOnlyRanks) {
  const adj = findByRank(rank);
  if (adj) {
    data.adjectives = data.adjectives.filter(a => a.rank !== rank);
    console.log(`[REMOVE] Rank ${rank} "${adj.word}": adverb only, not an adjective`);
    fixCount++;
  }
}

// Update meta count
data.meta.count = data.adjectives.length;

// ============================================================
// WRITE OUTPUT
// ============================================================
console.log(`\n=== TOTAL FIXES: ${fixCount} ===`);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Written to ${filePath}`);
