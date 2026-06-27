// Tag every noun/verb/adjective in the bank with the lowest CEFR level
// of any deck collection that contains it (A1 < A2 < B1 < B2 < C1).
//
// Then, for nouns whose Leipzig rank is currently > 10000 but which
// appear in some deck, swap their rank with non-deck nouns at the
// bottom of the top-10000 band so all deck nouns end up ranked ≤ 10000.
//
// Idempotent: re-running with the same deck contents yields the same
// result.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const LEVEL_BY_DIR = {
  "data/goethe-a1": "A1",
  "data/goethe-a2": "A2",
  "data/goethe-b1": "B1",
  "data/netzwerk-a1": "A1",
  "data/netzwerk-a2": "A2",
  "data/netzwerk-b1": "B1",
  "data/vielfalt-b1plus": "B1",
  "data/vielfalt-b2-1": "B2",
  "data/vielfalt-b2-2": "B2",
  "data/aspekte-b2": "B2",
  "data/vielfalt-c1-1": "C1",
  "data/vielfalt-c1-2": "C1",
  "data/aspekte-c1": "C1",
};
const LEVEL_ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };

// 1. Walk all decks and compute the lowest CEFR level for each word.
const cefr = { nouns: new Map(), verbs: new Map(), adjectives: new Map() };

for (const [dir, level] of Object.entries(LEVEL_BY_DIR)) {
  const manifest = readJson(`${dir}/manifest.json`);
  for (const ref of manifest.decks) {
    let deck;
    try { deck = readJson(`${dir}/${ref.file}`); } catch { continue; }
    for (const kind of ["nouns", "verbs", "adjectives"]) {
      for (const w of deck[kind] || []) {
        const existing = cefr[kind].get(w);
        if (!existing || LEVEL_ORDER[level] < LEVEL_ORDER[existing]) {
          cefr[kind].set(w, level);
        }
      }
    }
  }
}

// 2. Apply cefrLevel field. Strip it from any entry that's no longer in a deck
// so re-runs after deck changes stay consistent.
const nounsData = readJson("data/nouns.json");
const verbsData = readJson("data/verbs.json");
const adjsData = readJson("data/adjectives.json");

let added = { n: 0, v: 0, a: 0 };
let removed = { n: 0, v: 0, a: 0 };
function applyCefr(entries, lookup, counters) {
  for (const e of entries) {
    const lvl = lookup.get(e.word);
    if (lvl) {
      if (e.cefrLevel !== lvl) counters.added++;
      e.cefrLevel = lvl;
    } else if (e.cefrLevel) {
      delete e.cefrLevel;
      counters.removed++;
    }
  }
}
const cN = { added: 0, removed: 0 };
const cV = { added: 0, removed: 0 };
const cA = { added: 0, removed: 0 };
applyCefr(nounsData.nouns, cefr.nouns, cN);
applyCefr(verbsData.verbs, cefr.verbs, cV);
applyCefr(adjsData.adjectives, cefr.adjectives, cA);

console.log(`CEFR-tagged: ${cN.added} nouns (-${cN.removed}), ${cV.added} verbs (-${cV.removed}), ${cA.added} adjectives (-${cA.removed})`);

// Sanity: count by level
const distribution = (entries) => {
  const c = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  for (const e of entries) if (e.cefrLevel) c[e.cefrLevel]++;
  return c;
};
console.log("Noun levels:", distribution(nounsData.nouns));
console.log("Verb levels:", distribution(verbsData.verbs));
console.log("Adj  levels:", distribution(adjsData.adjectives));

// 3. Rerank deep-deck nouns. We swap ranks with the worst-ranked non-deck
// nouns currently in the top 10000, so all deck nouns end up ≤ 10000.

const deepDeck = nounsData.nouns
  .filter((n) => n.cefrLevel && typeof n.rank === "number" && n.rank > 10000)
  .sort((a, b) => {
    const la = LEVEL_ORDER[a.cefrLevel] - LEVEL_ORDER[b.cefrLevel];
    if (la !== 0) return la;
    return a.rank - b.rank;
  });

const N = deepDeck.length;
console.log(`Deep deck nouns (rank > 10000): ${N}`);
const lvlBreakdown = {};
for (const n of deepDeck) lvlBreakdown[n.cefrLevel] = (lvlBreakdown[n.cefrLevel] || 0) + 1;
console.log("  by level:", lvlBreakdown);

if (N > 0) {
  const demoteCands = nounsData.nouns.filter(
    (n) => !n.cefrLevel && typeof n.rank === "number" && n.rank <= 10000,
  );
  if (N > demoteCands.length) {
    throw new Error(`Need ${N} demote slots but only ${demoteCands.length} non-deck nouns ≤ 10000.`);
  }

  // Take the N highest-ranked non-deck nouns in top 10000. They occupy
  // the bottom of the top 10000.
  const top677Demote = [...demoteCands].sort((a, b) => b.rank - a.rank).slice(0, N);
  // Their old ranks (sorted ascending) become the target slots for deepDeck.
  const targets = top677Demote.map((n) => n.rank).sort((a, b) => a - b);
  // Existing > 10000 ranks (sorted ascending) become slots for the demoted.
  const oldRanks = deepDeck.map((n) => n.rank).slice().sort((a, b) => a - b);

  // Assign: deepDeck (sorted by CEFR asc, current rank asc) → targets (asc).
  // Result: A1 deep-deck words with lowest current rank get the best
  // target rank in 9324–10000.
  for (let i = 0; i < N; i++) {
    deepDeck[i].rank = targets[i];
  }
  // Demoted (sorted by current rank ascending — so the most useful, rank ≈ 9324, comes first)
  // get oldRanks ascending — so they get the smallest possible rank > 10000.
  const demoted = [...top677Demote].sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < N; i++) {
    demoted[i].rank = oldRanks[i];
  }

  console.log(`Reranked ${N} deck nouns into ranks ${targets[0]}–${targets[targets.length - 1]}.`);
  console.log(`Demoted ${N} non-deck nouns to ranks ${oldRanks[0]}–${oldRanks[oldRanks.length - 1]}.`);
}

// Sanity: every noun rank should be unique.
const ranks = nounsData.nouns.map((n) => n.rank).filter((r) => typeof r === "number");
const uniq = new Set(ranks);
if (uniq.size !== ranks.length) {
  throw new Error(`Rank collision detected (${ranks.length} ranks, ${uniq.size} unique).`);
}

writeJson("data/nouns.json", nounsData);
writeJson("data/verbs.json", verbsData);
writeJson("data/adjectives.json", adjsData);
console.log("Saved nouns.json, verbs.json, adjectives.json.");
