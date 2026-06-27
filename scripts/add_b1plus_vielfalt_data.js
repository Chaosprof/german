const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, data) => fs.writeFileSync(path.join(root, p), JSON.stringify(data, null, 2) + "\n");

const nounsData = readJson("data/nouns.json");
const verbsData = readJson("data/verbs.json");
const adjectivesData = readJson("data/adjectives.json");
const vpData = readJson("data/verbs-with-prepositions.json");
const dualData = readJson("data/dual-gender-nouns.json");

const nouns = nounsData.nouns;
const verbs = verbsData.verbs;
const adjectives = adjectivesData.adjectives;
const verbPreps = vpData.verbs;
const dualNouns = dualData.nouns;

const byWord = (arr, key = "word") => new Map(arr.map((entry) => [entry[key], entry]));
const nounByWord = byWord(nouns);
const verbByWord = byWord(verbs);
const adjByWord = byWord(adjectives);
const dualByWord = byWord(dualNouns);
const vpByKey = new Map(verbPreps.map((entry) => [`${entry.verb}|${entry.preposition}|${entry.case}`, entry]));

let nextNounRank = Math.max(...nouns.map((n) => n.rank || 0)) + 1;
let nextVerbRank = Math.max(...verbs.map((v) => v.rank || 0)) + 1;
let nextAdjRank = Math.max(...adjectives.map((a) => a.rank || 0)) + 1;
let nextVpRank = Math.max(...verbPreps.map((v) => v.rank || 0)) + 1;

const SOURCE = "vielfalt-b1+";

function nounHelp(article, word, plural, modifiers = []) {
  let articleHelp = "";
  let pluralHelp = "";
  let ruleId = undefined;
  if (word.endsWith("ung")) {
    articleHelp = "Suffix rule: -ung -> always die.";
    pluralHelp = "-en plural (die ...en). -ung nouns universally take -en.";
    ruleId = "die.suffix_ung";
  } else if (word.endsWith("heit") || word.endsWith("keit")) {
    articleHelp = `Suffix rule: -${word.endsWith("heit") ? "heit" : "keit"} -> always die.`;
    pluralHelp = plural === "—" ? "Used here as singular-only abstract noun." : "-en plural.";
    ruleId = word.endsWith("heit") ? "die.suffix_heit" : "die.suffix_keit";
  } else if (word.endsWith("in")) {
    articleHelp = "Suffix pattern: -in/-erin -> die for female person nouns.";
    pluralHelp = "+nen plural for feminine person nouns ending in -in.";
    ruleId = "die.suffix_in";
  } else if (word.endsWith("schaft")) {
    articleHelp = "Suffix rule: -schaft -> always die.";
    pluralHelp = "-en plural for -schaft nouns.";
    ruleId = "die.suffix_schaft";
  } else if (word.endsWith("e") && article === "die") {
    articleHelp = "Ending pattern: most nouns ending in -e are die.";
    pluralHelp = plural && plural.endsWith("n") ? "+n plural for feminine -e nouns." : "";
    ruleId = "die.suffix_e";
  }
  if (modifiers.includes("nur Pl.")) pluralHelp = "Plural-only noun (Plurale tantum).";
  if (modifiers.includes("nur Sg.")) pluralHelp = "Used here as singular-only.";
  return { articleHelp, pluralHelp, ruleId };
}

