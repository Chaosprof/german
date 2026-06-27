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
const vpByKey = new Map(verbPreps.map((entry) => [`${entry.verb}|${entry.preposition}`, entry]));
const dualByWord = byWord(dualNouns);

let nextNounRank = Math.max(...nouns.map((n) => n.rank || 0)) + 1;
let nextVerbRank = Math.max(...verbs.map((v) => v.rank || 0)) + 1;
let nextAdjRank = Math.max(...adjectives.map((a) => a.rank || 0)) + 1;
let nextVpRank = Math.max(...verbPreps.map((v) => v.rank || 0)) + 1;

const SOURCE = "vielfalt-b2.2";

function nounHelp(article, word, plural, modifiers = []) {
  let articleHelp = "";
  let pluralHelp = "";
  let ruleId = undefined;
  if (word.endsWith("ung")) {
    articleHelp = "Suffix rule: -ung → always die.";
    pluralHelp = "-en plural (die ...en). -ung nouns universally take -en.";
    ruleId = "die.suffix_ung";
  } else if (word.endsWith("heit") || word.endsWith("keit")) {
    articleHelp = `Suffix rule: -${word.endsWith("heit") ? "heit" : "keit"} → always die.`;
    pluralHelp = plural === "—" ? "Usually abstract; this textbook uses it as singular-only." : "-en plural.";
    ruleId = word.endsWith("heit") ? "die.suffix_heit" : "die.suffix_keit";
  } else if (word.endsWith("ismus")) {
    articleHelp = "Suffix rule: -ismus → always der.";
    pluralHelp = plural === "—" ? "Used here as singular-only." : "-en plural for this -ismus noun.";
    ruleId = "der.suffix_ismus";
  } else if (word.endsWith("in")) {
    articleHelp = "Suffix pattern: -in/-erin → die for female person nouns.";
    pluralHelp = "+nen plural for feminine person nouns ending in -in.";
    ruleId = "die.suffix_in";
  } else if (word.endsWith("ie")) {
    articleHelp = "Ending pattern: stressed -ie nouns are usually die.";
    pluralHelp = plural === "—" ? "Used here as singular-only." : "-n plural.";
    ruleId = "die.suffix_ie";
  } else if (word.endsWith("e") && article === "die") {
    articleHelp = "Ending pattern: most nouns ending in -e are die.";
    pluralHelp = plural && plural.endsWith("n") ? "+n plural for feminine -e nouns." : "";
    ruleId = "die.suffix_e";
  }
  if (modifiers.includes("nur Pl.")) pluralHelp = "Plural-only noun (Plurale tantum).";
  if (modifiers.includes("nur Sg.")) pluralHelp = "Singular-only in the textbook sense.";
  return { articleHelp, pluralHelp, ruleId };
}

const NOUNS = {
  "Lastenrad": ["das", "Lastenräder", "cargo bike"],
  "Design-Objekt": ["das", "Design-Objekte", "design object"],
  "Start-up": ["das", "Start-ups", "start-up"],
  "Geschäftsidee": ["die", "Geschäftsideen", "business idea"],
  "Verkaufsleiterin": ["die", "Verkaufsleiterinnen", "sales manager (female)"],
  "Konkurrenzanalyse": ["die", "Konkurrenzanalysen", "competitor analysis"],
  "Finanzplan": ["der", "Finanzpläne", "financial plan"],
  "Bürgerversammlung": ["die", "Bürgerversammlungen", "citizens' meeting"],
  "Stille": ["die", "—", "silence/stillness", ["nur Sg."]],
  "Lichtsignal": ["das", "Lichtsignale", "light signal"],
  "Gezwitscher": ["das", "—", "chirping/twittering", ["nur Sg."]],
  "Hilfsangebot": ["das", "Hilfsangebote", "offer of help"],
  "Laut": ["der", "Laute", "sound/phonetic sound"],
  "Diversitätsmanager": ["der", "Diversitätsmanager", "diversity manager"],
  "Diversitätsmanagement": ["das", "Diversitätsmanagements", "diversity management"],
  "Informationsmaterial": ["das", "Informationsmaterialien", "information material"],
  "Elternurlaub": ["der", "Elternurlaube", "parental leave"],
  "Bewerbungsunterlagen": ["die", "Bewerbungsunterlagen", "application documents", ["nur Pl."]],
  "Felsenwand": ["die", "Felsenwände", "rock face/cliff wall"],
  "Handlungsempfehlung": ["die", "Handlungsempfehlungen", "recommendation for action"],
  "Urteilsfindung": ["die", "Urteilsfindungen", "process of reaching a judgement"],
  "Elternhaus": ["das", "Elternhäuser", "parental home/family home"],
  "Unmenschlichkeit": ["die", "Unmenschlichkeiten", "inhumanity"],
  "Verstecken": ["das", "—", "hiding/hide-and-seek", ["nur Sg."]],
  "Innovationsmotor": ["der", "Innovationsmotoren", "driver of innovation"],
  "Berufsfeld": ["das", "Berufsfelder", "professional field"],
  "Soziale Arbeit": ["die", "—", "social work", ["nur Sg."]],
  "Medienwissenschaftler": ["der", "Medienwissenschaftler", "media studies scholar"],
  "Grafikdesigner": ["der", "Grafikdesigner", "graphic designer"],
  "Mediengestalter": ["der", "Mediengestalter", "media designer"],
  "Quereinstieg": ["der", "Quereinstiege", "career change/lateral entry"],
  "Masterarbeit": ["die", "Masterarbeiten", "master's thesis"],
  "Rundfunksender": ["der", "Rundfunksender", "radio/TV broadcaster"],
  "Revuetheater": ["das", "Revuetheater", "revue theatre"],
  "Stummfilm": ["der", "Stummfilme", "silent film"],
  "Außergewöhnliche": ["das", "—", "the extraordinary thing/aspect", ["nur Sg."]],
};

