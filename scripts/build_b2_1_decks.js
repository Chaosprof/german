const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, data) => fs.writeFileSync(path.join(root, p), JSON.stringify(data, null, 2) + "\n");

const parsed = readJson("audit/b2_1_glossar_parsed.json");
const nouns = new Set(readJson("data/nouns.json").nouns.map((n) => n.word));
const verbsData = readJson("data/verbs.json").verbs;
const verbs = new Set(verbsData.map((v) => v.word));
const irregular = new Set(verbsData.filter((v) => v.irregular).map((v) => v.word));
const adjectives = new Set(readJson("data/adjectives.json").adjectives.map((a) => a.word));
const vpKeys = new Set(readJson("data/verbs-with-prepositions.json").verbs.map((v) => `${v.verb}|${v.preposition}`));

const outDir = path.join(root, "data", "vielfalt-b2-1");
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
  ["Neukunde", ["Neukundin"]],
  ["Frühaufsteher", ["Frühaufsteherin"]],
  ["Langschläfer", ["Langschläferin"]],
  ["Studienabbrecher", ["Studienabbrecherin"]],
]);

const expressionHeads = [
  { match: "Fernost (ohne Artikel)", type: "noun", word: "Fernost" },
  { match: "der / das Event, -s", type: "noun", word: "Event" },
  { match: "begeistert von + Dat.", type: "adj", word: "begeistert" },
  { match: "vertraut mit + Dat.", type: "adj", word: "vertraut" },
  { match: "dazu (HauptsatzKonnektor, final)", type: "adj", word: "dazu" },
  { match: "dafür (HauptsatzKonnektor, final)", type: "adj", word: "dafür" },
  { match: "neugierig auf + Akk.", type: "adj", word: "neugierig" },
  { match: "während (NebensatzKonnektor, adversativ)", type: "adj", word: "während" },
  { match: "ehe (NebensatzKonnektor, temporal)", type: "adj", word: "ehe" },
  { match: "bereit für + Akk.", type: "adj", word: "bereit" },
  { match: "anstatt dass (NebensatzKonnektor, modal)", type: "adj", word: "anstatt" },
  { match: "anstatt … zu (NebensatzKonnektor, modal)", type: "adj", word: "anstatt" },
  { match: "dadurch (HauptsatzKonnektor, modal)", type: "adj", word: "dadurch" },
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
    id: `vielfalt-b2.1-${lessonSlug(lesson)}`,
    name: `Lektion ${n}${title ? `: ${title}` : ""}`,
    shortName: `Lektion ${n}`,
    lektion: n,
    lessonTitle: title,
    nouns: body.nouns,
    verbs: body.verbs,
    adjectives: body.adjectives,
  };
  const file = `${lessonSlug(lesson)}.json`;
  writeJson(path.join("data", "vielfalt-b2-1", file), deck);
  deckFiles.push({ file, id: deck.id, name: deck.name });
}

const all = { nouns: [], verbs: [], adjectives: [], seenN: new Set(), seenV: new Set(), seenA: new Set() };
for (const [, body] of [...byLesson.entries()].sort((a, b) => lessonNumber(a[0]) - lessonNumber(b[0]))) {
  for (const w of body.nouns) uniquePush(all.nouns, all.seenN, w);
  for (const w of body.verbs) uniquePush(all.verbs, all.seenV, w);
  for (const w of body.adjectives) uniquePush(all.adjectives, all.seenA, w);
}

const allDeck = {
  id: "vielfalt-b2.1-all",
  name: "Vielfalt B2.1 - Komplettes Glossar",
  shortName: "Komplett",
  lektion: null,
  lessonTitle: "All lessons combined",
  nouns: all.nouns,
  verbs: all.verbs,
  adjectives: all.adjectives,
};
writeJson("data/vielfalt-b2-1/all.json", allDeck);
deckFiles.push({ file: "all.json", id: allDeck.id, name: allDeck.name });

const vpList = [
  "halten|für",
  "sich sehnen|nach",
  "zusammenhängen|mit",
  "zurückkehren|nach",
  "beitragen|zu",
  "liegen|in",
  "entscheiden|über",
  "sich auswirken|auf",
  "reagieren|auf",
  "sich bedanken|bei",
  "eingehen|auf",
  "sich vernetzen|mit",
  "profitieren|von",
  "anpassen|an",
  "plädieren|für",
  "bestehen|in",
  "kämpfen|gegen",
  "stoßen|an",
  "trösten|mit",
  "sich auskennen|mit",
  "abweichen|von",
  "scheitern|an",
  "aufbauen|auf",
  "nachdenken|über",
  "geraten|in",
  "versetzen|in",
  "arbeiten|an",
  "sich trennen|von",
  "sich drücken|vor",
  "liegen|an",
  "sich unterhalten|mit",
  "sich streiten|mit",
  "angeben|mit",
  "sich wenden|an",
  "verbinden|mit",
  "sich einigen|auf",
  "wahrnehmen|als",
  "suchen|nach",
  "kommunizieren|mit",
].filter((key) => vpKeys.has(key));

const vpDeck = {
  id: "vielfalt-b2.1-verb-prepositions",
  name: "Vielfalt B2.1 - Verb + Preposition",
  shortName: "Verb + Prep",
  description: "All fixed verb-preposition combinations from the Vielfalt B2.1 glossary.",
  source: "Vielfalt_B2-1_Glossar_blanko.pdf",
  verbPrepositions: vpList,
};
writeJson("data/vielfalt-b2-1/verb-prepositions.json", vpDeck);
deckFiles.push({ file: "verb-prepositions.json", id: vpDeck.id, name: vpDeck.name, kind: "verb_prepositions" });

const irr = [];
const seenIrr = new Set();
for (const entry of parsed) {
  if (entry.kind === "verb" && irregular.has(entry.lemma)) {
    uniquePush(irr, seenIrr, entry.lemma);
  }
}
const irregularDeck = {
  id: "vielfalt-b2.1-irregular-verbs",
  name: "Vielfalt B2.1 - Irregular Verbs",
  shortName: "Irregular Verbs",
  description: "All irregular verbs from the Vielfalt B2.1 glossary.",
  source: "Vielfalt_B2-1_Glossar_blanko.pdf",
  verbForms: irr,
};
writeJson("data/vielfalt-b2-1/irregular-verbs.json", irregularDeck);
deckFiles.push({ file: "irregular-verbs.json", id: irregularDeck.id, name: irregularDeck.name, kind: "verb_forms" });

const manifest = {
  id: "vielfalt-b2.1",
  name: "B2.1 Vielfalt Glossar",
  description: "Hueber Vielfalt B2.1 textbook (ISBN 978-3-19-201037-8) - Lernwortschatz organised by lesson.",
  source: "Vielfalt_B2-1_Glossar_blanko.pdf",
  decks: deckFiles,
};
writeJson("data/vielfalt-b2-1/manifest.json", manifest);

console.log(`Wrote ${deckFiles.length} deck file(s) + manifest to data/vielfalt-b2-1/`);
console.log(`Combined deck: ${all.nouns.length} nouns + ${all.verbs.length} verbs + ${all.adjectives.length} adjectives = ${all.nouns.length + all.verbs.length + all.adjectives.length} words`);
console.log(`Verb-preposition deck: ${vpList.length}; irregular deck: ${irr.length}`);
