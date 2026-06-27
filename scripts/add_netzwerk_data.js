// Add missing Netzwerk entries to the bank using the English translations
// already present in the parsed entries (the PDF includes them).
//
// Usage: node add_netzwerk_data.js <level>   (a1 or a2)

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const level = process.argv[2];
if (!["a1", "a2"].includes(level)) {
  console.error("Usage: add_netzwerk_data.js <a1|a2>");
  process.exit(1);
}

const SOURCE = `netzwerk-${level}`;

const missing = readJson(`audit/nwn_${level}_missing.json`);

const nounsData = readJson("data/nouns.json");
const verbsData = readJson("data/verbs.json");
const adjsData = readJson("data/adjectives.json");

const nouns = nounsData.nouns;
const verbs = verbsData.verbs;
const adjs = adjsData.adjectives;

const nounByWord = new Map(nouns.map((n) => [n.word, n]));
const verbByWord = new Map(verbs.map((v) => [v.word, v]));
const adjByWord = new Map(adjs.map((a) => [a.word, a]));
const adjByLower = new Map(adjs.map((a) => [a.word.toLowerCase(), a]));

let nextNounRank = Math.max(...nouns.map((n) => n.rank || 0)) + 1;
let nextVerbRank = Math.max(...verbs.map((v) => v.rank || 0)) + 1;
let nextAdjRank = Math.max(...adjs.map((a) => a.rank || 0)) + 1;

function nounHelp(article, word, plural, modifiers = []) {
  let articleHelp = "", pluralHelp = "", ruleId;
  if (word.endsWith("ung")) { articleHelp = "Suffix rule: -ung -> always die."; pluralHelp = "-en plural."; ruleId = "die.suffix_ung"; }
  else if (word.endsWith("heit") || word.endsWith("keit")) { articleHelp = "Suffix rule: -heit/-keit -> always die."; pluralHelp = plural === "—" ? "Singular-only." : "-en plural."; ruleId = word.endsWith("heit") ? "die.suffix_heit" : "die.suffix_keit"; }
  else if (word.endsWith("in")) { articleHelp = "Suffix pattern: -in/-erin -> die for female persons."; pluralHelp = "+nen plural."; ruleId = "die.suffix_in"; }
  else if (word.endsWith("schaft")) { articleHelp = "Suffix rule: -schaft -> always die."; pluralHelp = "-en plural."; ruleId = "die.suffix_schaft"; }
  else if (word.endsWith("e") && article === "die") { articleHelp = "Most -e nouns are die."; pluralHelp = plural && plural.endsWith("n") ? "+n plural for feminine -e nouns." : ""; ruleId = "die.suffix_e"; }
  if (modifiers.includes("nur Pl.")) pluralHelp = "Plural-only noun (Plurale tantum).";
  if (modifiers.includes("nur Sg.")) pluralHelp = "Singular-only.";
  return { articleHelp, pluralHelp, ruleId };
}

function expandPlural(word, hint, modifiers) {
  if (modifiers && modifiers.includes("nur Sg.")) return "—";
  if (modifiers && modifiers.includes("nur Pl.")) return word;
  if (!hint) return null;
  const h = hint.trim();
  if (h === "-" || h === "–" || h === "—") return word;
  if (h.startsWith("..")) return addUmlaut(word) + h.slice(2).trim();
  if (h.startsWith('"')) return addUmlaut(word) + h.slice(1).replace(/^-/, "");
  if (h.startsWith("-") || h.startsWith("–") || h.startsWith("—")) return word + h.slice(1);
  if (/^[A-ZÄÖÜ]/.test(h)) return h;
  return null;
}

function addUmlaut(word) {
  let i = word.lastIndexOf("au");
  if (i !== -1) return word.slice(0, i) + "äu" + word.slice(i + 2);
  for (let j = word.length - 1; j >= 0; j--) {
    const c = word[j];
    if (c === "a") return word.slice(0, j) + "ä" + word.slice(j + 1);
    if (c === "o") return word.slice(0, j) + "ö" + word.slice(j + 1);
    if (c === "u") return word.slice(0, j) + "ü" + word.slice(j + 1);
  }
  return word;
}

