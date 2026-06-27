const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, data) => fs.writeFileSync(path.join(root, p), JSON.stringify(data, null, 2) + "\n");

const nounsData = readJson("data/nouns.json");
const verbsData = readJson("data/verbs.json");
const adjectivesData = readJson("data/adjectives.json");
const dualData = readJson("data/dual-gender-nouns.json");

const nouns = nounsData.nouns;
const verbs = verbsData.verbs;
const adjectives = adjectivesData.adjectives;
const dualNouns = dualData.nouns;

const byWord = (arr, key = "word") => new Map(arr.map((entry) => [entry[key], entry]));
const nounByWord = byWord(nouns);
const verbByWord = byWord(verbs);
const adjByWord = byWord(adjectives);
const dualByWord = byWord(dualNouns);

let nextNounRank = Math.max(...nouns.map((n) => n.rank || 0)) + 1;
let nextVerbRank = Math.max(...verbs.map((v) => v.rank || 0)) + 1;
let nextAdjRank = Math.max(...adjectives.map((a) => a.rank || 0)) + 1;

function nounHelp(article, word, plural, modifiers = []) {
  let articleHelp = "";
  let pluralHelp = "";
  let ruleId;
  if (word.endsWith("ung")) { articleHelp = "Suffix rule: -ung -> always die."; pluralHelp = "-en plural."; ruleId = "die.suffix_ung"; }
  else if (word.endsWith("heit") || word.endsWith("keit")) { articleHelp = "Suffix rule: -heit/-keit -> always die."; pluralHelp = "-en plural."; ruleId = word.endsWith("heit") ? "die.suffix_heit" : "die.suffix_keit"; }
  else if (word.endsWith("in")) { articleHelp = "Suffix pattern: -in/-erin -> die for female persons."; pluralHelp = "+nen plural."; ruleId = "die.suffix_in"; }
  else if (word.endsWith("schaft")) { articleHelp = "Suffix rule: -schaft -> always die."; pluralHelp = "-en plural."; ruleId = "die.suffix_schaft"; }
  else if (word.endsWith("e") && article === "die") { articleHelp = "Most -e nouns are die."; pluralHelp = plural && plural.endsWith("n") ? "+n plural for feminine -e nouns." : ""; ruleId = "die.suffix_e"; }
  if (modifiers.includes("nur Pl.")) pluralHelp = "Plural-only noun (Plurale tantum).";
  if (modifiers.includes("nur Sg.")) pluralHelp = "Singular-only.";
  return { articleHelp, pluralHelp, ruleId };
}

