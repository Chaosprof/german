// CEFR-banded rerank for ALL deck nouns. Each CEFR level claims a target
// rank band. Within a band, the worst-ranked non-deck nouns get demoted
// out and the deck nouns slot in.
//
// Bands chosen to fit current deck noun counts (~6000 total):
//   A1  -> 1-2000
//   A2  -> 1001-3500   (overlaps; we process per band sequentially)
//   B1  -> 2001-5000
//   B2  -> 4501-8000
//   C1  -> 7001-10000

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

const BANDS = {
  A1: [1, 2000],
  A2: [1001, 4000],
  B1: [2001, 5500],
  B2: [4501, 8500],
  C1: [7001, 10000],
};
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1"];

const nounsData = readJson("data/nouns.json");
const nouns = nounsData.nouns;

// Snapshot
const before = { byLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 } };
for (const n of nouns) {
  if (n.cefrLevel && typeof n.rank === "number" && n.rank > 5000) {
    before.byLevel[n.cefrLevel] = (before.byLevel[n.cefrLevel] || 0) + 1;
  }
}

console.log("Deck nouns at rank > 5000 (incoming candidates):", before.byLevel);

// For each level, swap the highest-rank deck nouns into the lowest-rank
// non-deck slots within the level's band.
for (const level of LEVEL_ORDER) {
  const [bandMin, bandMax] = BANDS[level];

  // Incoming = deck nouns with this CEFR level whose current rank is > bandMax
  // (i.e., outside the target band).
  const incoming = nouns
    .filter((n) => n.cefrLevel === level && typeof n.rank === "number" && n.rank > bandMax)
    .sort((a, b) => a.rank - b.rank);

  if (!incoming.length) {
    console.log(`${level}: 0 incoming (all already in band)`);
    continue;
  }

  // Find non-deck demote candidates within the band.
  const demoteCands = nouns
    .filter((n) => !n.cefrLevel && typeof n.rank === "number" && n.rank >= bandMin && n.rank <= bandMax)
    .sort((a, b) => b.rank - a.rank); // worst-rank first

  if (demoteCands.length < incoming.length) {
    console.log(`${level} band [${bandMin}-${bandMax}]: ${incoming.length} incoming but only ${demoteCands.length} non-deck demote candidates. Reducing incoming to ${demoteCands.length}.`);
  }

  const n = Math.min(incoming.length, demoteCands.length);
  if (n === 0) continue;

  const toDemote = demoteCands.slice(0, n);
  const targetSlots = toDemote.map((d) => d.rank).sort((a, b) => a - b);
  const incomingOldRanks = incoming.slice(0, n).map((i) => i.rank).sort((a, b) => a - b);

  for (let i = 0; i < n; i++) {
    incoming[i].rank = targetSlots[i];
  }
  toDemote.sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < n; i++) {
    toDemote[i].rank = incomingOldRanks[i];
  }

  console.log(`${level}: swapped ${n} into band [${bandMin}-${bandMax}], slots ${targetSlots[0]}-${targetSlots[targetSlots.length - 1]}`);
}

// Verify uniqueness
const ranks = nouns.map((n) => n.rank).filter((r) => typeof r === "number");
if (new Set(ranks).size !== ranks.length) {
  throw new Error(`Rank collision after rerank.`);
}

writeJson("data/nouns.json", nounsData);

// Final summary
const stillAbove10k = nouns.filter((n) => n.cefrLevel && typeof n.rank === "number" && n.rank > 10000).length;
const inTop10k = nouns.filter((n) => n.cefrLevel && typeof n.rank === "number" && n.rank <= 10000).length;
console.log(`\nFinal: deck nouns in top 10000: ${inTop10k}; still > 10000: ${stillAbove10k}`);
