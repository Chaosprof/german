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

const SOURCE = "vielfalt-b2.1";

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
    pluralHelp = plural === "—" ? "Usually abstract; this textbook uses it as singular-only." : "-en plural.";
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
  if (modifiers.includes("nur Sg.")) pluralHelp = "Singular-only in the textbook sense.";
  return { articleHelp, pluralHelp, ruleId };
}

const NOUNS = {
  "Führungsposition": ["die", "Führungspositionen", "leadership position"],
  "Einheimische": ["der", "Einheimischen", "local/native resident"],
  "Stammlokal": ["das", "Stammlokale", "regular pub/restaurant"],
  "Einkaufsviertel": ["das", "Einkaufsviertel", "shopping district"],
  "Pulsieren": ["das", "—", "pulsing/vibrancy", ["nur Sg."]],
  "Melange": ["die", "Melangen", "mélange/mixture; Viennese coffee"],
  "Denkpause": ["die", "Denkpausen", "pause for thought"],
  "Fußstapfe": ["die", "Fußstapfen", "footstep/footprint"],
  "Zwischenüberschrift": ["die", "Zwischenüberschriften", "subheading"],
  "Lesedauer": ["die", "—", "reading time", ["nur Sg."]],
  "Neukunde": ["der", "Neukunden", "new customer"],
  "Neukundin": ["die", "Neukundinnen", "new customer (female)"],
  "Videokanal": ["der", "Videokanäle", "video channel"],
  "Miniaturansicht": ["die", "Miniaturansichten", "thumbnail view"],
  "Berufseinstieg": ["der", "Berufseinstiege", "career start/entry into working life"],
  "Eigeninitiative": ["die", "Eigeninitiativen", "personal initiative"],
  "Teamarbeit": ["die", "Teamarbeiten", "teamwork"],
  "Erachten": ["das", "—", "opinion/judgement (as in meines Erachtens)", ["nur Sg."]],
  "Achterbahnfahren": ["das", "—", "riding roller coasters", ["nur Sg."]],
  "Freiklettern": ["das", "—", "free climbing", ["nur Sg."]],
  "Tiefseetauchen": ["das", "—", "deep-sea diving", ["nur Sg."]],
  "Eisbaden": ["das", "—", "ice bathing", ["nur Sg."]],
  "Fallschirmspringen": ["das", "—", "skydiving/parachuting", ["nur Sg."]],
  "Selbstoptimierung": ["die", "Selbstoptimierungen", "self-optimization"],
  "Essverhalten": ["das", "—", "eating behaviour", ["nur Sg."]],
  "Ausdauersport": ["der", "—", "endurance sport", ["nur Sg."]],
  "Nobelpreis": ["der", "Nobelpreise", "Nobel Prize"],
  "Frühaufsteher": ["der", "Frühaufsteher", "early riser"],
  "Frühaufsteherin": ["die", "Frühaufsteherinnen", "early riser (female)"],
  "Langschläfer": ["der", "Langschläfer", "late sleeper"],
  "Langschläferin": ["die", "Langschläferinnen", "late sleeper (female)"],
  "Normaltyp": ["der", "Normaltypen", "normal type/average chronotype"],
  "Flugpersonal": ["das", "—", "flight crew", ["nur Sg."]],
  "Tagesrhythmus": ["der", "Tagesrhythmen", "daily rhythm"],
  "Aufputschmittel": ["das", "Aufputschmittel", "stimulant"],
  "Studienabbrecher": ["der", "Studienabbrecher", "university dropout"],
  "Studienabbrecherin": ["die", "Studienabbrecherinnen", "university dropout (female)"],
  "Krempel": ["der", "—", "junk/clutter", ["nur Sg."]],
  "Krimskrams": ["der", "—", "odds and ends/bits and bobs", ["nur Sg."]],
  "Aussortieren": ["das", "—", "sorting out/culling", ["nur Sg."]],
  "Weggeben": ["das", "—", "giving away", ["nur Sg."]],
  "Entrümpelung": ["die", "Entrümpelungen", "decluttering/clearing out"],
  "Klamotten": ["die", "Klamotten", "clothes", ["nur Pl."]],
  "Schwesterherz": ["das", "Schwesterherzen", "dear sister/sis"],
  "Leihopa": ["der", "Leihopas", "volunteer/borrowed grandpa"],
  "Kleinfamilie": ["die", "Kleinfamilien", "nuclear family"],
  "Vereinsamung": ["die", "Vereinsamungen", "social isolation/loneliness"],
  "Selbstinszenierung": ["die", "Selbstinszenierungen", "self-staging/self-presentation"],
  "Busanbindung": ["die", "Busanbindungen", "bus connection/access by bus"],
};

