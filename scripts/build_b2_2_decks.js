const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, data) => fs.writeFileSync(path.join(root, p), JSON.stringify(data, null, 2) + "\n");

const parsed = readJson("audit/b2_2_glossar_parsed.json");
const nouns = new Set(readJson("data/nouns.json").nouns.map((n) => n.word));
const verbsData = readJson("data/verbs.json").verbs;
const verbs = new Set(verbsData.map((v) => v.word));
const irregular = new Set(verbsData.filter((v) => v.irregular).map((v) => v.word));
const adjectives = new Set(readJson("data/adjectives.json").adjectives.map((a) => a.word));
const vpKeys = new Set(readJson("data/verbs-with-prepositions.json").verbs.map((v) => `${v.verb}|${v.preposition}`));

const outDir = path.join(root, "data", "vielfalt-b2-2");
fs.mkdirSync(outDir, { recursive: true });

function lessonNumber(label) {
  const m = String(label || "").match(/Lektion\s+(\d+)/);
  return m ? Number(m[1]) : 0;
}

function lessonSlug(label) {
  return `lektion-${String(lessonNumber(label)).padStart(2, "0")}`;
}

function uniquePush(arr, seen, value) {
  if (!value || seen.has(value)) return;
  seen.add(value);
  arr.push(value);
}

const titleByLesson = new Map();
for (const entry of parsed) {
  if (entry.lektion && entry.lektion_title && !titleByLesson.has(entry.lektion)) {
    titleByLesson.set(entry.lektion, entry.lektion_title);
  }
}

const specialNounMap = new Map([
  ["Soziale", "Soziale Arbeit"],
]);

const byLesson = new Map();
for (const entry of parsed) {
  if (!entry.lektion) continue;
  if (!byLesson.has(entry.lektion)) {
    byLesson.set(entry.lektion, {
      nouns: [],
      verbs: [],
      adjectives: [],
      seenN: new Set(),
      seenV: new Set(),
      seenA: new Set(),
    });
  }
  const body = byLesson.get(entry.lektion);
  if (entry.kind === "noun") {
    const lemma = specialNounMap.get(entry.lemma) || entry.lemma;
    if (nouns.has(lemma)) uniquePush(body.nouns, body.seenN, lemma);
  } else if (entry.kind === "verb") {
    if (verbs.has(entry.lemma)) uniquePush(body.verbs, body.seenV, entry.lemma);
  } else if (entry.kind === "adj") {
    if (adjectives.has(entry.lemma)) uniquePush(body.adjectives, body.seenA, entry.lemma);
  }
}

const deckFiles = [];
for (const [lesson, body] of [...byLesson.entries()].sort((a, b) => lessonNumber(a[0]) - lessonNumber(b[0]))) {
  const n = lessonNumber(lesson);
  const title = titleByLesson.get(lesson) || "";
  const deck = {
    id: `vielfalt-b2.2-${lessonSlug(lesson)}`,
    name: `Lektion ${n}${title ? `: ${title}` : ""}`,
    shortName: `Lektion ${n}`,
    lektion: n,
    lessonTitle: title,
    nouns: body.nouns,
    verbs: body.verbs,
    adjectives: body.adjectives,
  };
  const file = `${lessonSlug(lesson)}.json`;
  writeJson(path.join("data", "vielfalt-b2-2", file), deck);
  deckFiles.push({ file, id: deck.id, name: deck.name });
}

const all = { nouns: [], verbs: [], adjectives: [], seenN: new Set(), seenV: new Set(), seenA: new Set() };
for (const [, body] of [...byLesson.entries()].sort((a, b) => lessonNumber(a[0]) - lessonNumber(b[0]))) {
  for (const w of body.nouns) uniquePush(all.nouns, all.seenN, w);
  for (const w of body.verbs) uniquePush(all.verbs, all.seenV, w);
  for (const w of body.adjectives) uniquePush(all.adjectives, all.seenA, w);
}

const allDeck = {
  id: "vielfalt-b2.2-all",
  name: "Vielfalt B2.2 - Komplettes Glossar",
  shortName: "Komplett",
  lektion: null,
  lessonTitle: "All lessons combined",
  nouns: all.nouns,
  verbs: all.verbs,
  adjectives: all.adjectives,
};
writeJson("data/vielfalt-b2-2/all.json", allDeck);
deckFiles.push({ file: "all.json", id: allDeck.id, name: allDeck.name });

const vpList = [
  "sich abheben|von",
  "unterscheiden|von",
  "begeistern|für",
  "sich entscheiden|zwischen",
  "sich engagieren|für",
  "sich schämen|für",
  "kämpfen|mit",
  "reden|mit",
  "sich verständigen|mit",
  "sich verständigen|über",
  "sich wundern|über",
  "sich befassen|mit",
  "ansprechen|auf",
  "urteilen|über",
  "einwenden|gegen",
  "vergleichen|mit",
  "stehen|zu",
  "sich auseinandersetzen|mit",
  "aufrufen|zu",
  "hören|von",
  "gelangen|in",
  "stehen|für",
].filter((key) => vpKeys.has(key));

const vpDeck = {
  id: "vielfalt-b2.2-verb-prepositions",
  name: "Vielfalt B2.2 - Verb + Preposition",
  shortName: "Verb + Prep",
  description: "All fixed verb-preposition combinations from the Vielfalt B2.2 glossary.",
  source: "Vielfalt_B2-2_Glossar_blanko.pdf",
  verbPrepositions: vpList,
};
writeJson("data/vielfalt-b2-2/verb-prepositions.json", vpDeck);
deckFiles.push({ file: "verb-prepositions.json", id: vpDeck.id, name: vpDeck.name, kind: "verb_prepositions" });

const irr = [];
const seenIrr = new Set();
for (const entry of parsed) {
  if (entry.kind === "verb" && irregular.has(entry.lemma)) {
    uniquePush(irr, seenIrr, entry.lemma);
  }
}
const irregularDeck = {
  id: "vielfalt-b2.2-irregular-verbs",
  name: "Vielfalt B2.2 - Irregular Verbs",
  shortName: "Irregular Verbs",
  description: "All irregular verbs from the Vielfalt B2.2 glossary.",
  source: "Vielfalt_B2-2_Glossar_blanko.pdf",
  verbForms: irr,
};
writeJson("data/vielfalt-b2-2/irregular-verbs.json", irregularDeck);
deckFiles.push({ file: "irregular-verbs.json", id: irregularDeck.id, name: irregularDeck.name, kind: "verb_forms" });

const manifest = {
  id: "vielfalt-b2.2",
  name: "B2.2 Vielfalt Glossar",
  description: "Hueber Vielfalt B2.2 textbook (ISBN 978-3-19-351037-2) - Lernwortschatz organised by lesson.",
  source: "Vielfalt_B2-2_Glossar_blanko.pdf",
  decks: deckFiles,
};
writeJson("data/vielfalt-b2-2/manifest.json", manifest);

console.log(`Wrote ${deckFiles.length} deck file(s) + manifest to data/vielfalt-b2-2/`);
console.log(`Combined deck: ${all.nouns.length} nouns + ${all.verbs.length} verbs + ${all.adjectives.length} adjectives = ${all.nouns.length + all.verbs.length + all.adjectives.length} words`);
console.log(`Verb-preposition deck: ${vpList.length}; irregular deck: ${irr.length}`);
