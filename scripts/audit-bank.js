#!/usr/bin/env node
// Audit data/nouns.json for suspected data errors surfaced by the exception
// discovery. Only reports patterns where the standard German article is
// unambiguous per Duden:
//
//   1. Fractions -tel ending stored as der (should be das)
//      but keep the Hälfte exception which is genuinely die.
//   2. Pluralia tantum stored as das (should be die). These are plural-only
//      forms visible by the -jahre, -leute, -spiele, -verhältnisse, -teile,
//      -gründe endings, plus a few known ones.
//   3. -mitte compounds stored as das (die Mitte is feminine).
//
// Prints the list and (with --fix) rewrites nouns.json.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NOUNS_PATH = path.join(ROOT, "data", "nouns.json");
const doc = JSON.parse(fs.readFileSync(NOUNS_PATH, "utf8"));

const FIX = process.argv.includes("--fix");

const corrections = []; // { word, from, to, reason }

function shouldBeDas(word, article) {
  // Fractions — words ending in -tel that mean a fraction
  if (/tel$/.test(word) && article === "der") {
    // Common fraction nouns
    const fractions = [
      "Drittel","Viertel","Fünftel","Sechstel","Siebtel","Siebentel",
      "Achtel","Neuntel","Zehntel","Elftel","Zwölftel",
      "Zwanzigstel","Hundertstel","Tausendstel","Millionstel"
    ];
    if (fractions.includes(word)) return true;
  }
  return false;
}

function shouldBeDie(word, article) {
  if (article !== "das") return false;
  // Pluralia tantum identifiable by suffix + plurality of meaning
  const pluralTails = [
    "jahre", "leute", "spiele", "verhältnisse", "teile", "gründe",
    "ferien"
  ];
  for (const tail of pluralTails) {
    if (word.toLowerCase().endsWith(tail) && word.length > tail.length + 1) {
      return true;
    }
  }
  // -mitte compounds — die Mitte is feminine
  if (/.+mitte$/.test(word)) return true;
  return false;
}

for (const noun of doc.nouns) {
  const { word, article } = noun;
  if (shouldBeDas(word, article)) {
    corrections.push({ word, from: article, to: "das", reason: "fraction -tel → das" });
  } else if (shouldBeDie(word, article)) {
    corrections.push({ word, from: article, to: "die", reason: "plurale tantum / feminine head" });
  }
}

console.log(`Found ${corrections.length} suspected bank errors:`);
for (const c of corrections) {
  console.log(`  ${c.from} ${c.word}  →  ${c.to}  (${c.reason})`);
}

if (FIX) {
  const lookup = new Map();
  for (const c of corrections) lookup.set(c.word, c.to);
  let changed = 0;
  for (const noun of doc.nouns) {
    if (lookup.has(noun.word)) {
      noun.article = lookup.get(noun.word);
      changed++;
    }
  }
  fs.writeFileSync(NOUNS_PATH, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`\nFixed ${changed} entries in data/nouns.json.`);
} else {
  console.log("\nRun with --fix to apply these corrections.");
}
