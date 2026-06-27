#!/usr/bin/env node
// Rebuild the per-rule `exceptions` lists in data/article-rules.json from
// two sources:
//   1. A canonical set of "website" exceptions taken from the Passion4teq
//      article (never dropped, even if absent from the local word bank).
//   2. Fresh in-bank discovery: any noun that matches a rule's suffix /
//      semantic set but has a different article. Split into primitives
//      (added to rule.exceptions) and compounds (tagged isException on the
//      noun by tag-noun-rules.js, but not listed at the rule level).
//
// Running this after an edit to data/nouns.json keeps the rules JSON honest
// — stale entries (e.g., a noun whose article was corrected) are purged.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NOUNS_PATH = path.join(ROOT, "data", "nouns.json");
const RULES_PATH = path.join(ROOT, "data", "article-rules.json");

const nounsDoc = JSON.parse(fs.readFileSync(NOUNS_PATH, "utf8"));
const rulesDoc = JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
const RULES = rulesDoc.rules;

// ─── Canonical website exceptions (Passion4teq, sections 1–3) ─────────────
// ruleId → [{ word, article }]
const WEBSITE_EXCEPTIONS = {
  "der.suffix_ant":            [{word:"Croissant",article:"das"},{word:"Restaurant",article:"das"}],
  "der.suffix_ling":           [{word:"Dribbling",article:"das"},{word:"Bowling",article:"das"}],
  "der.suffix_ner":            [{word:"Banner",article:"das"},{word:"Wiener",article:"die"}],
  "der.suffix_or":             [{word:"Gegentor",article:"das"},{word:"Chlor",article:"das"}],
  "der.suffix_er":             [
    // family/role words for women → die
    {word:"Mutter",article:"die"},{word:"Tochter",article:"die"},{word:"Schwester",article:"die"},
    // common native -er primitives that go die
    {word:"Mauer",article:"die"},{word:"Feier",article:"die"},{word:"Nummer",article:"die"},
    {word:"Dauer",article:"die"},{word:"Feder",article:"die"},{word:"Leber",article:"die"},
    {word:"Schulter",article:"die"},{word:"Steuer",article:"die"},{word:"Trauer",article:"die"},
    {word:"Oper",article:"die"},{word:"Klammer",article:"die"},{word:"Kammer",article:"die"},
    {word:"Ziffer",article:"die"},{word:"Ader",article:"die"},
    // common neuter -er primitives
    {word:"Wasser",article:"das"},{word:"Tier",article:"das"},{word:"Alter",article:"das"},
    {word:"Zimmer",article:"das"},{word:"Theater",article:"das"},{word:"Fenster",article:"das"},
    {word:"Wetter",article:"das"},{word:"Meer",article:"das"},{word:"Opfer",article:"das"},
    {word:"Semester",article:"das"},{word:"Papier",article:"das"},{word:"Muster",article:"das"},
    {word:"Wunder",article:"das"},{word:"Kloster",article:"das"},{word:"Lager",article:"das"},
    {word:"Ufer",article:"das"},{word:"Futter",article:"das"},{word:"Silber",article:"das"},
    {word:"Messer",article:"das"},{word:"Leder",article:"das"},{word:"Klavier",article:"das"},
    {word:"Fieber",article:"das"},{word:"Atelier",article:"das"},{word:"Quartier",article:"das"},
    {word:"Revier",article:"das"},{word:"Foyer",article:"das"}
  ],
  "der.alcoholic_beverages":   [{word:"Bier",article:"das"}],
  "der.rivers_outside_europe": [{word:"Lena",article:"die"},{word:"Angara",article:"die"},{word:"Kolyma",article:"die"}],
  "der.mountains":             [{word:"Zugspitze",article:"die"}],
  "die.suffix_e":              [{word:"Junge",article:"der"},{word:"Friede",article:"der"}],
  "die.suffix_ei":             [{word:"Ei",article:"das"},{word:"Papagei",article:"der"}],
  "die.suffix_ie":             [{word:"Junkie",article:"der"},{word:"Hippie",article:"der"}],
  "die.suffix_in":             [{word:"Benzin",article:"das"},{word:"Harlekin",article:"der"}],
  "die.plants_trees":          [{word:"Ahorn",article:"der"},{word:"Veilchen",article:"das"}],
  "das.suffix_ment":           [{word:"Konsument",article:"der"},{word:"Zement",article:"der"}],
  "das.suffix_nis":            [{word:"Fahrerlaubnis",article:"die"},{word:"Wildnis",article:"die"}],
  "das.suffix_o":              [{word:"Avocado",article:"die"},{word:"Euro",article:"der"}],
  "das.suffix_tum":            [{word:"Reichtum",article:"der"},{word:"Irrtum",article:"der"}],
  "das.prefix_ge":             [
    // primitive masculine Ge- nouns
    {word:"Geist",article:"der"},{word:"Genuss",article:"der"},{word:"Geschmack",article:"der"},
    {word:"Geruch",article:"der"},{word:"Gesang",article:"der"},{word:"Gewinn",article:"der"},
    {word:"Gedanke",article:"der"},{word:"Gehorsam",article:"der"},{word:"Gehalt",article:"der"},
    {word:"Gebrauch",article:"der"},{word:"Gefallen",article:"der"},{word:"Genosse",article:"der"},
    // primitive feminine Ge- nouns
    {word:"Geschichte",article:"die"},{word:"Geste",article:"die"},{word:"Gerade",article:"die"},
    {word:"Gerste",article:"die"},{word:"Geige",article:"die"},{word:"Gemeinde",article:"die"},
    {word:"Geburt",article:"die"},{word:"Geduld",article:"die"},{word:"Gestalt",article:"die"},
    {word:"Gefahr",article:"die"},{word:"Gewalt",article:"die"},{word:"Gegend",article:"die"},
    {word:"Gebühr",article:"die"}
  ],
  "das.chemical_elements":     [{word:"Kohlenstoff",article:"der"},{word:"Sauerstoff",article:"der"},{word:"Stickstoff",article:"der"},{word:"Wasserstoff",article:"der"},{word:"Phosphor",article:"der"},{word:"Schwefel",article:"der"}],
  "das.metals":                [{word:"Bronze",article:"die"},{word:"Stahl",article:"der"}],
  "das.fractions":             [{word:"Hälfte",article:"die"}]
};

