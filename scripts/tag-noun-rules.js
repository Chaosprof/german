#!/usr/bin/env node
// Tag each noun in data/nouns.json with a ruleId (+ isException) based on the
// suffix / semantic rules in data/article-rules.json.
//
// Priority:
//   1. Explicit exception override (word present in a rule's exceptions list)
//   2. Semantic category (small hardcoded lists: months, days, seasons, …)
//   3. Suffix match (longest / most specific first, with exclude patterns for
//      false-positive endings like -eur vs. -ur, -ein vs. -in, -aum vs. -um)
//
// If a word matches a suffix but the article differs from the rule's article
// AND the word is not in the known exceptions list, it is still tagged with
// ruleId + isException=true — "pattern exceptions" that should trigger the
// same explanatory card at results time.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NOUNS_PATH = path.join(ROOT, "data", "nouns.json");
const RULES_PATH = path.join(ROOT, "data", "article-rules.json");

const nounsDoc = JSON.parse(fs.readFileSync(NOUNS_PATH, "utf8"));
const rulesDoc = JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
const RULES = rulesDoc.rules;

// Explicit exception overrides (for when a word's real article matches the
// article listed in the rule's exceptions list)
const EXCEPTION_LOOKUP = new Map();
for (const [ruleId, rule] of Object.entries(RULES)) {
  for (const exc of rule.exceptions || []) {
    if (!EXCEPTION_LOOKUP.has(exc.word)) {
      EXCEPTION_LOOKUP.set(exc.word, { ruleId, exceptionArticle: exc.article });
    }
  }
}

// Hardcoded semantic categories (small, enumerable)
const SEMANTIC = {
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

// Strong suffix rules, longest-first. Fourth field is an optional exclude regex —
// when it matches, the rule does NOT apply (falls through to weaker rules).
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
  ["eur",    "der.suffix_eur",    "der"],  // handled before -ur and -er
  ["in",     "die.suffix_in",     "die",   /(ein|oin|ain|öin)$/i],
  ["ur",     "die.suffix_ur",     "die"],
  ["or",     "der.suffix_or",     "der"],
  ["um",     "das.suffix_um_latin", "das", /(aum|oum)$/i],
  ["er",     "der.suffix_er",     "der"]
];

// Prefix rules — checked between strong suffixes and weak fallback suffixes
// (so that Geschwindigkeit → -keit and Geschäftsführer → -er win, but
// Gebäude/Gemüse/Gewebe go to Ge- prefix instead of the weak -e fallback).
const PREFIX_RULES = [
  ["Ge", "das.prefix_ge", "das", /^Geo[a-zäöü]/]  // Geometrie, Geographie etc. are Greek loans, not Ge- prefix
];

// Weak fallback suffixes — open-vowel endings that match almost anything;
// run only after strong suffixes and prefix rules have a chance.
const WEAK_SUFFIX_RULES = [
  ["o",      "das.suffix_o",      "das"],
  ["e",      "die.suffix_e",      "die"]
];

function applyMorphRules(word, article, rules, kind) {
  for (const [token, ruleId, requiredArticle, exclude] of rules) {
    const matches = kind === "prefix"
      ? word.startsWith(token) && word.length > token.length + 1
      : word.endsWith(token)   && word.length > token.length;
    if (!matches) continue;
    if (exclude && exclude.test(word)) continue;
    return { ruleId, isException: article !== requiredArticle };
  }
  return null;
}

function findRule(word, article) {
  // 1. Explicit exception override
  const exc = EXCEPTION_LOOKUP.get(word);
  if (exc && exc.exceptionArticle === article) {
    return { ruleId: exc.ruleId, isException: true };
  }

  // 2. Semantic categories
  for (const [ruleId, set] of Object.entries(SEMANTIC)) {
    if (set.has(word)) {
      const expectedArticle = RULES[ruleId].article;
      return { ruleId, isException: article !== expectedArticle };
    }
  }

  // 3. Strong suffix rules
  const strong = applyMorphRules(word, article, STRONG_SUFFIX_RULES, "suffix");
  if (strong) return strong;

  // 4. Prefix rules (Ge- collective)
  const prefix = applyMorphRules(word, article, PREFIX_RULES, "prefix");
  if (prefix) return prefix;

  // 5. Weak fallback suffixes (-e, -o)
  const weak = applyMorphRules(word, article, WEAK_SUFFIX_RULES, "suffix");
  if (weak) return weak;

  return null;
}

let tagged = 0;
let exceptionCount = 0;
const byRule = new Map();
const exceptionByRule = new Map();

for (const noun of nounsDoc.nouns) {
  const match = findRule(noun.word, noun.article);
  if (match) {
    noun.ruleId = match.ruleId;
    if (match.isException) {
      noun.isException = true;
      exceptionCount++;
      exceptionByRule.set(match.ruleId, (exceptionByRule.get(match.ruleId) || 0) + 1);
    } else {
      delete noun.isException;
    }
    tagged++;
    byRule.set(match.ruleId, (byRule.get(match.ruleId) || 0) + 1);
  } else {
    delete noun.ruleId;
    delete noun.isException;
  }
}

fs.writeFileSync(NOUNS_PATH, JSON.stringify(nounsDoc, null, 2) + "\n", "utf8");

console.log(`Tagged ${tagged} / ${nounsDoc.nouns.length} nouns (${exceptionCount} marked as exceptions).`);
console.log("\nPer-rule coverage (total | exceptions):");
const allRules = new Set([...byRule.keys(), ...exceptionByRule.keys()]);
const sorted = [...allRules].sort((a, b) => (byRule.get(b) || 0) - (byRule.get(a) || 0));
for (const ruleId of sorted) {
  const total = byRule.get(ruleId) || 0;
  const excs = exceptionByRule.get(ruleId) || 0;
  console.log(`  ${ruleId.padEnd(32)} ${String(total).padStart(5)}  (${excs} exc)`);
}

// Report exceptions from article-rules.json that are NOT in the word bank
const nounsIndex = new Map(nounsDoc.nouns.map(n => [n.word, n]));
const missing = [];
for (const [ruleId, rule] of Object.entries(RULES)) {
  for (const exc of rule.exceptions || []) {
    const existing = nounsIndex.get(exc.word);
    if (!existing || existing.article !== exc.article) {
      missing.push({ ruleId, ruleName: rule.name, exceptionArticle: exc.article, word: exc.word, presentAs: existing?.article || null });
    }
  }
}
if (missing.length) {
  console.log("\nExceptions from rules JSON not matched in word bank:");
  for (const m of missing) {
    const note = m.presentAs ? ` (word bank has it as ${m.presentAs})` : ` (not in word bank)`;
    console.log(`  [${m.ruleId}] ${m.exceptionArticle} ${m.word}${note}`);
  }
}