// Clean English translation for storage. Strip "the " prefix etc.
function cleanEng(eng) {
  if (!eng) return "";
  let s = eng.trim();
  // Remove leading "the " for nouns
  s = s.replace(/^the\s+/i, "");
  // Remove leading "to " markers ARE kept for verbs (they're the infinitive marker)
  return s;
}

const ENGLISH_LEMMAS = new Set([
  "a", "about", "and", "at", "bye", "chicken", "condition", "eight", "eleven",
  "exercise", "fifteen", "first", "five", "from", "garden", "good", "grammar",
  "guide", "hello", "here", "informal", "it", "kitchen", "language", "last",
  "loud", "name", "number", "person", "sentence", "Spanish", "subject",
  "sunscreen", "table", "telephone", "the", "to", "travel", "upon", "useful",
  "verb", "very", "well", "where", "which", "word", "you", "your"
]);

function isBadExtract(e, eng) {
  const w = String(e.lemma || "");
  if (!w || ENGLISH_LEMMAS.has(w)) return true;
  if (/^[a-z]+$/.test(w) && !/[äöüß]/i.test(w) && ENGLISH_LEMMAS.has(w.toLowerCase())) return true;
  if (/^[nrm]?[a-z]+$/.test(w) && /^(der|die|das)\s|^\d+[a-z]\b|,\s*(er|sie|hat|ist)\b/.test(eng)) return true;
  return false;
}

let added = { n: 0, v: 0, a: 0 }, skipped = { n: 0, v: 0, a: 0 };

// Nouns
for (const e of missing.noun || []) {
  const w = e.lemma;
  if (nounByWord.has(w)) { skipped.n++; continue; }
  const eng = cleanEng(e.english || "");
  if (!eng || isBadExtract(e, eng)) { skipped.n++; continue; }
  const article = (e.article || "der").split("/")[0];
  const plural = expandPlural(w, e.plural_hint, e.modifiers || []) || w;
  const help = nounHelp(article, w, plural, e.modifiers || []);
  const entry = {
    word: w, article, plural, english: eng,
    rank: nextNounRank++, leipzigRank: null, manuallyAdded: true, source: SOURCE,
    articleHelp: help.articleHelp, pluralHelp: help.pluralHelp,
  };
  if (help.ruleId) entry.ruleId = help.ruleId;
  if ((e.modifiers || []).includes("nur Pl.")) entry.pluraleTantum = true;
  nouns.push(entry);
  nounByWord.set(w, entry);
  added.n++;
}

// Verbs
for (const e of missing.verb || []) {
  const w = e.lemma;
  if (verbByWord.has(w)) { skipped.v++; continue; }
  if (adjByLower.has(w.toLowerCase())) { skipped.v++; continue; }  // already an adjective
  const eng = cleanEng(e.english || "");
  if (!eng || isBadExtract(e, eng)) { skipped.v++; continue; }
  const entry = { word: w, english: eng, rank: nextVerbRank++, irregular: false, source: SOURCE };
  verbs.push(entry);
  verbByWord.set(w, entry);
  added.v++;
}

// Adjectives — many of these are language names or function words; only add real adjectives/adverbs
for (const e of missing.adj || []) {
  const w = e.lemma;
  if (adjByWord.has(w)) { skipped.a++; continue; }
  if (adjByLower.has(w.toLowerCase())) { skipped.a++; continue; }
  if (verbByWord.has(w)) { skipped.a++; continue; }
  const eng = cleanEng(e.english || "");
  if (!eng || isBadExtract(e, eng)) { skipped.a++; continue; }
  const entry = { word: w, english: eng, rank: nextAdjRank++, leipzigRank: null, source: SOURCE };
  adjs.push(entry);
  adjByWord.set(w, entry);
  adjByLower.set(w.toLowerCase(), entry);
  added.a++;
}

nounsData.meta.count = nouns.length;
verbsData.meta.count = verbs.length;
adjsData.meta.count = adjs.length;
writeJson("data/nouns.json", nounsData);
writeJson("data/verbs.json", verbsData);
writeJson("data/adjectives.json", adjsData);

console.log(`Netzwerk ${level.toUpperCase()}: added ${added.n} nouns, ${added.v} verbs, ${added.a} adjectives`);
console.log(`  skipped (already in bank or no translation): ${skipped.n}N + ${skipped.v}V + ${skipped.a}A`);