// Combined nouns from Goethe A1, A2, B1 plus regional Swiss/Austrian forms.
const NOUNS = {
  // A1
  "Café": ["das", "Cafés", "café"],
  "CD": ["die", "CDs", "CD"],
  "E-Mail": ["die", "E-Mails", "email"],
  "Großeltern": ["die", "Großeltern", "grandparents", ["nur Pl."]],
  "Hausmann": ["der", "Hausmänner", "house husband/stay-at-home father"],
  "Lkw": ["der", "Lkws", "lorry/truck (Lastkraftwagen)"],
  "Papiere": ["die", "Papiere", "documents/papers", ["nur Pl."]],
  "Partnerin": ["die", "Partnerinnen", "partner (female)"],
  "S-Bahn": ["die", "S-Bahnen", "city/suburban train"],
  "Wiederhören": ["das", "—", "hearing again (auf Wiederhören = goodbye on phone)", ["nur Sg."]],
  // A2
  "Schweiz": ["die", "—", "Switzerland", ["nur Sg."]],
  "Blatt": ["das", "Blätter", "leaf; sheet (of paper)"],
  "Club": ["der", "Clubs", "club"],
  "E-Book": ["das", "E-Books", "e-book"],
  "T-Shirt": ["das", "T-Shirts", "T-shirt"],
  "Süßigkeiten": ["die", "Süßigkeiten", "sweets/candy", ["nur Pl."]],
  "Fernseher": ["der", "Fernseher", "television set"],
  "Paar": ["das", "Paare", "pair; couple"],
  "Kenntnisse": ["die", "Kenntnisse", "knowledge/skills (in sth.)", ["nur Pl."]],
  "Fundsachen": ["die", "Fundsachen", "lost-and-found items", ["nur Pl."]],
  // B1: standard German + Austrian/Swiss variants
  "Antwortbogen": ["der", "Antwortbögen", "answer sheet"],
  "Textaufbau": ["der", "Textaufbauten", "text structure"],
  "Bundespräsidentin": ["die", "Bundespräsidentinnen", "federal president (female)"],
  "Absenderin": ["die", "Absenderinnen", "sender (female)"],
  "Bancomat": ["der", "Bancomaten", "ATM (Swiss usage)"],
  "Buffet": ["das", "Buffets", "buffet"],
  "Coiffeur": ["der", "Coiffeure", "hairdresser (Swiss)"],
  "Coiffeuse": ["die", "Coiffeusen", "hairdresser (Swiss, female)"],
  "Faschierte": ["das", "—", "minced meat (Austrian)", ["nur Sg."]],
  "Hausmeisterin": ["die", "Hausmeisterinnen", "caretaker/janitor (female)"],
  "Jause": ["die", "Jausen", "snack (Austrian)"],
  "Müesli": ["das", "Müesli", "muesli (Swiss)"],
  "Ober": ["der", "Ober", "waiter (Austrian)"],
  "Pensionist": ["der", "Pensionisten", "pensioner/retiree (Austrian)"],
  "Personalien": ["die", "Personalien", "personal details", ["nur Pl."]],
  "Personenstand": ["der", "—", "marital/civil status", ["nur Sg."]],
  "Pöstler": ["der", "Pöstler", "postman (Swiss)"],
  "Poulet": ["das", "Poulets", "chicken (Swiss)"],
  "Profisportlerin": ["die", "Profisportlerinnen", "professional athlete (female)"],
  "Rüebli": ["das", "Rüebli", "carrot (Swiss)"],
  "Rufnummer": ["die", "Rufnummern", "phone number"],
  "Schwammerl": ["das", "Schwammerl", "mushroom (Austrian/Bavarian)"],
  "Senioren": ["die", "Senioren", "senior citizens", ["nur Pl."]],
  "Serviceangestellte": ["die", "Serviceangestellten", "service employee (gender-neutral)"],
  "U-Bahn": ["die", "U-Bahnen", "underground/subway"],
  "Vertreterin": ["die", "Vertreterinnen", "representative (female)"],
  "Zutaten": ["die", "Zutaten", "ingredients", ["nur Pl."]],
  "Getränke": ["die", "Getränke", "drinks/beverages", ["nur Pl."]],
  "Wohnungen": ["die", "Wohnungen", "flats/apartments", ["nur Pl."]],
  "Bankomat-Karte": ["die", "Bankomat-Karten", "ATM card (Austrian)"],
  "Betriebsrätin": ["die", "Betriebsrätinnen", "works-council member (female)"],
  "Billett": ["das", "Billette", "ticket (Swiss)"],
  "Briefträger": ["der", "Briefträger", "postman/letter carrier"],
  "Brötli": ["das", "Brötli", "bread roll (Swiss)"],
  "Couvert": ["das", "Couverts", "envelope (Swiss)"],
  "Doktorin": ["die", "Doktorinnen", "doctor (female)"],
  "Einbrecherin": ["die", "Einbrecherinnen", "burglar (female)"],
  "Erdapfel": ["der", "Erdäpfel", "potato (Austrian)"],
  "Steuern": ["die", "Steuern", "taxes", ["nur Pl."]],
  "Fachleute": ["die", "Fachleute", "experts/specialists", ["nur Pl."]],
  "Fasnacht": ["die", "—", "carnival (Swiss/southern German)", ["nur Sg."]],
  "Fauteuil": ["der", "Fauteuils", "armchair (Swiss)"],
  "Fleischhauer": ["der", "Fleischhauer", "butcher (Austrian)"],
  "Fleischhauerin": ["die", "Fleischhauerinnen", "butcher (Austrian, female)"],
  "Führerausweis": ["der", "Führerausweise", "driving licence (Swiss)"],
  "Gehsteig": ["der", "Gehsteige", "pavement/sidewalk (Austrian)"],
  "Händlerin": ["die", "Händlerinnen", "trader/dealer (female)"],
  "Hinweise": ["die", "Hinweise", "tips/clues/instructions", ["nur Pl."]],
  "Journalistin": ["die", "Journalistinnen", "journalist (female)"],
  "Kuli": ["der", "Kulis", "ballpoint pen (colloquial)"],
  "Lernerin": ["die", "Lernerinnen", "learner (female)"],
  "Leiterin": ["die", "Leiterinnen", "head/leader (female)"],
  "Matura": ["die", "—", "school-leaving exam (Austrian/Swiss)", ["nur Sg."]],
  "Mechanikerin": ["die", "Mechanikerinnen", "mechanic (female)"],
  "Marille": ["die", "Marillen", "apricot (Austrian)"],
  "Migrantin": ["die", "Migrantinnen", "migrant (female)"],
  "Mobilbox": ["die", "Mobilboxen", "voicemail box"],
  "Mobilität": ["die", "—", "mobility", ["nur Sg."]],
  "Nichtraucherin": ["die", "Nichtraucherinnen", "non-smoker (female)"],
  "Paradeiser": ["der", "Paradeiser", "tomato (Austrian)"],
  "Passagierin": ["die", "Passagierinnen", "passenger (female)"],
  "Phantasie": ["die", "Phantasien", "imagination (older spelling of Fantasie)"],
  "Perron": ["der", "Perrons", "platform (Swiss)"],
  "Schularbeit": ["die", "Schularbeiten", "school test (Austrian)"],
  "Speisewagen": ["der", "Speisewagen", "dining car"],
  "Donau": ["die", "—", "Danube (river)", ["nur Sg."]],
  "Steward": ["der", "Stewards", "steward/flight attendant"],
  "Stiegenhaus": ["das", "Stiegenhäuser", "stairwell (Austrian)"],
  "Trottoir": ["das", "Trottoirs", "pavement (Swiss)"],
  "Unternehmerin": ["die", "Unternehmerinnen", "entrepreneur (female)"],
  "Velo": ["das", "Velos", "bicycle (Swiss)"],
  "Verbrecherin": ["die", "Verbrecherinnen", "criminal (female)"],
  "Versichertenkarte": ["die", "Versichertenkarten", "health-insurance card"],
  "Verliererin": ["die", "Verliererinnen", "loser (female)"],
  "Zahncreme": ["die", "Zahncremes", "toothpaste"],
  "Zinsen": ["die", "Zinsen", "interest (financial)", ["nur Pl."]],
  "Zivilstand": ["der", "—", "civil/marital status (Swiss)", ["nur Sg."]],
  "Zünder": ["der", "Zünder", "fuse/igniter; match (Austrian)"],
  "Zündholz": ["das", "Zündhölzer", "match (Swiss)"],
};

