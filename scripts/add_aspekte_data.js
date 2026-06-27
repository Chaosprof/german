// Add missing Aspekte entries to the bank using DeepL translations.
//
// Usage: node add_aspekte_data.js <level>   (b2 or c1)
//
// Reads:
//   audit/aspekte_<level>_missing.json    — parsed entries (article, plural, etc.)
//   audit/deepl/aspekte_<level>.json      — DeepL translations
// Writes:
//   data/{nouns,verbs,adjectives}.json — adds new entries

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const level = process.argv[2];
if (!["b2", "c1"].includes(level)) {
  console.error("Usage: add_aspekte_data.js <b2|c1>");
  process.exit(1);
}

const SOURCE = `aspekte-${level}`;

const missing = readJson(`audit/aspekte_${level}_missing.json`);
const translations = readJson(`audit/deepl/aspekte_${level}.json`);

const nounsData = readJson("data/nouns.json");
const verbsData = readJson("data/verbs.json");
const adjsData = readJson("data/adjectives.json");

const nouns = nounsData.nouns;
const verbs = verbsData.verbs;
const adjs = adjsData.adjectives;

const nounByWord = new Map(nouns.map((n) => [n.word, n]));
const verbByWord = new Map(verbs.map((v) => [v.word, v]));
const adjByWord = new Map(adjs.map((a) => [a.word, a]));

let nextNounRank = Math.max(...nouns.map((n) => n.rank || 0)) + 1;
let nextVerbRank = Math.max(...verbs.map((v) => v.rank || 0)) + 1;
let nextAdjRank = Math.max(...adjs.map((a) => a.rank || 0)) + 1;

function nounHelp(article, word, plural, modifiers = []) {
  let articleHelp = "";
  let pluralHelp = "";
  let ruleId;
  if (word.endsWith("ung")) { articleHelp = "Suffix rule: -ung -> always die."; pluralHelp = "-en plural."; ruleId = "die.suffix_ung"; }
  else if (word.endsWith("heit") || word.endsWith("keit")) { articleHelp = "Suffix rule: -heit/-keit -> always die."; pluralHelp = plural === "—" ? "Singular-only." : "-en plural."; ruleId = word.endsWith("heit") ? "die.suffix_heit" : "die.suffix_keit"; }
  else if (word.endsWith("in")) { articleHelp = "Suffix pattern: -in/-erin -> die for female persons."; pluralHelp = "+nen plural."; ruleId = "die.suffix_in"; }
  else if (word.endsWith("schaft")) { articleHelp = "Suffix rule: -schaft -> always die."; pluralHelp = "-en plural."; ruleId = "die.suffix_schaft"; }
  else if (word.endsWith("e") && article === "die") { articleHelp = "Most -e nouns are die."; pluralHelp = plural && plural.endsWith("n") ? "+n plural for feminine -e nouns." : ""; ruleId = "die.suffix_e"; }
  if (modifiers.includes("nur Pl.")) pluralHelp = "Plural-only noun (Plurale tantum).";
  if (modifiers.includes("nur Sg.")) pluralHelp = "Singular-only.";
  return { articleHelp, pluralHelp, ruleId };
}