const VERBS = {
  "nachwachsen": ["grow back/regrow", ["wuchs nach", "nachgewachsen", true]],
  "schämen": ["be ashamed", null],
  "mitgeben": ["give along/give to take with", ["gab mit", "mitgegeben", false]],
  "vorspielen": ["play/perform for someone; pretend", null],
  "erschließen": ["open up/make accessible; infer", ["erschloss", "erschlossen", false]],
  "einleuchten": ["make sense/be obvious", null],
  "beschreiten": ["take/follow (a path)", null],
  "aufpoppen": ["pop up", null],
  "danebengehen": ["go wrong/miss the mark", ["ging daneben", "danebengegangen", true]],
  "hineinversetzen": ["put oneself into/empathise with", null],
  "nachempfinden": ["empathise with/understand emotionally", ["empfand nach", "nachempfunden", false]],
  "weiterempfehlen": ["recommend on/recommend to others", ["empfahl weiter", "weiterempfohlen", false]],
  "zusammenhalten": ["stick together/hold together", ["hielt zusammen", "zusammengehalten", false]],
  "herumprobieren": ["try things out/experiment around", null],
  "vorweisen": ["show/present/produce", ["wies vor", "vorgewiesen", false]],
  "zujubeln": ["cheer for/acclaim", null],
};

const ADJECTIVES = {
  "gekleidet": "dressed/clothed",
  "daraufhin": "after that/thereupon",
  "bestehend": "existing/current",
  "regierend": "governing/ruling",
  "sicherlich": "certainly/surely",
  "irritiert": "irritated/confused",
  "angespannt": "tense/strained",
  "isoliert": "isolated",
  "keineswegs": "by no means/not at all",
  "sozusagen": "so to speak",
  "jedenfalls": "in any case/at any rate",
  "einigermaßen": "reasonably/somewhat",
  "zufolge": "according to",
  "zutiefst": "deeply/profoundly",
  "kennzeichnend": "characteristic/distinctive",
  "üblicherweise": "usually/typically",
  "verletzend": "hurtful/offensive",
  "anonymisiert": "anonymised",
  "irritierend": "irritating/confusing",
  "irgendwas": "something/anything",
  "irgendwie": "somehow",
  "entspannt": "relaxed",
  "genervt": "annoyed",
  "vielmehr": "rather/on the contrary",
  "soweit": "as far as/so far",
  "inwiefern": "in what respect/to what extent",
  "insofern": "in this respect/to that extent",
  "beispielsweise": "for example",
  "keinerlei": "no/not any",
  "geltend": "valid/applicable",
  "bedrückend": "oppressive/depressing",
  "bislang": "so far/up to now",
};

