// Add missing Netzwerk A2 entries using DeepL translations.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const SOURCE = "netzwerk-a2";
const missing = readJson("audit/nwn_a2_missing.json");
const translations = readJson("audit/deepl/nwn_a2.json");

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

function clean(eng) {
  if (!eng) return "";
  return eng.replace(/^The\s+/i, "").replace(/^the\s+/, "").trim();
}

const ENGLISH_LEMMAS = new Set([
  "fashionable", "here", "my", "school", "want", "where"
]);
const GLUED_ENGLISH_SUFFIX_RE = /(about|almost|approximately|backward|because|behind|besides|conjugated|each|even|impractical|lastly|now|nowhere|still|therefore|what|when)$/i;

function isBadExtract(e, eng) {
  const w = String(e.lemma || "");
  if (!w) return true;
  if (ENGLISH_LEMMAS.has(w.toLowerCase())) return true;
  if (/^[a-zäöüß]+[a-z]{3,}$/.test(w) && GLUED_ENGLISH_SUFFIX_RE.test(w)) return true;
  if (/^[A-ZÄÖÜ][a-zäöüß]+$/.test(w) && /^[A-Z]/.test(eng || "") && e.kind !== "noun") return true;
  return false;
}

let added = { n: 0, v: 0, a: 0 }, skipped = { n: 0, v: 0, a: 0 };

for (const e of missing.noun || []) {
  const w = e.lemma;
  if (nounByWord.has(w)) { skipped.n++; continue; }
  const tr = translations[w];
  const eng = clean(tr ? tr.english : "");
  if (!eng || isBadExtract(e, eng)) { skipped.n++; continue; }
  const article = (e.article || "der").split("/")[0];
  const modifiers = e.modifiers || [];
  const plural = w; // We don't have reliable plural extraction for A2
  const help = nounHelp(article, w, plural, modifiers);
  const entry = {
    word: w, article, plural, english: eng,
    rank: nextNounRank++, leipzigRank: null, manuallyAdded: true, source: SOURCE,
    articleHelp: help.articleHelp, pluralHelp: help.pluralHelp,
  };
  if (help.ruleId) entry.ruleId = help.ruleId;
  if (modifiers.includes("nur Pl.")) entry.pluraleTantum = true;
  nouns.push(entry);
  nounByWord.set(w, entry);
  added.n++;
}

for (const e of missing.verb || []) {
  const w = e.lemma;
  if (verbByWord.has(w)) { skipped.v++; continue; }
  if (adjByLower.has(w.toLowerCase())) { skipped.v++; continue; }
  const tr = translations[w];
  const eng = clean(tr ? tr.english : "");
  if (!eng || isBadExtract(e, eng)) { skipped.v++; continue; }
  const entry = { word: w, english: eng, rank: nextVerbRank++, irregular: false, source: SOURCE };
  verbs.push(entry);
  verbByWord.set(w, entry);
  added.v++;
}

for (const e of missing.adj || []) {
  const w = e.lemma;
  if (adjByWord.has(w)) { skipped.a++; continue; }
  if (adjByLower.has(w.toLowerCase())) { skipped.a++; continue; }
  if (verbByWord.has(w)) { skipped.a++; continue; }
  const tr = translations[w];
  const eng = clean(tr ? tr.english : "");
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

console.log(`Netzwerk A2: added ${added.n} nouns, ${added.v} verbs, ${added.a} adjectives`);
console.log(`  skipped: ${skipped.n}N + ${skipped.v}V + ${skipped.a}A`);