const NOUNS = {
  "Ranking": ["das", "Rankings", "ranking"],
  "Camping": ["das", "—", "camping", ["nur Sg."]],
  "Handlungsort": ["der", "Handlungsorte", "setting/place of action"],
  "Influencer": ["der", "Influencer", "influencer"],
  "Influencerin": ["die", "Influencerinnen", "influencer (female)"],
  "Müllbeutel": ["der", "Müllbeutel", "rubbish bag"],
  "Trinkflasche": ["die", "Trinkflaschen", "drinking bottle"],
  "Einkaufsmöglichkeit": ["die", "Einkaufsmöglichkeiten", "shopping option/place to shop"],
  "Dinner": ["das", "Dinners", "dinner (formal evening meal)"],
  "Einzeltisch": ["der", "Einzeltische", "single table/table for one"],
  "Zaziki": ["das", "Zazikis", "tzatziki (yoghurt-cucumber dip)"],
  "Beziehungsmodell": ["das", "Beziehungsmodelle", "relationship model"],
  "Schulden": ["die", "Schulden", "debts", ["nur Pl."]],
  "Plastikverbrauch": ["der", "—", "plastic consumption", ["nur Sg."]],
  "Wocheneinkauf": ["der", "Wocheneinkäufe", "weekly shopping"],
  "Alternative": ["die", "Alternativen", "alternative"],
  "Paketzusteller": ["der", "Paketzusteller", "parcel delivery person"],
  "Paketzustellerin": ["die", "Paketzustellerinnen", "parcel delivery person (female)"],
  "Fahrradkurier": ["der", "Fahrradkuriere", "bicycle courier"],
  "Fahrradkurierin": ["die", "Fahrradkurierinnen", "bicycle courier (female)"],
  "Paketzentrum": ["das", "Paketzentren", "parcel-distribution centre"],
  "Vinyl": ["das", "—", "vinyl (records)", ["nur Sg."]],
  "LP": ["die", "LPs", "LP/long-playing record"],
  "Langspielplatte": ["die", "Langspielplatten", "long-playing record"],
  "DJ": ["der", "DJs", "DJ/disc jockey"],
  "Nichtakademiker": ["der", "Nichtakademiker", "non-academic/person without a university degree"],
  "Nichtakademikerin": ["die", "Nichtakademikerinnen", "non-academic (female)"],
  "Studienbeginn": ["der", "—", "start of studies", ["nur Sg."]],
  "Schulzeit": ["die", "Schulzeiten", "school years/time at school"],
  "Arbeiterkind": ["das", "Arbeiterkinder", "working-class child"],
  "Realschule": ["die", "Realschulen", "secondary school (German Realschule)"],
  "Schultyp": ["der", "Schultypen", "type of school"],
  "Mittelschule": ["die", "Mittelschulen", "middle school"],
  "Werte": ["die", "Werte", "values (moral)", ["nur Pl."]],
  "Studierende": ["der", "Studierenden", "student (gender-neutral)"],
  "E-Auto": ["das", "E-Autos", "electric car"],
  "Stück": ["das", "Stücke", "piece; play (theatre)"],
};

// Plural ranking-quality nouns; some are also expressions but worth adding as nouns
const VERBS = {
  "weitergehen": ["continue/carry on", ["ging weiter", "weitergegangen", true]],
  "herumliegen": ["lie around (colloquial pejorative)", ["lag herum", "herumgelegen", false]],
  "ausräumen": ["clear out/empty", null],
  "zusammenwohnen": ["live together", null],
  "nachschauen": ["check/look up", null],
  "herumlaufen": ["run/walk around", ["lief herum", "herumgelaufen", true]],
};

const ADJECTIVES = {
  "gratis": "free of charge",
  "vorzugsweise": "preferably",
  "zuliebe": "for the sake of",
  "ohnehin": "anyway/in any case",
  "allerdings": "however/though/admittedly",
  "überhaupt": "at all/in general",
  "normalerweise": "normally/usually",
  "jeweils": "in each case/respectively",
  "solo": "solo/alone",
  "voraus": "ahead/in advance",
  "bio": "organic",
  "anfangs": "at first/initially",
  "seitdem": "since then",
  "schließlich": "finally/after all",
  "miteinander": "with one another/together",
  "mittlerweile": "by now/in the meantime",
  "füreinander": "for one another",
  "eingespielt": "well-rehearsed/well-coordinated",
  "ziemlich": "fairly/quite",
  "sauschwer": "extremely difficult (colloquial)",
  "extra": "extra/specially",
  "zwar": "admittedly/it is true that",
  "live": "live (broadcast)",
  "offline": "offline",
  "tagsüber": "during the daytime",
  "höchstens": "at most",
};

const NOUN_FIXES = {
  "Bauernhof": { plural: "Bauernhöfe" },
  "Sonnenaufgang": { plural: "Sonnenaufgänge" },
  "Hausarzt": { plural: "Hausärzte" },
  "Halbmarathon": { plural: "Halbmarathons" },
  "Picknick": { plural: "Picknicks" },
  "Beratungsstelle": { plural: "Beratungsstellen" },
  "Klimawandel": { plural: "—", pluralHelp: "Used here as singular-only: climate change." },
  "Unterstützung": { plural: "Unterstützungen" },
  "Abendgymnasium": { plural: "Abendgymnasien" },
  "Überraschung": { plural: "Überraschungen" },
  "Wort": { plural: "Wörter", pluralHelp: "die Wörter (isolated lexical items) vs. die Worte (a saying / connected words). The B1+ glossary uses Worte, which is also valid." },
};