const VP_COMBOS = [
  ["sich abheben", "von", "Dat", "stand out from / differ from", "Unser Modell hebt sich von der Konkurrenz ab."],
  ["unterscheiden", "von", "Dat", "distinguish from / differ from", "Dieses Merkmal unterscheidet das Produkt von anderen."],
  ["begeistern", "für", "Akk", "inspire / excite someone about", "Der Vortrag begeisterte viele für das Projekt."],
  ["sich entscheiden", "zwischen", "Dat", "choose between", "Wir entscheiden uns zwischen zwei Möglichkeiten."],
  ["kämpfen", "mit", "Dat", "struggle with", "Er kämpft mit großen Schwierigkeiten."],
  ["reden", "mit", "Dat", "talk with/to", "Sie redet mit ihrer Freundin."],
  ["sich verständigen", "mit", "Dat", "communicate with", "Sie verständigen sich mit den Nachbarn."],
  ["ansprechen", "auf", "Akk", "speak to someone about / raise with", "Sie spricht ihn auf das Problem an."],
  ["urteilen", "über", "Akk", "judge / form an opinion about", "Man sollte nicht vorschnell über andere urteilen."],
  ["einwenden", "gegen", "Akk", "object to / raise against", "Was wendest du gegen diesen Vorschlag ein?"],
  ["stehen", "zu", "Dat", "stand by / admit to", "Sie steht zu ihrer Entscheidung."],
  ["aufrufen", "zu", "Dat", "call for / appeal for", "Die Initiative ruft zu mehr Engagement auf."],
  ["gelangen", "in", "Akk", "get into / reach", "Die Daten gelangen in das System."],
  ["stehen", "für", "Akk", "stand for / represent", "Die Zwanzigerjahre stehen für Aufbruch und Lebensfreude."],
];

const TRANSLATION_FIXES = {
  nouns: {
    "Subjektivität": "subjectivity",
    "Außenseiterin": "outsider (female)",
    "Aufbruch": "departure/new beginning/awakening",
  },
  verbs: {
    "ausmalen": "colour in; imagine/picture",
  },
};

const NOUN_FIXES = {
  "Schulbildung": { plural: "Schulbildungen", english: "school education" },
  "Barrierefreiheit": { plural: "Barrierefreiheiten" },
  "Filmindustrie": { plural: "Filmindustrien" },
  "Auffassungsgabe": { plural: "Auffassungsgaben" },
  "Tournee": { plural: "Tourneen" },
  "Lebensfreude": { plural: "Lebensfreuden" },
  "Rost": { plural: "—", english: "rust", pluralHelp: "Used here as singular-only: der Rost (rust)." },
  "Unruhe": { plural: "—", pluralHelp: "Used here as singular-only: die Unruhe (restlessness/unrest as a state)." },
  "Gehör": { plural: "—", pluralHelp: "Used here as singular-only: das Gehör (hearing)." },
  "Toleranz": { plural: "—", pluralHelp: "Used here as singular-only: tolerance." },
  "Analphabetismus": { plural: "—", pluralHelp: "Used here as singular-only: illiteracy." },
  "Islam": { plural: "—", pluralHelp: "Used here as singular-only: Islam." },
  "Rassismus": { plural: "—", pluralHelp: "Used here as singular-only: racism." },
  "Dankbarkeit": { plural: "—", pluralHelp: "Used here as singular-only: gratitude." },
  "Antike": { plural: "—", pluralHelp: "Used here as singular-only: antiquity/the ancient world." },
  "Lauf": { plural: "—", pluralHelp: "Used here in the fixed sense der Lauf (course/progress), singular-only." },
};

for (const [word, [article, plural, english, modifiers = []]] of Object.entries(NOUNS)) {
  if (nounByWord.has(word)) continue;
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

for (const [word, [english, irregular]] of Object.entries(VERBS)) {
  if (verbByWord.has(word)) continue;
  const entry = {
    word,
    english,
    rank: nextVerbRank++,
    irregular: Boolean(irregular),
    source: SOURCE,
  };
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

for (const [word, english] of Object.entries(TRANSLATION_FIXES.nouns)) {
  const entry = nounByWord.get(word);
  if (entry) entry.english = english;
}
for (const [word, english] of Object.entries(TRANSLATION_FIXES.verbs)) {
  const entry = verbByWord.get(word);
  if (entry) entry.english = english;
}

for (const [word, patch] of Object.entries(NOUN_FIXES)) {
  const entry = nounByWord.get(word);
  if (!entry) continue;
  Object.assign(entry, patch);
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

addDualSense("Weise", 165, [
  { article: "der", english: "sage/wise man", plural: "Weisen", singularOnly: false, pluralOnly: false },
  { article: "die", english: "way/manner", plural: "Weisen", singularOnly: false, pluralOnly: false },
]);
const postDual = dualByWord.get("Post");
if (postDual) postDual.bothInDrills = true;

for (const [verb, preposition, cas, english, example] of VP_COMBOS) {
  const key = `${verb}|${preposition}`;
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

console.log(`Added/ensured B2.2 data. Counts: nouns=${nouns.length}, verbs=${verbs.length}, adjectives=${adjectives.length}, vp=${verbPreps.length}, dual=${dualNouns.length}`);
