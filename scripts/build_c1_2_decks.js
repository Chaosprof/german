const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, data) => fs.writeFileSync(path.join(root, p), JSON.stringify(data, null, 2) + "\n");

const parsed = readJson("audit/c1_2_glossar_parsed.json");
const nouns = new Set(readJson("data/nouns.json").nouns.map((n) => n.word));
const verbsData = readJson("data/verbs.json").verbs;
const verbs = new Set(verbsData.map((v) => v.word));
const irregular = new Set(verbsData.filter((v) => v.irregular).map((v) => v.word));
const adjectives = new Set(readJson("data/adjectives.json").adjectives.map((a) => a.word));
const vpKeys = new Set(readJson("data/verbs-with-prepositions.json").verbs.map((v) => `${v.verb}|${v.preposition}`));

const outDir = path.join(root, "data", "vielfalt-c1-2");
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

const partnerNouns = new Map([
  ["Bakteriologe", ["Bakteriologin"]],
  ["Walfänger", ["Walfängerin"]],
  ["Versandhändler", ["Versandhändlerin"]],
]);

const expressionHeads = [
  { match: "der / das Like, -s", type: "noun", word: "Like" },
  { match: "der / das Level, – (Pl. auch: -s)", type: "noun", word: "Level" },
  { match: "der / das Flakon, -s", type: "noun", word: "Flakon" },
  { match: "die / das Kurkuma (nur Sg.)", type: "noun", word: "Kurkuma" },
  { match: "spaßbefreit (ugs.)", type: "adj", word: "spaßbefreit" },
  { match: "krass (ugs.)", type: "adj", word: "krass" },
  { match: "Experimentierfreudig", type: "adj", word: "experimentierfreudig" },
];

const byLesson = new Map();
function lessonBody(lesson) {
  if (!byLesson.has(lesson)) {
    byLesson.set(lesson, {
      nouns: [],
      verbs: [],
      adjectives: [],
      seenN: new Set(),
      seenV: new Set(),
      seenA: new Set(),
    });
  }
  return byLesson.get(lesson);
}

for (const entry of parsed) {
  if (!entry.lektion) continue;
  const body = lessonBody(entry.lektion);
  if (entry.kind === "noun") {
    if (nouns.has(entry.lemma)) uniquePush(body.nouns, body.seenN, entry.lemma);
    for (const partner of partnerNouns.get(entry.lemma) || []) {
      if (nouns.has(partner)) uniquePush(body.nouns, body.seenN, partner);
    }
  } else if (entry.kind === "verb") {
    if (verbs.has(entry.lemma)) uniquePush(body.verbs, body.seenV, entry.lemma);
    else if (adjectives.has(entry.lemma)) uniquePush(body.adjectives, body.seenA, entry.lemma);
  } else if (entry.kind === "adj") {
    if (adjectives.has(entry.lemma)) uniquePush(body.adjectives, body.seenA, entry.lemma);
  } else if (entry.kind === "expression") {
    for (const head of expressionHeads) {
      if (entry.text !== head.match) continue;
      if (head.type === "noun" && nouns.has(head.word)) uniquePush(body.nouns, body.seenN, head.word);
      if (head.type === "adj" && adjectives.has(head.word)) uniquePush(body.adjectives, body.seenA, head.word);
    }
  }
}

const deckFiles = [];
for (const [lesson, body] of [...byLesson.entries()].sort((a, b) => lessonNumber(a[0]) - lessonNumber(b[0]))) {
  const n = lessonNumber(lesson);
  const title = titleByLesson.get(lesson) || "";
  const deck = {
    id: `vielfalt-c1.2-${lessonSlug(lesson)}`,
    name: `Lektion ${n}${title ? `: ${title}` : ""}`,
    shortName: `Lektion ${n}`,
    lektion: n,
    lessonTitle: title,
    nouns: body.nouns,
    verbs: body.verbs,
    adjectives: body.adjectives,
  };
  const file = `${lessonSlug(lesson)}.json`;
  writeJson(path.join("data", "vielfalt-c1-2", file), deck);
  deckFiles.push({ file, id: deck.id, name: deck.name });
}

