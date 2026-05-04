#!/usr/bin/env node
// Discover candidate exceptions in data/nouns.json: nouns whose suffix
// matches a rule, but whose article differs from what the rule predicts.
// Semantic categories with enumerated word lists are not reported here
// (there are no "other exceptions" to finite sets like months).

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const nounsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "nouns.json"), "utf8"));
const rulesDoc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "article-rules.json"), "utf8"));
const RULES = rulesDoc.rules;

// Mirrors tag-noun-rules.js: strong suffixes → prefix rules → weak suffixes.
const STRONG_SUFFIX_RULES = [
  ["schaft", "die.suffix_schaft", "die"],
  ["ismus",  "der.suffix_ismus",  "der"],
  ["keit",   "die.suffix_keit",   "die"],
  ["heit",   "die.suffix_heit",   "die"],
  ["falt",   "die.suffix_falt",   "die"],
  ["chen",   "das.diminutives",   "das"],
  ["lein",   "das.diminutives",   "das"],
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
  ["ung",    "die.suffix_ung",    "die"],
  ["ei",     "die.suffix_ei",     "die"],
  ["ie",     "die.suffix_ie",     "die"],
  ["ik",     "die.suffix_ik",     "die"],
  ["eur",    "der.suffix_eur",    "der"],
  ["in",     "die.suffix_in",     "die"],
  ["ur",     "die.suffix_ur",     "die"],
  ["or",     "der.suffix_or",     "der"],
  ["um",     "das.suffix_um_latin", "das"],
  ["er",     "der.suffix_er",     "der"]
];
const PREFIX_RULES = [
  ["Ge", "das.prefix_ge", "das", /^Geo[a-zäöü]/]
];
const WEAK_SUFFIX_RULES = [
  ["o",      "das.suffix_o",      "das"],
  ["e",      "die.suffix_e",      "die"]
];
const ALL_RULES = [
  ...STRONG_SUFFIX_RULES.map(r => ["suffix", ...r]),
  ...PREFIX_RULES.map(r => ["prefix", ...r]),
  ...WEAK_SUFFIX_RULES.map(r => ["suffix", ...r])
];

// Collect already-known exceptions
const KNOWN_EXCEPTION = new Map(); // word → ruleId
for (const [ruleId, rule] of Object.entries(RULES)) {
  for (const exc of rule.exceptions || []) {
    KNOWN_EXCEPTION.set(exc.word, ruleId);
  }
}

// Bucket nouns by the first morphology rule they match
const byRule = new Map();
for (const noun of nounsDoc.nouns) {
  const { word, article } = noun;
  for (const [kind, token, ruleId, expected, exclude] of ALL_RULES) {
    const matches = kind === "prefix"
      ? word.startsWith(token) && word.length > token.length + 1
      : word.endsWith(token)   && word.length > token.length;
    if (!matches) continue;
    if (exclude && exclude.test(word)) continue;
    if (article !== expected && !KNOWN_EXCEPTION.has(word)) {
      if (!byRule.has(ruleId)) byRule.set(ruleId, []);
      byRule.get(ruleId).push({ word, article });
    }
    break;
  }
}

console.log("Candidate exceptions (article ≠ rule, not already listed):\n");
const order = Object.keys(RULES);
for (const ruleId of order) {
  const list = byRule.get(ruleId) || [];
  if (!list.length) continue;
  list.sort((a, b) => a.word.localeCompare(b.word));
  console.log(`\n=== ${ruleId}  (${RULES[ruleId].article} by rule, ${list.length} candidates) ===`);
  for (const { word, article } of list) {
    console.log(`  ${article} ${word}`);
  }
}

console.log("\n\nTotal candidate count:", [...byRule.values()].reduce((s, l) => s + l.length, 0));
