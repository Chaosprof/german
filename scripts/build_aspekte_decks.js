// Build Aspekte neu decks from parsed entries.
//
// Usage: node build_aspekte_decks.js <level>   (b2 or c1)
//
// Produces:
//   data/aspekte-<level>/manifest.json
//   data/aspekte-<level>/kapitel-NN.json (per chapter)
//   data/aspekte-<level>/all.json
//   data/aspekte-<level>/irregular-verbs.json

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const level = process.argv[2];
if (!["b2", "c1"].includes(level)) {
  console.error("Usage: build_aspekte_decks.js <b2|c1>");
  process.exit(1);
}

const ID_BASE = `aspekte-${level}`;
const PDF_NAME = level === "b2" ? "aspekte-neu-b2-lb-kapitelwortschatz.pdf" : "aspekte-neu-c1-lb-kapitelwortschatz.pdf";
const LABEL = level === "b2" ? "Aspekte neu B2" : "Aspekte neu C1";
const OUT_DIR = `data/aspekte-${level}`;

const parsed = readJson(`audit/aspekte_${level}_parsed.json`);
const bankNouns = new Set(readJson("data/nouns.json").nouns.map((n) => n.word));
const bankVerbsData = readJson("data/verbs.json").verbs;
const bankVerbs = new Set(bankVerbsData.map((v) => v.word));
const bankIrregular = new Set(bankVerbsData.filter((v) => v.irregular).map((v) => v.word));
const bankAdjs = new Set(readJson("data/adjectives.json").adjectives.map((a) => a.word));

fs.mkdirSync(path.join(root, OUT_DIR), { recursive: true });

function uniquePush(arr, seen, value) {
  if (!value || seen.has(value)) return;
  seen.add(value);
  arr.push(value);
}

// Group entries by chapter.
const byChapter = new Map();
const chapterTitle = new Map();
function chapterBody(ch) {
  if (!byChapter.has(ch)) {
    byChapter.set(ch, {
      nouns: [], verbs: [], adjectives: [],
      seenN: new Set(), seenV: new Set(), seenA: new Set(),
    });
  }
  return byChapter.get(ch);
}

for (const e of parsed) {
  if (!e.chapter) continue;
  if (e.chapter_title && !chapterTitle.has(e.chapter)) {
    chapterTitle.set(e.chapter, e.chapter_title);
  }
  const body = chapterBody(e.chapter);
  const lemma = e.lemma;
  if (e.kind === "noun" || e.kind === "noun_pair") {
    if (bankNouns.has(lemma)) uniquePush(body.nouns, body.seenN, lemma);
    if (e.kind === "noun_pair") {
      // Add female partner if exists
      const fem = lemma.endsWith("e") ? lemma.replace(/e$/, "in") : lemma + "in";
      if (bankNouns.has(fem)) uniquePush(body.nouns, body.seenN, fem);
    }
  } else if (e.kind === "verb") {
    if (bankVerbs.has(lemma)) uniquePush(body.verbs, body.seenV, lemma);
    else if (bankAdjs.has(lemma)) uniquePush(body.adjectives, body.seenA, lemma);
  } else if (e.kind === "adj") {
    if (bankAdjs.has(lemma)) uniquePush(body.adjectives, body.seenA, lemma);
    else if (bankVerbs.has(lemma)) uniquePush(body.verbs, body.seenV, lemma);
  }
}

const deckFiles = [];
for (const [ch, body] of [...byChapter.entries()].sort((a, b) => a[0] - b[0])) {
  const title = chapterTitle.get(ch) || "";
  const slug = `kapitel-${String(ch).padStart(2, "0")}`;
  const deck = {
    id: `${ID_BASE}-${slug}`,
    name: `Kapitel ${ch}${title ? `: ${title}` : ""}`,
    shortName: `Kapitel ${ch}`,
    chapter: ch,
    chapterTitle: title,
    nouns: body.nouns,
    verbs: body.verbs,
    adjectives: body.adjectives,
  };
  writeJson(`${OUT_DIR}/${slug}.json`, deck);
  deckFiles.push({ file: `${slug}.json`, id: deck.id, name: deck.name });
}

// All deck
const all = { nouns: [], verbs: [], adjectives: [], seenN: new Set(), seenV: new Set(), seenA: new Set() };
for (const [, body] of [...byChapter.entries()].sort((a, b) => a[0] - b[0])) {
  for (const w of body.nouns) uniquePush(all.nouns, all.seenN, w);
  for (const w of body.verbs) uniquePush(all.verbs, all.seenV, w);
  for (const w of body.adjectives) uniquePush(all.adjectives, all.seenA, w);
}
const allDeck = {
  id: `${ID_BASE}-all`,
  name: `${LABEL} - Komplettes Glossar`,
  shortName: "Komplett",
  chapter: null,
  chapterTitle: "All chapters combined",
  nouns: all.nouns, verbs: all.verbs, adjectives: all.adjectives,
};
writeJson(`${OUT_DIR}/all.json`, allDeck);
deckFiles.push({ file: "all.json", id: allDeck.id, name: allDeck.name });

// Irregular verbs deck
const irr = [];
const seenIrr = new Set();
for (const e of parsed) {
  if (e.kind === "verb" && bankIrregular.has(e.lemma)) {
    uniquePush(irr, seenIrr, e.lemma);
  }
}
const irrDeck = {
  id: `${ID_BASE}-irregular-verbs`,
  name: `${LABEL} - Irregular Verbs`,
  shortName: "Irregular Verbs",
  description: `All irregular verbs from the ${LABEL} Kapitelwortschatz.`,
  source: PDF_NAME,
  verbForms: irr,
};
writeJson(`${OUT_DIR}/irregular-verbs.json`, irrDeck);
deckFiles.push({ file: "irregular-verbs.json", id: irrDeck.id, name: irrDeck.name, kind: "verb_forms" });

// Manifest
const manifest = {
  id: ID_BASE,
  name: `${level.toUpperCase()} Aspekte Glossar`,
  description: `Klett ${LABEL} textbook Kapitelwortschatz, organised by chapter.`,
  source: PDF_NAME,
  decks: deckFiles,
};
writeJson(`${OUT_DIR}/manifest.json`, manifest);

console.log(`Wrote ${deckFiles.length} deck files + manifest to ${OUT_DIR}/`);
console.log(`All deck: ${all.nouns.length}N + ${all.verbs.length}V + ${all.adjectives.length}A = ${all.nouns.length + all.verbs.length + all.adjectives.length}`);
console.log(`Irregular: ${irr.length}`);