const VERBS = {
  "regnen": ["rain", null],
  "beeilen": ["hurry (reflexive)", null],
  "parkieren": ["park (Swiss)", null],
  "grillieren": ["grill (Swiss)", null],
  "hageln": ["hail (weather)", null],
};

const ADJECTIVES = {
  "draußen": "outside",
  "drinnen": "inside (within)",
  "drüben": "over there",
  "daneben": "next to it",
  "gestern": "yesterday",
  "heute": "today",
  "morgen": "tomorrow",
  "übermorgen": "the day after tomorrow",
  "vorgestern": "the day before yesterday",
  "oben": "above/upstairs",
  "unten": "below/downstairs",
  "vorne": "in front",
  "hinten": "at the back/behind",
  "innen": "inside (interior)",
  "außen": "outside (exterior)",
  "links": "left/on the left",
  "rechts": "right/on the right",
  "geradeaus": "straight ahead",
  "zusammen": "together",
  "bisschen": "a little (ein bisschen)",
  "wegen": "because of (with Gen./Dat.)",
  "neben": "next to (preposition)",
  "zwischen": "between",
  "gegen": "against",
  "gern": "gladly",
  "mitten": "in the middle",
  "deswegen": "for this reason/therefore",
  "meinetwegen": "for my sake/as far as I'm concerned",
  "inzwischen": "in the meantime",
  "sondern": "but rather (after a negation)",
};

// Dual-gender nouns
const DUAL = [
  ["Klub", 9000, [
    { article: "der", english: "club (alt. spelling of Club)", plural: "Klubs" },
  ]],
];

function addNoun(word, article, plural, english, modifiers = []) {
  if (nounByWord.has(word)) return;
  const help = nounHelp(article, word, plural, modifiers);
  const entry = {
    word, article, plural, english,
    rank: nextNounRank++, leipzigRank: null, manuallyAdded: true, source: "goethe-wordlist",
    articleHelp: help.articleHelp, pluralHelp: help.pluralHelp,
  };
  if (help.ruleId) entry.ruleId = help.ruleId;
  if (modifiers.includes("nur Pl.")) entry.pluraleTantum = true;
  nouns.push(entry);
  nounByWord.set(word, entry);
}

let addedN = 0, addedV = 0, addedA = 0;
for (const [word, [article, plural, english, modifiers = []]] of Object.entries(NOUNS)) {
  if (!nounByWord.has(word)) { addNoun(word, article, plural, english, modifiers); addedN++; }
}
for (const [word, [english, irregular]] of Object.entries(VERBS)) {
  if (verbByWord.has(word)) continue;
  const entry = { word, english, rank: nextVerbRank++, irregular: Boolean(irregular), source: "goethe-wordlist" };
  if (irregular) {
    entry.prateritum = irregular[0];
    entry.perfekt = irregular[1];
    entry.withSein = irregular[2];
  }
  verbs.push(entry);
  verbByWord.set(word, entry);
  addedV++;
}
for (const [word, english] of Object.entries(ADJECTIVES)) {
  if (adjByWord.has(word)) continue;
  const entry = { word, english, rank: nextAdjRank++, leipzigRank: null, source: "goethe-wordlist" };
  adjectives.push(entry);
  adjByWord.set(word, entry);
  addedA++;
}

nounsData.meta.count = nouns.length;
verbsData.meta.count = verbs.length;
adjectivesData.meta.count = adjectives.length;

writeJson("data/nouns.json", nounsData);
writeJson("data/verbs.json", verbsData);
writeJson("data/adjectives.json", adjectivesData);

console.log(`Added: ${addedN} nouns, ${addedV} verbs, ${addedA} adjectives`);
