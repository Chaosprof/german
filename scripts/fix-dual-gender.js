#!/usr/bin/env node
/**
 * Fix known errors in dual-gender-nouns.json identified during audit.
 * Run: node scripts/fix-dual-gender.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'dual-gender-nouns.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let fixCount = 0;

function findByWord(word) {
  return data.nouns.find(n => n.word === word);
}

// ============================================================
// 1. FIX WRONG ARTICLES
// ============================================================
console.log('\n=== FIXING WRONG ARTICLES ===');

// Plastik: der Plastik (plastic material) should be das Plastik
const plastik = findByWord('Plastik');
if (plastik) {
  for (const g of plastik.genders) {
    if (g.article === 'der' && g.english.includes('plastic')) {
      console.log(`[FIX] "Plastik": "der" (plastic) -> "das"`);
      g.article = 'das';
      fixCount++;
    }
  }
}

// Alter: der Alte plural should be "Alten" not "Alte"
const alter = findByWord('Alter');
if (alter) {
  for (const g of alter.genders) {
    if (g.article === 'der' && g.plural === 'Alte') {
      console.log(`[FIX] "Alter": der Alte plural "Alte" -> "Alten"`);
      g.plural = 'Alten';
      fixCount++;
    }
  }
}

// Mensch: das Mensch plural "Menscher" — flag as archaic/dialectal
const mensch = findByWord('Mensch');
if (mensch) {
  for (const g of mensch.genders) {
    if (g.article === 'das') {
      g.english = 'wretch (archaic/dialectal, derogatory)';
      console.log(`[FIX] "Mensch": das Mensch — clarified as archaic/dialectal`);
      fixCount++;
    }
  }
}

// ============================================================
// 2. REMOVE QUESTIONABLE ENTRIES
// ============================================================
console.log('\n=== REMOVING QUESTIONABLE ENTRIES ===');

const removeWords = [
  'Loch',      // "der Loch" = Scottish lake — not German
  'Kraut',     // "der Kraut" = derogatory term — not a real noun gender distinction
];

const beforeCount = data.nouns.length;
data.nouns = data.nouns.filter(n => {
  if (removeWords.includes(n.word)) {
    console.log(`[REMOVE] "${n.word}": not a genuine German dual-gender noun`);
    fixCount++;
    return false;
  }
  return true;
});

// ============================================================
// 3. FIX MISLEADING ENTRIES
// ============================================================
console.log('\n=== FIXING MISLEADING ENTRIES ===');

// Kaffee: das Kaffee = cafe is dialectal, update to note this
const kaffee = findByWord('Kaffee');
if (kaffee) {
  for (const g of kaffee.genders) {
    if (g.article === 'das') {
      g.english = 'cafe (regional/dialectal, standard: das Café)';
      console.log(`[FIX] "Kaffee": das Kaffee marked as regional/dialectal`);
      fixCount++;
    }
  }
}

// Espresso: das Espresso = espresso bar is non-standard
const espresso = findByWord('Espresso');
if (espresso) {
  for (const g of espresso.genders) {
    if (g.article === 'das') {
      g.english = 'espresso (variant gender, non-standard)';
      console.log(`[FIX] "Espresso": das Espresso marked as non-standard`);
      fixCount++;
    }
  }
}

// Reis: plural "Reise" is confusing (means "journey")
const reis = findByWord('Reis');
if (reis) {
  for (const g of reis.genders) {
    if (g.article === 'der' && g.plural === 'Reise') {
      g.plural = '—';
      g.singularOnly = true;
      console.log(`[FIX] "Reis": der Reis (rice) — marked as mass noun, no standard plural`);
      fixCount++;
    }
  }
}

// ============================================================
// 4. ADD MISSING IMPORTANT ENTRIES
// ============================================================
console.log('\n=== ADDING MISSING ENTRIES ===');

// Check if Hut already exists
if (!findByWord('Hut')) {
  data.nouns.push({
    word: 'Hut',
    genders: [
      {
        article: 'der',
        english: 'hat',
        plural: 'Hüte',
        singularOnly: false,
        pluralOnly: false
      },
      {
        article: 'die',
        english: 'guard/protection (auf der Hut sein = to be on guard)',
        plural: '—',
        singularOnly: true,
        pluralOnly: false
      }
    ],
    rank: 999
  });
  console.log(`[ADD] "Hut": der Hut (hat) / die Hut (guard)`);
  fixCount++;
}

// Check if Junge already exists
if (!findByWord('Junge')) {
  data.nouns.push({
    word: 'Junge',
    genders: [
      {
        article: 'der',
        english: 'boy',
        plural: 'Jungen',
        singularOnly: false,
        pluralOnly: false
      },
      {
        article: 'das',
        english: 'young animal/cub',
        plural: 'Jungen',
        singularOnly: false,
        pluralOnly: false
      }
    ],
    rank: 998
  });
  console.log(`[ADD] "Junge": der Junge (boy) / das Junge (young animal)`);
  fixCount++;
}

// Update meta count
data.meta.count = data.nouns.length;

// ============================================================
// WRITE OUTPUT
// ============================================================
console.log(`\n=== TOTAL FIXES: ${fixCount} ===`);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Written to ${filePath}`);