const all = { nouns: [], verbs: [], adjectives: [], seenN: new Set(), seenV: new Set(), seenA: new Set() };
for (const [, body] of [...byLesson.entries()].sort((a, b) => lessonNumber(a[0]) - lessonNumber(b[0]))) {
  for (const w of body.nouns) uniquePush(all.nouns, all.seenN, w);
  for (const w of body.verbs) uniquePush(all.verbs, all.seenV, w);
  for (const w of body.adjectives) uniquePush(all.adjectives, all.seenA, w);
}

const allDeck = {
  id: "vielfalt-c1.2-all",
  name: "Vielfalt C1.2 - Komplettes Glossar",
  shortName: "Komplett",
  lektion: null,
  lessonTitle: "All lessons combined",
  nouns: all.nouns,
  verbs: all.verbs,
  adjectives: all.adjectives,
};
writeJson("data/vielfalt-c1-2/all.json", allDeck);
deckFiles.push({ file: "all.json", id: allDeck.id, name: allDeck.name });

// Verb-preposition deck: collect verb-prep combos from glossary entries.
const vpSet = new Set();
const prepRe = /\b(an|auf|aus|bei|für|gegen|gegenüber|in|mit|nach|über|um|unter|von|vor|zu|als|zwischen)\s*\+\s*(Akk\.|Dat\.|Gen\.)/g;
for (const entry of parsed) {
  if (entry.kind !== "verb") continue;
  let m;
  while ((m = prepRe.exec(entry.text)) !== null) {
    const prep = m[1];
    const verb = entry.lemma;
    const candidates = [`${verb}|${prep}`, `sich ${verb}|${prep}`];
    for (const k of candidates) if (vpKeys.has(k)) vpSet.add(k);
  }
  prepRe.lastIndex = 0;
}
const vpList = [...vpSet].sort();
const vpDeck = {
  id: "vielfalt-c1.2-verb-prepositions",
  name: "Vielfalt C1.2 - Verb + Preposition",
  shortName: "Verb + Prep",
  description: "All fixed verb-preposition combinations from the Vielfalt C1.2 glossary.",
  source: "Vielfalt_C1-2_Glossar_blanko.pdf",
  verbPrepositions: vpList,
};
writeJson("data/vielfalt-c1-2/verb-prepositions.json", vpDeck);
deckFiles.push({ file: "verb-prepositions.json", id: vpDeck.id, name: vpDeck.name, kind: "verb_prepositions" });

const irr = [];
const seenIrr = new Set();
for (const entry of parsed) {
  if (entry.kind === "verb" && irregular.has(entry.lemma)) {
    uniquePush(irr, seenIrr, entry.lemma);
  }
}
const irregularDeck = {
  id: "vielfalt-c1.2-irregular-verbs",
  name: "Vielfalt C1.2 - Irregular Verbs",
  shortName: "Irregular Verbs",
  description: "All irregular verbs from the Vielfalt C1.2 glossary.",
  source: "Vielfalt_C1-2_Glossar_blanko.pdf",
  verbForms: irr,
};
writeJson("data/vielfalt-c1-2/irregular-verbs.json", irregularDeck);
deckFiles.push({ file: "irregular-verbs.json", id: irregularDeck.id, name: irregularDeck.name, kind: "verb_forms" });

const manifest = {
  id: "vielfalt-c1.2",
  name: "C1.2 Vielfalt Glossar",
  description: "Hueber Vielfalt C1.2 textbook (ISBN 978-3-19-351038-9) - Lernwortschatz organised by lesson.",
  source: "Vielfalt_C1-2_Glossar_blanko.pdf",
  decks: deckFiles,
};
writeJson("data/vielfalt-c1-2/manifest.json", manifest);

console.log(`Wrote ${deckFiles.length} deck file(s) + manifest to data/vielfalt-c1-2/`);
console.log(`Combined deck: ${all.nouns.length} nouns + ${all.verbs.length} verbs + ${all.adjectives.length} adjectives = ${all.nouns.length + all.verbs.length + all.adjectives.length} words`);
console.log(`Verb-preposition deck: ${vpList.length}; irregular deck: ${irr.length}`);