// ─── Matcher config (mirrors tag-noun-rules.js) ──────────────────────────
const STRONG_SUFFIX_RULES = [
  ["schaft", "die.suffix_schaft", "die"],
  ["ismus",  "der.suffix_ismus",  "der"],
  ["keit",   "die.suffix_keit",   "die"],
  ["heit",   "die.suffix_heit",   "die",   /scheit$/i],
  ["falt",   "die.suffix_falt",   "die"],
  ["lein",   "das.diminutives",   "das"],
  ["chen",   "das.diminutives",   "das",   /(kuchen|knochen|drachen|rachen|rechen|rochen|groschen|machen|lachen)$/i],
  ["ling",   "der.suffix_ling",   "der"],
  ["ment",   "das.suffix_ment",   "das"],
  ["tum",    "das.suffix_tum",    "das"],
  ["tät",    "die.suffix_taet",   "die"],
  ["ion",    "die.suffix_ion",    "die"],
  ["ade",    "die.suffix_ade",    "die"],
  ["age",    "die.suffix_age",    "die"],
  ["anz",    "die.suffix_anz",    "die"],
  ["enz",    "die.suffix_enz",    "die"],
  ["ial",    "das.suffix_ial",    "das"],
  ["nis",    "das.suffix_nis",    "das"],
  ["ner",    "der.suffix_ner",    "der"],
  ["ant",    "der.suffix_ant",    "der"],
  ["ung",    "die.suffix_ung",    "die",   /(sprung|schwung|^dung$|nibelung)$/i],
  ["ei",     "die.suffix_ei",     "die"],
  ["ie",     "die.suffix_ie",     "die"],
  ["ik",     "die.suffix_ik",     "die"],
  ["eur",    "der.suffix_eur",    "der"],
  ["in",     "die.suffix_in",     "die",   /(ein|oin|ain|öin)$/i],
  ["ur",     "die.suffix_ur",     "die"],
  ["or",     "der.suffix_or",     "der"],
  ["um",     "das.suffix_um_latin", "das", /(aum|oum)$/i],
  ["er",     "der.suffix_er",     "der"]
];