const VERBS = {
  "schwerfallen": ["be difficult for someone", ["fiel schwer", "schwergefallen", true]],
  "sehnen": ["long/yearn", null],
  "trödeln": ["dawdle/waste time", null],
  "hingehören": ["belong (in a place/context)", null],
  "bedanken": ["thank/express thanks", null],
  "einhaken": ["hook in; interject/follow up", null],
  "wegklicken": ["click away/close by clicking", null],
  "hinauflaufen": ["run/walk up", ["lief hinauf", "hinaufgelaufen", true]],
  "hinunterlaufen": ["run/walk down", ["lief hinunter", "hinuntergelaufen", true]],
  "reinhören": ["listen in/sample briefly", null],
  "weiterschlafen": ["continue sleeping/go back to sleep", ["schlief weiter", "weitergeschlafen", false]],
  "zusammenlegen": ["combine/merge/put together", null],
  "hinzukommen": ["be added/join in", ["kam hinzu", "hinzugekommen", true]],
  "weggeben": ["give away", ["gab weg", "weggegeben", false]],
  "wegtun": ["put away/remove", ["tat weg", "weggetan", false]],
  "zwischenlagern": ["store temporarily", null],
  "draufgehen": ["be used up/break/die (colloquial)", ["ging drauf", "draufgegangen", true]],
  "leichtfallen": ["be easy for someone", ["fiel leicht", "leichtgefallen", true]],
};

const ADJECTIVES = {
  "sofern": "provided that/if",
  "binnen": "within",
  "unbestritten": "undisputed/uncontested",
  "hingegen": "however/by contrast",
  "dagegen": "by contrast/against it",
  "energiegeladen": "energetic/full of energy",
  "währenddessen": "meanwhile/during that time",
  "stattdessen": "instead",
  "dazu": "for that purpose/in addition",
  "dafür": "for that/for it",
  "dadurch": "thereby/as a result",
  "ehe": "before",
  "während": "while/whereas",
  "anstatt": "instead of",
  "eingesperrt": "locked up/confined",
  "heutzutage": "nowadays",
  "äußerst": "extremely",
  "hellauf": "brightly/utterly (e.g. hellauf begeistert)",
  "durchaus": "definitely/quite",
  "zusammenfassend": "summarizing/in summary",
  "gewiss": "certain/sure",
  "ausgleichend": "balancing/compensating",
  "versetzt": "offset/staggered; transferred",
  "verkürzt": "shortened/abbreviated",
  "energiesparend": "energy-saving",
  "unverpackt": "unpackaged",
};

