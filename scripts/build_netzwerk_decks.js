// Build Netzwerk neu decks from parsed entries.
//
// Usage: node build_netzwerk_decks.js <level>   (a1, a2, or b1)

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const level = process.argv[2];
if (!["a1", "a2", "b1"].includes(level)) {
  console.error("Usage: build_netzwerk_decks.js <a1|a2|b1>");
  process.exit(1);
}

const ID_BASE = `netzwerk-${level}`;
const PDF_NAME = level === "a1"
  ? "NWn_A1_Glossar_Deutsch-Englisch.pdf"
  : level === "a2"
    ? "NWn_A2_Glossar_Englisch.pdf"
    : "NWn_B1_Glossar_Englisch.pdf";
const LABEL = level === "a1" ? "Netzwerk neu A1" : level === "a2" ? "Netzwerk neu A2" : "Netzwerk neu B1";
const OUT_DIR = `data/netzwerk-${level}`;

const parsed = readJson(`audit/nwn_${level}_parsed.json`);
const bankNounsData = readJson("data/nouns.json").nouns;
const bankNouns = new Set(bankNounsData.map((n) => n.word));
const bankVerbsData = readJson("data/verbs.json").verbs;
const bankVerbs = new Set(bankVerbsData.map((v) => v.word));
const bankIrregular = new Set(bankVerbsData.filter((v) => v.irregular).map((v) => v.word));
const bankAdjsData = readJson("data/adjectives.json").adjectives;
const bankAdjs = new Set(bankAdjsData.map((a) => a.word));

const BAD_LEMMAS = new Set([
  "a", "about", "and", "at", "bye", "chicken", "condition", "eight", "eleven",
  "exercise", "fashionable", "fifteen", "first", "five", "from", "garden",
  "good", "grammar", "guide", "hello", "here", "informal", "it", "kitchen",
  "language", "last", "loud", "my", "name", "number", "person", "sentence",
  "school", "Spanish", "subject", "sunscreen", "table", "telephone", "the",
  "to", "travel", "upon", "useful", "verb", "very", "want", "well", "where",
  "which", "word", "you", "your"
]);
const GLUED_ENGLISH_SUFFIX_RE = /(about|almost|approximately|backward|because|behind|besides|conjugated|each|even|impractical|lastly|now|nowhere|still|therefore|what|when)$/i;

function isBadDeckLemma(lemma) {
  if (!lemma) return true;
  if (BAD_LEMMAS.has(lemma) || BAD_LEMMAS.has(lemma.toLowerCase())) return true;
  if (/^[a-zäöüß]+[a-z]{3,}$/.test(lemma) && GLUED_ENGLISH_SUFFIX_RE.test(lemma)) return true;
  return false;
}

fs.mkdirSync(path.join(root, OUT_DIR), { recursive: true });

function uniquePush(arr, seen, value) {
  if (!value || seen.has(value) || isBadDeckLemma(value)) return;
  seen.add(value);
  arr.push(value);
}

const byChapter = new Map();
const chapterTitle = new Map();
function chapterBody(ch) {
  if (!byChapter.has(ch)) {
    byChapter.set(ch, { nouns: [], verbs: [], adjectives: [], seenN: new Set(), seenV: new Set(), seenA: new Set() });
  }
  return byChapter.get(ch);
}

for (const e of parsed) {
  if (!e.chapter) continue;
  if (e.chapter_title && !chapterTitle.has(e.chapter)) chapterTitle.set(e.chapter, e.chapter_title);
  const body = chapterBody(e.chapter);
  const lemma = e.lemma;
  if (e.kind === "noun") {
    if (bankNouns.has(lemma)) uniquePush(body.nouns, body.seenN, lemma);
  } else if (e.kind === "verb") {
    if (bankVerbs.has(lemma)) uniquePush(body.verbs, body.seenV, lemma);
    else if (bankAdjs.has(lemma)) uniquePush(body.adjectives, body.seenA, lemma);
  } else if (e.kind === "adj") {
    if (bankAdjs.has(lemma)) uniquePush(body.adjectives, body.seenA, lemma);
    else if (bankVerbs.has(lemma)) uniquePush(body.verbs, body.seenV, lemma);
    else if (bankNouns.has(lemma)) uniquePush(body.nouns, body.seenN, lemma);
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
    nouns: body.nouns, verbs: body.verbs, adjectives: body.adjectives,
  };
  writeJson(`${OUT_DIR}/${slug}.json`, deck);
  deckFiles.push({ file: `${slug}.json`, id: deck.id, name: deck.name });
}

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

const irr = [];
const seenIrr = new Set();
for (const e of parsed) {
  if (e.kind === "verb" && bankIrregular.has(e.lemma)) uniquePush(irr, seenIrr, e.lemma);
}
const irrDeck = {
  id: `${ID_BASE}-irregular-verbs`,
  name: `${LABEL} - Irregular Verbs`,
  shortName: "Irregular Verbs",
  description: `All irregular verbs from the ${LABEL} glossary.`,
  source: PDF_NAME,
  verbForms: irr,
};
writeJson(`${OUT_DIR}/irregular-verbs.json`, irrDeck);
deckFiles.push({ file: "irregular-verbs.json", id: irrDeck.id, name: irrDeck.name, kind: "verb_forms" });

const manifest = {
  id: ID_BASE,
  name: `${level.toUpperCase()} Netzwerk Glossar`,
  description: `Klett ${LABEL} textbook glossary, organised by chapter.`,
  source: PDF_NAME,
  decks: deckFiles,
};
writeJson(`${OUT_DIR}/manifest.json`, manifest);

console.log(`Wrote ${deckFiles.length} deck files + manifest to ${OUT_DIR}/`);
console.log(`All deck: ${all.nouns.length}N + ${all.verbs.length}V + ${all.adjectives.length}A = ${all.nouns.length + all.verbs.length + all.adjectives.length}`);
console.log(`Irregular: ${irr.length}`);