const PREFIX_RULES = [
  ["Ge", "das.prefix_ge", "das", /^Geo[a-zäöü]/]
];

const WEAK_SUFFIX_RULES = [
  ["o",      "das.suffix_o",      "das"],
  ["e",      "die.suffix_e",      "die"]
];

const SEMANTIC_SETS = {
  "der.months": new Set(["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]),
  "der.days": new Set(["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonnabend","Sonntag"]),
  "der.seasons": new Set(["Frühling","Frühjahr","Sommer","Herbst","Winter"]),
  "der.compass": new Set(["Norden","Süden","Osten","Westen","Nordosten","Nordwesten","Südosten","Südwesten","Nordost","Nordwest","Südost","Südwest"]),
  "der.precipitations": new Set(["Regen","Schnee","Hagel","Nebel","Tau","Reif","Nieselregen","Schneefall","Sprühregen","Dauerregen"]),
  "der.alcoholic_beverages": new Set(["Wein","Rotwein","Weißwein","Roséwein","Sekt","Schaumwein","Champagner","Cognac","Whiskey","Whisky","Schnaps","Wodka","Rum","Likör","Gin","Tequila","Brandy","Calvados","Met","Most","Obstler","Korn","Absinth"]),
  "das.colors": new Set(["Rot","Gelb","Blau","Grün","Weiß","Schwarz","Grau","Braun","Orange","Violett","Rosa","Türkis","Pink","Lila"]),
  "das.chemical_elements": new Set(["Wasserstoff","Helium","Lithium","Beryllium","Bor","Kohlenstoff","Stickstoff","Sauerstoff","Fluor","Neon","Natrium","Magnesium","Aluminium","Silicium","Silizium","Phosphor","Schwefel","Chlor","Argon","Kalium","Calcium","Kalzium","Scandium","Titan","Vanadium","Chrom","Mangan","Eisen","Kobalt","Nickel","Kupfer","Zink","Gallium","Germanium","Arsen","Selen","Brom","Krypton","Rubidium","Strontium","Yttrium","Zirconium","Niob","Molybdän","Technetium","Ruthenium","Rhodium","Palladium","Silber","Cadmium","Indium","Zinn","Antimon","Tellur","Iod","Jod","Xenon","Cäsium","Barium","Lanthan","Cer","Praseodym","Neodym","Samarium","Europium","Gadolinium","Terbium","Dysprosium","Holmium","Erbium","Thulium","Ytterbium","Lutetium","Hafnium","Tantal","Wolfram","Rhenium","Osmium","Iridium","Platin","Gold","Quecksilber","Thallium","Blei","Bismut","Wismut","Polonium","Astat","Radon","Francium","Radium","Actinium","Thorium","Protactinium","Uran","Neptunium","Plutonium","Americium","Curium","Berkelium","Californium"]),
  "das.metals": new Set(["Messing","Bronze","Stahl","Gusseisen","Roheisen","Weißblech","Lot","Amalgam"]),
  "das.fractions": new Set(["Drittel","Viertel","Fünftel","Sechstel","Siebtel","Siebentel","Achtel","Neuntel","Zehntel","Zwanzigstel","Hundertstel","Tausendstel"])
};

// Ensure the synthetic -eur rule exists
if (!RULES["der.suffix_eur"]) {
  RULES["der.suffix_eur"] = {
    article: "der",
    name: "Suffix -eur (French agent suffix)",
    description: "Nouns of French origin ending in -eur are masculine agent nouns. Examples: der Ingenieur, der Regisseur, der Friseur, der Chauffeur, der Amateur.",
    exceptions: []
  };
}

// Ensure the das.prefix_ge rule exists (in case article-rules.json is regenerated)
if (!RULES["das.prefix_ge"]) {
  RULES["das.prefix_ge"] = {
    article: "das",
    name: "Prefix Ge- (collective / verbal abstract)",
    description: "Collective and abstract nouns formed with the Germanic Ge- prefix are neuter. Examples: das Gebäude, das Gebirge, das Gemüse, das Geschirr, das Gepäck.",
    exceptions: []
  };
}

// ─── Discovery ────────────────────────────────────────────────────────────
const NOUN_INDEX = new Map();
for (const n of nounsDoc.nouns) NOUN_INDEX.set(n.word, n);

function upper1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function isCompoundInheritor(word, article) {
  const lower = word.toLowerCase();
  for (let i = 1; i <= lower.length - 3; i++) {
    const tail = upper1(lower.slice(i));
    if (tail === word) continue;
    const base = NOUN_INDEX.get(tail);
    if (base && base.article === article) return tail;
  }
  return null;
}

function matchMorph(word, rules, kind) {
  for (const [token, ruleId, expected, exclude] of rules) {
    const matches = kind === "prefix"
      ? word.startsWith(token) && word.length > token.length + 1
      : word.endsWith(token)   && word.length > token.length;
    if (!matches) continue;
    if (exclude && exclude.test(word)) continue;
    return { ruleId, expected };
  }
  return null;
}

function matchAnyRule(word) {
  return matchMorph(word, STRONG_SUFFIX_RULES, "suffix")
      || matchMorph(word, PREFIX_RULES, "prefix")
      || matchMorph(word, WEAK_SUFFIX_RULES, "suffix");
}

function matchSemantic(word) {
  for (const [ruleId, set] of Object.entries(SEMANTIC_SETS)) {
    if (set.has(word)) return { ruleId, expected: RULES[ruleId]?.article };
  }
  return null;
}

const primitives = new Map();  // ruleId → Map(word → article)
const compounds = new Map();
function push(bucket, ruleId, word, article) {
  if (!bucket.has(ruleId)) bucket.set(ruleId, new Map());
  bucket.get(ruleId).set(word, article);
}

for (const noun of nounsDoc.nouns) {
  const { word, article } = noun;
  const sem = matchSemantic(word);
  if (sem) {
    if (article !== sem.expected) push(primitives, sem.ruleId, word, article);
    continue;
  }
  const m = matchAnyRule(word);
  if (!m) continue;
  if (article === m.expected) continue;
  const head = isCompoundInheritor(word, article);
  if (head) push(compounds, m.ruleId, word, article);
  else      push(primitives, m.ruleId, word, article);
}

// ─── Rebuild rule.exceptions from scratch: website + discovered primitives ─
for (const rule of Object.values(RULES)) rule.exceptions = [];

for (const [ruleId, list] of Object.entries(WEBSITE_EXCEPTIONS)) {
  if (!RULES[ruleId]) continue;
  for (const exc of list) RULES[ruleId].exceptions.push({ ...exc });
}

for (const [ruleId, wordMap] of primitives) {
  const rule = RULES[ruleId];
  if (!rule) continue;
  const existing = new Set(rule.exceptions.map(e => e.word));
  for (const [word, article] of wordMap) {
    if (!existing.has(word)) rule.exceptions.push({ word, article });
  }
}

for (const rule of Object.values(RULES)) {
  rule.exceptions.sort((a, b) => a.word.localeCompare(b.word, "de"));
}

rulesDoc.rules = RULES;
fs.writeFileSync(RULES_PATH, JSON.stringify(rulesDoc, null, 2) + "\n", "utf8");

// ─── Report ───────────────────────────────────────────────────────────────
let totalExceptions = 0;
const sorted = Object.entries(RULES)
  .map(([id, r]) => [id, r.exceptions.length])
  .filter(([, n]) => n > 0)
  .sort((a, b) => b[1] - a[1]);
console.log("Rule exception counts:");
for (const [id, n] of sorted) {
  console.log(`  ${id.padEnd(28)} ${n}`);
  totalExceptions += n;
}
let totalCompounds = 0;
for (const m of compounds.values()) totalCompounds += m.size;
console.log(`\nTotal rule exceptions: ${totalExceptions}`);
console.log(`Compound inheritors (tagged on noun, not in rule list): ${totalCompounds}`);
