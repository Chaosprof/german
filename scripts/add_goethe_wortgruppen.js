// Adds the Goethe Wortgruppenliste vocab to the bank and writes per-group
// deck files inside data/goethe-{a1,a2,b1}/, then merges the new words into
// the existing all.json deck for each level.
//
// Run after add_goethe_data.js (the alphabetical wordlist filler) and before
// build_goethe_decks.py (which already wrote all.json). This script will
// extend all.json in place.

const fs = require("fs");
const path = require("path");
const data = require("./goethe_wortgruppen_data.js");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const nounsData = readJson("data/nouns.json");
const verbsData = readJson("data/verbs.json");
const adjectivesData = readJson("data/adjectives.json");

const nouns = nounsData.nouns;
const verbs = verbsData.verbs;
const adjectives = adjectivesData.adjectives;

const byWord = (arr, key = "word") => new Map(arr.map((entry) => [entry[key], entry]));
const nounByWord = byWord(nouns);
const verbByWord = byWord(verbs);
const adjByWord = byWord(adjectives);

let nextNounRank = Math.max(...nouns.map((n) => n.rank || 0)) + 1;
let nextVerbRank = Math.max(...verbs.map((v) => v.rank || 0)) + 1;
let nextAdjRank = Math.max(...adjectives.map((a) => a.rank || 0)) + 1;

function nounHelp(article, word, plural, modifiers = []) {
  let articleHelp = "", pluralHelp = "", ruleId;
  const articlelessCountries = new Set(["Deutschland", "Österreich", "Luxemburg", "Europa", "Griechenland", "Finnland", "Mexiko"]);
  const articleCountriesDie = new Set(["Schweiz", "Türkei", "Ukraine"]);
  if (articlelessCountries.has(word)) { articleHelp = "Country and region names like Deutschland, Finnland, Mexiko, and Europa are normally used without an article. When an article is required, they are neuter: das Deutschland der 1990er."; pluralHelp = "Country and region names are normally singular only."; ruleId = "das.country_articleless"; }
  else if (articleCountriesDie.has(word)) { articleHelp = "Some country names are used with a fixed article. Feminine examples take die: die Türkei, die Schweiz, die Ukraine."; pluralHelp = "Country and region names are normally singular only."; ruleId = "die.country_with_article"; }
  else if (modifiers.includes("nur Pl.")) { articleHelp = "Plural-only noun (Pluralia tantum). It has no singular form and always uses die."; pluralHelp = "Plural-only noun (Pluralia tantum): there is no singular form to learn."; ruleId = article === "die" ? "die.plural_only" : undefined; }
  else if (word.endsWith("ung")) { articleHelp = "Suffix rule: -ung -> always die."; pluralHelp = "-en plural."; ruleId = "die.suffix_ung"; }
  else if (word.endsWith("heit") || word.endsWith("keit")) { articleHelp = "Suffix rule: -heit/-keit -> always die."; pluralHelp = plural === "—" ? "Singular-only." : "-en plural."; ruleId = word.endsWith("heit") ? "die.suffix_heit" : "die.suffix_keit"; }
  else if (word.endsWith("in")) { articleHelp = "Suffix pattern: -in/-erin -> die for female persons."; pluralHelp = "+nen plural."; ruleId = "die.suffix_in"; }
  else if (word.endsWith("schaft")) { articleHelp = "Suffix rule: -schaft -> always die."; pluralHelp = "-en plural."; ruleId = "die.suffix_schaft"; }
  else if (word.endsWith("e") && article === "die") { articleHelp = "Most -e nouns are die."; pluralHelp = plural && plural.endsWith("n") ? "+n plural for feminine -e nouns." : ""; ruleId = "die.suffix_e"; }
  if (modifiers.includes("nur Sg.") && !articlelessCountries.has(word) && !articleCountriesDie.has(word)) pluralHelp = "Singular-only.";
  return { articleHelp, pluralHelp, ruleId };
}

function ensureNoun(word, [article, plural, english, modifiers = []]) {
  if (nounByWord.has(word)) return false;
  const help = nounHelp(article, word, plural, modifiers);
  const entry = {
    word, article, plural, english,
    rank: nextNounRank++, leipzigRank: null, manuallyAdded: true, source: "goethe-wortgruppen",
    articleHelp: help.articleHelp, pluralHelp: help.pluralHelp,
  };
  if (help.ruleId) entry.ruleId = help.ruleId;
  if (modifiers.includes("nur Pl.")) entry.pluraleTantum = true;
  nouns.push(entry);
  nounByWord.set(word, entry);
  return true;
}

function ensureVerb(word, [english, irregular]) {
  if (verbByWord.has(word)) return false;
  const entry = { word, english, rank: nextVerbRank++, irregular: Boolean(irregular), source: "goethe-wortgruppen" };
  if (irregular) {
    entry.prateritum = irregular[0];
    entry.perfekt = irregular[1];
    entry.withSein = irregular[2];
  }
  verbs.push(entry);
  verbByWord.set(word, entry);
  return true;
}

function ensureAdj(word, english) {
  if (adjByWord.has(word)) return false;
  const entry = { word, english, rank: nextAdjRank++, leipzigRank: null, source: "goethe-wortgruppen" };
  adjectives.push(entry);
  adjByWord.set(word, entry);
  return true;
}

const counts = { nouns: 0, verbs: 0, adjectives: 0 };

