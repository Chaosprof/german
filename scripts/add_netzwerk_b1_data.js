// Add clean missing Netzwerk B1 OCR entries to the word bank.
//
// The B1 PDF body is OCR-only in this repo, so this script is deliberately
// conservative: it skips entries that still look like OCR damage after the
// parser's correction pass.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const SOURCE = "netzwerk-b1";
const missing = readJson("audit/nwn_b1_missing.json");
const germanWords = readJson("German-Words/data/all.json");
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

const gwByLemma = new Map(germanWords.map((e) => [e.lemma, e]));
const WHITELIST = new Set([
  "Urlaubsgruß", "Urlaubstyp", "Urlaubsplanung", "Wellnesshotel", "Fahrtzeit",
  "Reisebüro-Mitarbeiter", "Reisebüro-Mitarbeiterin", "Skibus",
  "Wellness-Bereich"
]);

function gwEnglish(word, fallback) {
  const entry = gwByLemma.get(word);
  const en = entry && entry.translations && entry.translations.en && entry.translations.en[0];
  return cleanEng(en || fallback);
}

function hasGwEnglish(word) {
  const entry = gwByLemma.get(word);
  return Boolean(entry && entry.translations && entry.translations.en && entry.translations.en[0]);
}

function cleanEng(eng) {
  return String(eng || "").replace(/^the\s+/i, "").trim();
}

function looksDamaged(word) {
  if (!word || word.length < 2) return true;
  if (/^[\-\w]*$/.test(word) && /^-/.test(word)) return true;
  if (/[qQ]/.test(word)) return true;
  if (/(?<!^)j/.test(word)) return true;
  if (/(uer|iu|ld|fg|mg|ngh|gnd|gll|gg|pp|cg|kg|öu|öus|öus|loa|kak)/i.test(word)) return true;
  if (/^(Alte|Smart|Kess|Grad|Lid|Dur)$/.test(word)) return true;
  return false;
}

function badEnglish(eng) {
  return !eng || /Netzwerk|Fremdsprach|Glossar|^\s*$/.test(eng);
}

function expandPlural(word, hint, modifiers) {
  if (modifiers && modifiers.includes("nur Sg.")) return "—";
  if (modifiers && modifiers.includes("nur Pl.")) return word;
  if (!hint) return word;
  const h = hint.trim();
  if (h === "-" || h === "–" || h === "—") return word;
  if (h.startsWith("..")) return word + h.slice(2);
  if (h.startsWith('"')) return word + h.slice(1).replace(/^-/, "");
  if (h.startsWith("-") || h.startsWith("–") || h.startsWith("—")) return word + h.slice(1);
  if (/^[A-ZÄÖÜ]/.test(h)) return h;
  return word;
}

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

let added = { n: 0, v: 0, a: 0 };
let skipped = { n: 0, v: 0, a: 0 };

for (const e of missing.noun || []) {
  const w = e.lemma;
  const gw = gwByLemma.get(w);
  const eligible = WHITELIST.has(w) || (gw && gw.type === "noun" && hasGwEnglish(w));
  const eng = gwEnglish(w, e.english);
  if (!eligible || nounByWord.has(w) || (!WHITELIST.has(w) && looksDamaged(w)) || badEnglish(eng) || /^to\b/i.test(eng)) { skipped.n++; continue; }
  const article = (e.article || "der").split("/")[0];
  const plural = expandPlural(w, e.plural_hint, e.modifiers || []);
  const help = nounHelp(article, w, plural, e.modifiers || []);
  const entry = { word: w, article, plural, english: eng, rank: nextNounRank++, leipzigRank: null, manuallyAdded: true, source: SOURCE, articleHelp: help.articleHelp, pluralHelp: help.pluralHelp };
  if (help.ruleId) entry.ruleId = help.ruleId;
  if ((e.modifiers || []).includes("nur Pl.")) entry.pluraleTantum = true;
  nouns.push(entry);
  nounByWord.set(w, entry);
  added.n++;
}

for (const e of missing.verb || []) {
  const w = e.lemma;
  const gw = gwByLemma.get(w);
  const eng = gwEnglish(w, e.english);
  if (!gw || gw.type !== "verb" || !hasGwEnglish(w) || verbByWord.has(w) || looksDamaged(w) || badEnglish(eng)) { skipped.v++; continue; }
  verbs.push({ word: w, english: eng, rank: nextVerbRank++, irregular: false, source: SOURCE });
  verbByWord.set(w, true);
  added.v++;
}

for (const e of missing.adj || []) {
  const w = e.lemma;
  const gw = gwByLemma.get(w);
  const eng = gwEnglish(w, e.english);
  if (!gw || !["adjective", "adverb"].includes(gw.type) || !hasGwEnglish(w) || adjByWord.has(w) || adjByLower.has(w.toLowerCase()) || looksDamaged(w) || badEnglish(eng)) { skipped.a++; continue; }
  if (verbByWord.has(w) || nounByWord.has(w)) { skipped.a++; continue; }
  adjs.push({ word: w, english: eng, rank: nextAdjRank++, leipzigRank: null, source: SOURCE });
  adjByWord.set(w, true);
  adjByLower.set(w.toLowerCase(), true);
  added.a++;
}

nounsData.meta.count = nouns.length;
verbsData.meta.count = verbs.length;
adjsData.meta.count = adjs.length;
writeJson("data/nouns.json", nounsData);
writeJson("data/verbs.json", verbsData);
writeJson("data/adjectives.json", adjsData);

console.log(`Netzwerk B1: added ${added.n} nouns, ${added.v} verbs, ${added.a} adjectives/adverbs`);
console.log(`  skipped as existing/damaged: ${skipped.n}N + ${skipped.v}V + ${skipped.a}A`);