const NOUN_FIXES = {
  "Begeisterung": { plural: "—", pluralHelp: "Used here as singular-only: enthusiasm as an abstract state." },
  "Druck": { plural: "—", pluralHelp: "Used here as singular-only in the sense pressure/stress." },
  "Schock": { plural: "—", pluralHelp: "Used here as singular-only in the textbook sense." },
  "Migrationshintergrund": { plural: "—", pluralHelp: "Used here as singular-only: migration background." },
  "Heimat": { plural: "—", pluralHelp: "Used here as singular-only: home/homeland as a feeling or place of belonging." },
  "Zeitmangel": { plural: "—", pluralHelp: "Used here as singular-only: lack of time." },
  "Architektur": { plural: "—", pluralHelp: "Used here as singular-only: architecture as a field/style." },
  "Verständnis": { plural: "—", pluralHelp: "Used here as singular-only: understanding." },
  "Sicht": { plural: "—", pluralHelp: "Used here as singular-only: perspective/view." },
  "Konkurrenz": { plural: "—", pluralHelp: "Used here as singular-only: competition." },
  "Fürsorge": { plural: "—", pluralHelp: "Used here as singular-only: care." },
  "Verantwortung": { plural: "—", pluralHelp: "Used here as singular-only: responsibility." },
  "Zufriedenheit": { plural: "Zufriedenheiten", pluralHelp: "-en plural (die Zufriedenheiten), used when comparing satisfactions in different groups or areas." },
  "Ton": { plural: "Töne", english: "tone/sound; clay", pluralHelp: "-e + umlaut (die Töne) for tone/sound. The clay sense can also form die Tone." },
  "Umgang": { plural: "—", pluralHelp: "Used here as singular-only: Umgang mit + Dat. (dealing with/handling)." },
  "Freude": { plural: "—", pluralHelp: "Used here as singular-only: joy." },
};

const VP_COMBOS = [
  ["zurückkehren", "nach", "Dat", "return to", "Sie kehrt nach Wien zurück."],
  ["liegen", "in", "Dat", "lie/be rooted in", "Der Grund liegt in der Geschichte."],
  ["entscheiden", "über", "Akk", "decide on/about", "Die Kommission entscheidet über den Antrag."],
  ["sich auswirken", "auf", "Akk", "affect/have an impact on", "Der Schlafmangel wirkt sich auf die Konzentration aus."],
  ["reagieren", "auf", "Akk", "react to", "Sie reagiert gelassen auf Kritik."],
  ["eingehen", "auf", "Akk", "address/respond to", "Der Autor geht auf die Frage ein."],
  ["sich vernetzen", "mit", "Dat", "network/connect with", "Sie vernetzt sich mit anderen Gründerinnen."],
  ["stoßen", "an", "Akk", "bump/hit against", "Er stößt an seine Grenzen."],
  ["trösten", "mit", "Dat", "comfort with", "Sie tröstet ihn mit guten Worten."],
  ["abweichen", "von", "Dat", "deviate from/differ from", "Die Werte weichen vom Durchschnitt ab."],
  ["aufbauen", "auf", "Dat", "build on", "Der Kurs baut auf Grundkenntnissen auf."],
  ["versetzen", "in", "Akk", "put into/transport into a state", "Die Musik versetzt sie in gute Stimmung."],
  ["sich trennen", "von", "Dat", "separate from/break up with", "Er trennt sich von alten Sachen."],
  ["sich streiten", "mit", "Dat", "argue with", "Sie streitet sich mit ihrem Bruder."],
  ["angeben", "mit", "Dat", "show off/brag about", "Er gibt mit seinem Erfolg an."],
  ["verbinden", "mit", "Dat", "connect/link with", "Viele verbinden Wien mit Kaffeehäusern."],
  ["wahrnehmen", "als", "Akk", "perceive as", "Sie nimmt die Situation als Chance wahr."],
  ["kommunizieren", "mit", "Dat", "communicate with", "Das Team kommuniziert mit den Kunden."],
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

for (const [word, patch] of Object.entries(NOUN_FIXES)) {
  const entry = nounByWord.get(word);
  if (entry) Object.assign(entry, patch);
}

addDualSense("Einheimische", 24543, [
  { article: "der", english: "local/native resident (male)", plural: "Einheimischen" },
  { article: "die", english: "local/native resident (female)", plural: "Einheimischen" },
]);
addDualSense("Event", 760, [
  { article: "das", english: "event", plural: "Events" },
  { article: "der", english: "event (regional/Austrian/Swiss usage)", plural: "Events" },
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

console.log(`Added/ensured B2.1 data. Counts: nouns=${nouns.length}, verbs=${verbs.length}, adjectives=${adjectives.length}, vp=${verbPreps.length}, dual=${dualNouns.length}`);