const VP_COMBOS = [
  ["werben", "für", "Akk", "advertise/promote", "Sie wirbt für ein neues Produkt."],
  ["sich verstehen", "mit", "Dat", "get along with", "Er versteht sich gut mit seinen Kollegen."],
  ["umgehen", "mit", "Dat", "deal/handle", "Sie geht professionell mit Kritik um."],
  ["sich halten", "an", "Akk", "stick to/abide by", "Wir halten uns an die Regeln."],
];

function addNoun(word, article, plural, english, modifiers = []) {
  if (nounByWord.has(word)) return;
  const help = nounHelp(article, word, plural, modifiers);
  const entry = {
    word,
    article,
    plural,
    english,
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
  nounByWord.set(word, entry);
}

function addDualSense(word, rank, senses) {
  let entry = dualByWord.get(word);
  if (!entry) {
    entry = { word, genders: [], rank, leipzigRank: rank, bothInDrills: true };
    dualNouns.push(entry);
    dualByWord.set(word, entry);
  }
  entry.bothInDrills = true;
  for (const sense of senses) {
    const existing = entry.genders.find((g) => g.article === sense.article && g.plural === sense.plural);
    if (existing) Object.assign(existing, sense);
    else entry.genders.push({ singularOnly: false, pluralOnly: false, ...sense });
  }
}

for (const [word, [article, plural, english, modifiers = []]] of Object.entries(NOUNS)) {
  addNoun(word, article, plural, english, modifiers);
}

for (const [word, [english, irregular]] of Object.entries(VERBS)) {
  if (verbByWord.has(word)) continue;
  const entry = { word, english, rank: nextVerbRank++, irregular: Boolean(irregular), source: SOURCE };
  if (irregular) {
    entry.prateritum = irregular[0];
    entry.perfekt = irregular[1];
    entry.withSein = irregular[2];
  }
  verbs.push(entry);
  verbByWord.set(word, entry);
}

for (const [word, english] of Object.entries(ADJECTIVES)) {
  if (adjByWord.has(word)) continue;
  const entry = { word, english, rank: nextAdjRank++, leipzigRank: null, source: SOURCE };
  adjectives.push(entry);
  adjByWord.set(word, entry);
}

for (const [word, patch] of Object.entries(NOUN_FIXES)) {
  const entry = nounByWord.get(word);
  if (entry) Object.assign(entry, patch);
}

// Kajak and Download are dual-gender (der/das)
addDualSense("Kajak", 30000, [
  { article: "der", english: "kayak", plural: "Kajaks" },
  { article: "das", english: "kayak", plural: "Kajaks" },
]);
addDualSense("Download", 30001, [
  { article: "der", english: "download", plural: "Downloads" },
  { article: "das", english: "download", plural: "Downloads" },
]);

for (const [verb, preposition, cas, english, example] of VP_COMBOS) {
  const key = `${verb}|${preposition}|${cas}`;
  if (vpByKey.has(key)) continue;
  const entry = { verb, preposition, case: cas, english, example, rank: nextVpRank++, source: SOURCE };
  verbPreps.push(entry);
  vpByKey.set(key, entry);
}

nounsData.meta.count = nouns.length;
verbsData.meta.count = verbs.length;
adjectivesData.meta.count = adjectives.length;
vpData.meta.count = verbPreps.length;
dualData.meta.count = dualNouns.length;

writeJson("data/nouns.json", nounsData);
writeJson("data/verbs.json", verbsData);
writeJson("data/adjectives.json", adjectivesData);
writeJson("data/verbs-with-prepositions.json", vpData);
writeJson("data/dual-gender-nouns.json", dualData);

console.log(`Added: ${Object.keys(NOUNS).length} nouns, ${Object.keys(VERBS).length} verbs, ${Object.keys(ADJECTIVES).length} adjectives`);
console.log(`Patched: ${Object.keys(NOUN_FIXES).length} noun fixes`);
console.log(`Verb prepositions added: ${VP_COMBOS.length}`);
