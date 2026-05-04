#!/usr/bin/env node
/**
 * Fix known errors in verbs.json identified during audit.
 * Run: node scripts/fix-verbs.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'verbs.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let fixCount = 0;

function findByRank(rank) {
  return data.verbs.find(v => v.rank === rank);
}

function fix(verb, field, newVal, reason) {
  if (!verb) return;
  const old = verb[field];
  if (old !== newVal) {
    console.log(`[FIX] Rank ${verb.rank} "${verb.word}": ${field} "${old}" -> "${newVal}" (${reason})`);
    verb[field] = newVal;
    fixCount++;
  }
}

// ============================================================
// 1. WRONG VERB FORMS
// ============================================================
console.log('\n=== FIXING VERB FORMS ===');

// umgeben - inseparable prefix verb, treated as separable
const umgeben = findByRank(769);
if (umgeben) {
  fix(umgeben, 'prateritum', 'umgab', 'inseparable: um- does not separate');
  fix(umgeben, 'perfekt', 'umgeben', 'inseparable: no ge-, participle = infinitive');
}

// ============================================================
// 2. WRONG withSein
// ============================================================
console.log('\n=== FIXING withSein ===');

fix(findByRank(182), 'withSein', false, 'vertreten uses haben');
fix(findByRank(414), 'withSein', false, 'herausfinden uses haben');
fix(findByRank(426), 'withSein', true, 'verlaufen uses sein (intransitive process)');
fix(findByRank(554), 'withSein', true, 'sich begeben uses sein');
fix(findByRank(626), 'withSein', true, 'geraten uses sein (state change)');
fix(findByRank(939), 'withSein', true, 'ausscheiden uses sein (state change)');

// ============================================================
// 3. TRANSLATION FIXES
// ============================================================
console.log('\n=== FIXING TRANSLATIONS ===');

fix(findByRank(695), 'english', 'reflect', 'reflektieren = reflect, not "be interested"');
fix(findByRank(688), 'english', 'write / compose', 'verfassen - "indite" is archaic English');
fix(findByRank(691), 'english', 'process / prepare', 'aufbereiten - broader than just "purify"');
fix(findByRank(1041), 'english', 'smell', 'riechen - "reek" implies bad smell');
fix(findByRank(815), 'english', 'not begrudge / treat oneself to', 'gönnen - added common reflexive usage');

// ============================================================
// 4. FIX INCONSISTENT DUAL-MEANING VERB
// ============================================================
console.log('\n=== FIXING DUAL-MEANING VERBS ===');

// umgehen: make forms consistent with the separable meaning (more common)
const umgehen = findByRank(296);
if (umgehen) {
  fix(umgehen, 'prateritum', 'ging um', 'separable meaning "deal with" is more common');
  fix(umgehen, 'perfekt', 'umgegangen', 'separable: um...gegangen');
  fix(umgehen, 'english', 'deal with / handle', 'separable meaning');
  // withSein = true is correct for the separable meaning
}

// schaffen: note both meanings in translation
const schaffen = findByRank(57);
if (schaffen) {
  const currentEnglish = schaffen.english;
  if (currentEnglish && currentEnglish.includes('manage')) {
    fix(schaffen, 'english', 'create (irregular: schuf/geschaffen) / manage (regular: schaffte/geschafft)',
      'clarify both meanings and their different conjugations');
  }
}

// ============================================================
// WRITE OUTPUT
// ============================================================
console.log(`\n=== TOTAL FIXES: ${fixCount} ===`);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Written to ${filePath}`);