// Expand plural hint, e.g. "-en" -> "Wordrn" (using umlaut for "..e", "-er" for "-er", etc.)
function expandPlural(word, hint, modifiers) {
  if (!modifiers || !hint) {
    if (modifiers && modifiers.includes("nur Sg.")) return "—";
    if (modifiers && modifiers.includes("nur Pl.")) return word;
  }
  if (!hint) return null;
  const h = hint.trim();
  if (modifiers.includes("nur Sg.")) return "—";
  if (modifiers.includes("nur Pl.")) return word;
  if (h === "-" || h === "–" || h === "—") return word;
  if (h.startsWith("..")) {
    // Umlaut
    return addUmlaut(word) + h.slice(2).trim();
  }
  if (h.startsWith('"-')) {
    // Aspekte format: "-er means umlaut + er
    return addUmlaut(word) + h.slice(2);
  }
  if (h.startsWith('"')) {
    return addUmlaut(word) + h.slice(1);
  }
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

function extractIrregular(text) {
  // "leichtfallen, fiel leicht, ist leichtgefallen" or
  // "empfinden, empfand, hat empfunden"
  const m = text.match(/,\s*([a-zäöüß][\wäöüß ]+?),\s*(hat|ist)\s+([\wäöüß]+)/);
  if (!m) return null;
  return [m[1].trim(), m[3].trim(), m[2] === "ist"];
}

function extractArticle(text) {
  const m = text.match(/^(der\/die|die\/der|der|die|das)\s+/);
  return m ? m[1] : null;
}

function extractPlural(text) {
  const m = text.match(/^(?:der\/die|die\/der|der|die|das)\s+\S+\s*,\s*([\-–—"]\w*|\.\.\s*\w+|[A-ZÄÖÜ][\wÄÖÜäöüß-]*)/);
  if (m) return m[1].trim();
  return null;
}

function extractModifiers(text) {
  const out = [];
  if (/\((nur\s+)?Sg\.\)/.test(text)) out.push("nur Sg.");
  if (/\((nur\s+)?Pl\.\)/.test(text)) out.push("nur Pl.");
  return out;
}

function clean(eng) {
  if (!eng) return "";
  // DeepL sometimes returns capitalised; lower the first letter unless it's a proper noun pattern.
  return eng.replace(/^The\s+/i, "").trim();
}

let added = { n: 0, v: 0, a: 0 }, skipped = { n: 0, v: 0, a: 0 };

// Nouns
for (const e of missing.nouns || []) {
  const w = e.lemma;
  if (nounByWord.has(w)) { skipped.n++; continue; }
  const tr = translations[w];
  const eng = clean(tr ? tr.english : "");
  if (!eng) { skipped.n++; continue; }
  const article = extractArticle(e.text) || "der";
  const articleClean = article.replace("/die", "").split("/")[0]; // pick first article for primary entry
  const pluralHint = extractPlural(e.text);
  const modifiers = extractModifiers(e.text);
  const plural = expandPlural(w, pluralHint, modifiers) || (modifiers.includes("nur Sg.") ? "—" : null);
  const help = nounHelp(articleClean, w, plural, modifiers);
  const entry = {
    word: w,
    article: articleClean,
    plural: plural || w,
    english: eng,
    rank: nextNounRank++,
    leipzigRank: null,
    manuallyAdded: true,
    source: SOURCE,
    articleHelp: help.articleHelp,
    pluralHelp: help.pluralHelp,
  };
  if (help.ruleId) entry.ruleId = help.ruleId;
  if (modifiers.includes("nur Pl.")) entry.pluraleTantum = true;
  nouns.push(entry);
  nounByWord.set(w, entry);
  added.n++;
}

// Verbs
for (const e of missing.verbs || []) {
  const w = e.lemma;
  if (verbByWord.has(w)) { skipped.v++; continue; }
  const tr = translations[w];
  const eng = clean(tr ? tr.english : "");
  if (!eng) { skipped.v++; continue; }
  const irreg = extractIrregular(e.text);
  const entry = { word: w, english: eng, rank: nextVerbRank++, irregular: !!irreg, source: SOURCE };
  if (irreg) {
    entry.prateritum = irreg[0];
    entry.perfekt = irreg[1];
    entry.withSein = irreg[2];
  }
  verbs.push(entry);
  verbByWord.set(w, entry);
  added.v++;
}

// Adjectives
for (const e of missing.adjs || []) {
  const w = e.lemma;
  if (adjByWord.has(w)) { skipped.a++; continue; }
  const tr = translations[w];
  const eng = clean(tr ? tr.english : "");
  if (!eng) { skipped.a++; continue; }
  const entry = { word: w, english: eng, rank: nextAdjRank++, leipzigRank: null, source: SOURCE };
  adjs.push(entry);
  adjByWord.set(w, entry);
  added.a++;
}

nounsData.meta.count = nouns.length;
verbsData.meta.count = verbs.length;
adjsData.meta.count = adjs.length;
writeJson("data/nouns.json", nounsData);
writeJson("data/verbs.json", verbsData);
writeJson("data/adjectives.json", adjsData);

console.log(`Aspekte ${level.toUpperCase()}: added ${added.n} nouns, ${added.v} verbs, ${added.a} adjectives`);
console.log(`  skipped (already in bank or no translation): ${skipped.n}N + ${skipped.v}V + ${skipped.a}A`);
