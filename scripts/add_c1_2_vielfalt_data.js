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

const SOURCE = "vielfalt-c1.2";

function nounHelp(article, word, plural, modifiers = []) {
  let articleHelp = "";
  let pluralHelp = "";
  let ruleId;
  if (word.endsWith("ung")) {
    articleHelp = "Suffix rule: -ung -> always die.";
    pluralHelp = "-en plural (die ...en).";
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
  "Asperger-Syndrom": ["das", "—", "Asperger syndrome", ["nur Sg."]],
  "AspergerSyndrom": ["das", "—", "Asperger syndrome", ["nur Sg."]],
  "Preis-LeistungsVerhältnis": ["das", "Preis-LeistungsVerhältnisse", "price-performance ratio"],
  "Pro-KopfEinkommen": ["das", "—", "per-capita income", ["nur Sg."]],
  "Work-LifeBalance": ["die", "—", "work-life balance", ["nur Sg."]],
  "Kontinuität": ["die", "—", "continuity", ["nur Sg."]],
  "Einzelperson": ["die", "Einzelpersonen", "individual person"],
  "Überschneidung": ["die", "Überschneidungen", "overlap/intersection"],
  "Ausgrenzung": ["die", "Ausgrenzungen", "exclusion/marginalisation"],
  "Konsumierende": ["der", "Konsumierenden", "consumer (gender-neutral)"],
  "Agrarbetrieb": ["der", "Agrarbetriebe", "agricultural enterprise"],
  "Öffentlichkeitsarbeit": ["die", "Öffentlichkeitsarbeiten", "public-relations work"],
  "Gleichgesinnte": ["der", "Gleichgesinnten", "like-minded person"],
  "Preis-Leistungs-Verhältnis": ["das", "Preis-Leistungs-Verhältnisse", "price-performance ratio"],
  "Mitfahrt": ["die", "Mitfahrten", "ride/lift (in someone's car)"],
  "Hochstimmung": ["die", "—", "high spirits/elation", ["nur Sg."]],
  "Glücksniveau": ["das", "—", "level of happiness", ["nur Sg."]],
  "Pro-Kopf-Einkommen": ["das", "—", "per-capita income", ["nur Sg."]],
  "Work-Life-Balance": ["die", "—", "work-life balance", ["nur Sg."]],
  "Entscheidungsfreiheit": ["die", "Entscheidungsfreiheiten", "freedom of choice"],
  "Urlaubsanspruch": ["der", "Urlaubsansprüche", "holiday entitlement"],
  "Urlaubstag": ["der", "Urlaubstage", "day of holiday"],
  "Infografik": ["die", "Infografiken", "infographic"],
  "Nettolohn": ["der", "Nettolöhne", "net wage"],
  "Sozialabgabe": ["die", "Sozialabgaben", "social-security contribution"],
  "Gerechtigkeitssinn": ["der", "—", "sense of justice", ["nur Sg."]],
  "Know-how": ["das", "—", "know-how/expertise", ["nur Sg."]],
  "Erklärvideo": ["das", "Erklärvideos", "explanatory video/tutorial"],
  "Rahmenbedingung": ["die", "Rahmenbedingungen", "general conditions/framework"],
  "Schnüffelei": ["die", "Schnüffeleien", "snooping/prying"],
  "Indiskretion": ["die", "—", "indiscretion", ["nur Sg."]],
  "Sensationslust": ["die", "—", "appetite for sensation", ["nur Sg."]],
  "Wissbegierde": ["die", "—", "thirst for knowledge", ["nur Sg."]],
  "Wissenserwerb": ["der", "—", "acquisition of knowledge", ["nur Sg."]],
  "Impulsvortrag": ["der", "Impulsvorträge", "keynote/impulse talk"],
  "Konnotation": ["die", "Konnotationen", "connotation"],
  "Erfolgsfaktor": ["der", "Erfolgsfaktoren", "success factor"],
  "Stresstoleranz": ["die", "—", "stress tolerance", ["nur Sg."]],
  "Bakteriologe": ["der", "Bakteriologen", "bacteriologist"],
  "Bakteriologin": ["die", "Bakteriologinnen", "bacteriologist (female)"],
  "Fragestellung": ["die", "Fragestellungen", "research question/issue"],
  "Fitnesstracker": ["der", "Fitnesstracker", "fitness tracker"],
  "Smarthome": ["das", "Smarthomes", "smart home"],
  "Sprachassistent": ["der", "Sprachassistenten", "voice assistant"],
  "Anti-Held": ["der", "Anti-Helden", "anti-hero"],
  "Schrottpresse": ["die", "Schrottpressen", "scrap-metal press/car crusher"],
  "Versandhändler": ["der", "Versandhändler", "mail-order retailer"],
  "Versandhändlerin": ["die", "Versandhändlerinnen", "mail-order retailer (female)"],
  "Missfallen": ["das", "—", "displeasure", ["nur Sg."]],
  "Polarstern": ["der", "Polarsterne", "polar star/Polaris"],
  "Walfänger": ["der", "Walfänger", "whaler/whale hunter"],
  "Walfängerin": ["die", "Walfängerinnen", "whaler (female)"],
  "Professur": ["die", "Professuren", "professorship"],
  "Polarforschung": ["die", "Polarforschungen", "polar research"],
  "Polarregion": ["die", "Polarregionen", "polar region"],
  "Antarktis": ["die", "—", "Antarctic", ["nur Sg."]],
  "U-Boot": ["das", "U-Boote", "submarine"],
  "Polarnacht": ["die", "Polarnächte", "polar night"],
  "Verwobenheit": ["die", "—", "interwovenness/entanglement", ["nur Sg."]],
  "Salatdressing": ["das", "Salatdressings", "salad dressing"],
  "Samenkorn": ["das", "Samenkörner", "seed/grain"],
  "Schärfegrad": ["der", "Schärfegrade", "level of spiciness"],
  "Meerrettich": ["der", "Meerrettiche", "horseradish"],
  "Tofu": ["der", "—", "tofu", ["nur Sg."]],
  "Brachfläche": ["die", "Brachflächen", "fallow land/wasteland"],
  "Grille": ["die", "Grillen", "cricket (insect); whim"],
};

const VERBS = {
  "dazusetzen": ["sit down (next to)/join", null],
  "dazustellen": ["place oneself next to/join", null],
  "vertiefen": ["deepen/explore further", null],
  "hinausschießen": ["overshoot/shoot beyond", ["schoss hinaus", "hinausgeschossen", false]],
  "beruhen": ["be based on", null],
  "bewirtschaften": ["manage/farm/cultivate", null],
  "übrigbleiben": ["be left over/remain", ["blieb übrig", "übriggeblieben", true]],
  "widerfahren": ["happen/befall", ["widerfuhr", "widerfahren", true]],
  "gleichsetzen": ["equate (with)", null],
  "hämmern": ["hammer/pound", null],
  "entfahren": ["slip out/escape (of utterance)", ["entfuhr", "entfahren", true]],
  "heranführen": ["introduce/bring closer to", null],
  "aneignen": ["acquire/learn (reflexive)", null],
  "zutreffen": ["apply/be true (of)", ["traf zu", "zugetroffen", false]],
  "verfahren": ["lose one's way (reflexive); proceed", ["verfuhr", "verfahren", false]],
  "surren": ["whirr/buzz", null],
  "anpflanzen": ["plant/grow", null],
  "bestreichen": ["spread/coat", ["bestrich", "bestrichen", false]],
  "einpinseln": ["brush/coat (with a brush)", null],
  "abschmecken": ["season to taste", null],
  "aufstocken": ["increase/top up", null],
  "zirpen": ["chirp", null],
  "schwernehmen": ["take to heart/take hard", ["nahm schwer", "schwergenommen", false]],
  "zuschieben": ["push (towards); pin (blame) on", ["schob zu", "zugeschoben", false]],
  "hinwegsehen": ["overlook/look past", ["sah hinweg", "hinweggesehen", false]],
  "hereinstecken": ["stick in/put in", null],
  "festhalten": ["hold on to/stick to", ["hielt fest", "festgehalten", false]],
};

const ADJECTIVES = {
  "aktivistisch": "activist (adj.)",
  "hierfür": "for this/for that",
  "wozu": "what for/why",
  "kostenintensiv": "cost-intensive/expensive",
  "hierzu": "regarding this/in addition to this",
  "zwecks": "for the purpose of",
  "unverkäuflich": "not for sale",
  "gelöst": "relaxed/at ease; solved",
  "unseriös": "untrustworthy/dubious",
  "garantiert": "guaranteed/definitely",
  "angestrengt": "strained/exerted",
  "ermutigend": "encouraging",
  "zweifelsohne": "without a doubt",
  "begreiflich": "understandable",
  "einleuchtend": "plausible/clear",
  "entschlussfreudig": "decisive",
  "wohlverdient": "well-earned",
  "netto": "net (after deductions)",
  "immerhin": "after all/at least",
  "erhebend": "uplifting",
  "darauflos": "straight ahead/without further ado",
  "zentnerschwer": "extremely heavy/leaden",
  "gekränkt": "offended/hurt",
  "achselzuckend": "with a shrug",
  "sooft": "whenever",
  "seither": "since then",
  "woraufhin": "whereupon",
  "indiskret": "indiscreet",
  "treibend": "driving (force)",
  "frustrierend": "frustrating",
  "hochdotiert": "highly endowed/well-paid",
  "hinsichtlich": "with regard to",
  "schwindend": "dwindling/diminishing",
  "überliefert": "passed down/handed down",
  "leerstehend": "vacant/empty",
  "verwundert": "astonished/puzzled",
  "gleichermaßen": "equally/in the same way",
  "gebunden": "bound/tied",
  "erhoben": "raised/elevated",
  "hochgewachsen": "tall/grown tall",
  "zugunsten": "in favour of",
};

const VP_COMBOS = [
  ["sich austauschen", "mit", "Dat", "exchange ideas with", "Wir tauschen uns mit Kolleg:innen aus."],
  ["sich einmischen", "in", "Akk", "interfere in", "Mische dich nicht in fremde Angelegenheiten ein."],
  ["anknüpfen", "an", "Akk", "build on/connect with", "Wir knüpfen an die Vorlesung an."],
  ["vorgehen", "gegen", "Akk", "take action against", "Die Polizei geht gegen die Demonstranten vor."],
  ["zurückblicken", "auf", "Akk", "look back on", "Sie blickt auf ihr Berufsleben zurück."],
  ["ausrichten", "an", "Dat", "align/orient towards", "Das Konzept richtet sich an Lehrkräften aus."],
  ["sich einbringen", "in", "Akk", "contribute to/get involved in", "Er bringt sich aktiv in das Projekt ein."],
  ["sich verlieren", "in", "Dat", "get lost in", "Sie verliert sich in Details."],
  ["glänzen", "mit", "Dat", "shine with/show off", "Er glänzt mit seinem Wissen."],
  ["heranführen", "an", "Akk", "introduce/lead up to", "Der Lehrer führt die Kinder an Mathematik heran."],
  ["ansetzen", "zu", "Dat", "start to/move to", "Sie setzt zu einer Antwort an."],
  ["sich wiederfinden", "in", "Dat", "find oneself in/relate to", "Viele finden sich in dieser Beschreibung wieder."],
  ["zutreffen", "auf", "Akk", "apply to/be true of", "Diese Aussage trifft auf alle zu."],
  ["übergehen", "zu", "Dat", "move on to", "Wir gehen jetzt zum nächsten Punkt über."],
  ["sich anfreunden", "mit", "Dat", "become friends with", "Sie freundet sich mit der Idee an."],
  ["sich auflehnen", "gegen", "Akk", "rebel against", "Die Jugend lehnt sich gegen die Tradition auf."],
  ["anregen", "zu", "Dat", "encourage/inspire to", "Der Film regt zum Nachdenken an."],
  ["experimentieren", "mit", "Dat", "experiment with", "Wir experimentieren mit Gewürzen."],
  ["belegen", "mit", "Dat", "cover/spread/document with", "Belegen Sie das Brot mit Käse."],
  ["hinwegsehen", "über", "Akk", "overlook/disregard", "Wir sehen über kleine Fehler hinweg."],
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

addDualSense("Like", 30100, [
  { article: "der", english: "like (e.g. social media)", plural: "Likes" },
  { article: "das", english: "like (e.g. social media)", plural: "Likes" },
]);
addDualSense("Level", 30101, [
  { article: "der", english: "level/stage", plural: "Level" },
  { article: "das", english: "level/stage", plural: "Level" },
]);
addDualSense("Flakon", 30102, [
  { article: "der", english: "(perfume) bottle/flacon", plural: "Flakons" },
  { article: "das", english: "(perfume) bottle/flacon", plural: "Flakons" },
]);
addDualSense("Kurkuma", 30103, [
  { article: "die", english: "turmeric", plural: "—" },
  { article: "das", english: "turmeric", plural: "—" },
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
console.log(`Verb prepositions added: ${VP_COMBOS.length}`);