// Add every base noun/verb/adj. The all.json deck and per-group decks
// reference these by word.
for (const dict of [
  data.FAMILY_BASE, data.TIME_OF_DAY_BASE, data.WEEKDAYS_BASE, data.MONTHS_BASE,
  data.SEASONS_BASE, data.TIME_UNITS_BASE, data.HOLIDAYS_BASE, data.CURRENCY_BASE,
  data.MEASURES_BASE, data.DIRECTIONS_BASE, data.COUNTRIES_BASE, data.NATIONALITIES_BASE,
  data.PROFESSIONS_A2_BASE, data.SCHOOL_A2_BASE,
  data.POLITICS_B1_BASE, data.ANIMALS_B1_BASE,
  data.ANGLICISMS_B1_NOUNS, data.NUMBERS_NOUNS,
]) {
  for (const [word, tup] of Object.entries(dict)) {
    if (ensureNoun(word, tup)) counts.nouns++;
  }
}

for (const [word, tup] of Object.entries(data.ANGLICISMS_B1_VERBS)) {
  if (ensureVerb(word, tup)) counts.verbs++;
}

for (const dict of [
  data.COLOURS_BASE_ADJ, data.DIRECTIONS_ADJ, data.TIME_ADV_BASE,
  data.FAMILY_STATUS_ADJ, data.ORDINALS_ADJ, data.NUMBERS_ADJ, data.FORMAT_ADJ,
  data.ANGLICISMS_B1_ADJ,
]) {
  for (const [word, eng] of Object.entries(dict)) {
    if (ensureAdj(word, eng)) counts.adjectives++;
  }
}

nounsData.meta.count = nouns.length;
verbsData.meta.count = verbs.length;
adjectivesData.meta.count = adjectives.length;
writeJson("data/nouns.json", nounsData);
writeJson("data/verbs.json", verbsData);
writeJson("data/adjectives.json", adjectivesData);
console.log(`Added: ${counts.nouns} nouns, ${counts.verbs} verbs, ${counts.adjectives} adjectives`);

// ----------------------------------------------------------------------
// Build per-group deck files.

const LEVELS = [
  { id: "a1", groups: data.A1_GROUPS, label: "Goethe A1", dir: "data/goethe-a1" },
  { id: "a2", groups: data.A2_GROUPS, label: "Goethe A2", dir: "data/goethe-a2" },
  { id: "b1", groups: data.B1_GROUPS, label: "Goethe B1", dir: "data/goethe-b1" },
];

const bankNouns = new Set(nouns.map((n) => n.word));
const bankVerbs = new Set(verbs.map((v) => v.word));
const bankAdjs = new Set(adjectives.map((a) => a.word));

function filterExisting(arr, set) {
  if (!arr) return [];
  const seen = new Set();
  const out = [];
  for (const w of arr) {
    if (!set.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

for (const lvl of LEVELS) {
  const dir = path.join(root, lvl.dir);
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = readJson(`${lvl.dir}/manifest.json`);
  // Drop any previously-generated wortgruppen entries so re-runs are idempotent.
  manifest.decks = manifest.decks.filter((ref) => !/^wortgruppen-/.test(ref.file));

  const newGroupRefs = [];
  const allUnion = { nouns: new Set(), verbs: new Set(), adjectives: new Set() };

  for (const group of lvl.groups) {
    const ns = filterExisting(group.nouns, bankNouns);
    const vs = filterExisting(group.verbs, bankVerbs);
    const as_ = filterExisting(group.adjectives, bankAdjs);
    if (!ns.length && !vs.length && !as_.length) continue;
    const file = `wortgruppen-${group.slug}.json`;
    const deck = {
      id: `goethe-${lvl.id}-wortgruppen-${group.slug}`,
      name: `${lvl.label} - ${group.name}`,
      shortName: group.name,
      lessonTitle: group.name,
      nouns: ns, verbs: vs, adjectives: as_,
    };
    writeJson(`${lvl.dir}/${file}`, deck);
    newGroupRefs.push({ file, id: deck.id, name: deck.name, kind: "wortgruppen" });
    for (const w of ns) allUnion.nouns.add(w);
    for (const w of vs) allUnion.verbs.add(w);
    for (const w of as_) allUnion.adjectives.add(w);
  }

  // Merge into all.json (preserve existing order; append unseen).
  const allPath = `${lvl.dir}/all.json`;
  const allDeck = readJson(allPath);
  const seenN = new Set(allDeck.nouns);
  const seenV = new Set(allDeck.verbs);
  const seenA = new Set(allDeck.adjectives);
  for (const w of allUnion.nouns) if (!seenN.has(w)) { allDeck.nouns.push(w); seenN.add(w); }
  for (const w of allUnion.verbs) if (!seenV.has(w)) { allDeck.verbs.push(w); seenV.add(w); }
  for (const w of allUnion.adjectives) if (!seenA.has(w)) { allDeck.adjectives.push(w); seenA.add(w); }
  writeJson(allPath, allDeck);

  // Re-order manifest: keep "all", insert wortgruppen group decks before
  // "irregular-verbs" so they appear together.
  const allRef = manifest.decks.find((r) => r.file === "all.json");
  const irrRef = manifest.decks.find((r) => r.file === "irregular-verbs.json");
  manifest.decks = [
    ...(allRef ? [allRef] : []),
    ...newGroupRefs,
    ...(irrRef ? [irrRef] : []),
  ];
  writeJson(`${lvl.dir}/manifest.json`, manifest);

  console.log(`${lvl.label}: wrote ${newGroupRefs.length} group decks; all.json now has ` +
    `${allDeck.nouns.length}N + ${allDeck.verbs.length}V + ${allDeck.adjectives.length}Adj.`);
}
