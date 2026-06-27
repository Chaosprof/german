// Push every Goethe/Vielfalt deck noun into the top 5000 of nouns by
// CEFR-banded rank swaps.
//
// Idea: each CEFR level has a target rank band within the top 5000. For
// each deck noun currently above rank 5000, we swap with the worst-ranked
// non-deck noun in the corresponding band. This places A1 stragglers
// among the most-frequent words and keeps C1 stragglers near the bottom
// of the top 5000, while preserving the rank order of high-frequency
// non-deck words (Nutzer, Bildung, Anwendung) that are NOT pushed
// out.
//
// Idempotent given the same deck contents.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const writeJson = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + "\n");

// CEFR level → [bandMin, bandMax] (inclusive). Within these bands we
// swap incoming deck nouns into the worst-ranked non-deck slots.
//
// Sized so each band has comfortably more non-deck nouns than incoming
// for that level (verified at runtime; the script halts if not).
const BANDS = {
  A1: [1, 1000],
  A2: [1001, 2000],
  B1: [2001, 3500],
  B2: [3501, 4500],
  C1: [4501, 5000],
};
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1"];

const nounsData = readJson("data/nouns.json");
const nouns = nounsData.nouns;

// Snapshot current rank counts per level for the report.
const before = { incoming: 0, byLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 } };
for (const n of nouns) {
  if (n.cefrLevel && typeof n.rank === "number" && n.rank > 5000) {
    before.incoming++;
    before.byLevel[n.cefrLevel] = (before.byLevel[n.cefrLevel] || 0) + 1;
  }
}
console.log(`Incoming deck nouns at rank > 5000: ${before.incoming}`);
console.log("  by level:", before.byLevel);

// Process each CEFR band sequentially. Within a band we swap ranks of
// (incoming N best deck nouns at this level above rank 5000) with
// (the N worst-ranked non-deck nouns inside the band).
const bandReport = [];
for (const level of LEVEL_ORDER) {
  const incoming = nouns
    .filter((n) => n.cefrLevel === level && typeof n.rank === "number" && n.rank > 5000)
    .sort((a, b) => a.rank - b.rank); // most "important" (lowest current rank) first

  if (!incoming.length) {
    bandReport.push({ level, swapped: 0 });
    continue;
  }

  const [bandMin, bandMax] = BANDS[level];
  const nonDeckInBand = nouns
    .filter((n) => !n.cefrLevel && typeof n.rank === "number" && n.rank >= bandMin && n.rank <= bandMax)
    .sort((a, b) => b.rank - a.rank); // worst-ranked (highest rank) first; these are the demote candidates

  if (nonDeckInBand.length < incoming.length) {
    console.error(`Band ${level} [${bandMin}-${bandMax}]: need ${incoming.length} slots but only ${nonDeckInBand.length} non-deck nouns available.`);
    console.error(`Widen the band or reduce incoming. Halting.`);
    process.exit(1);
  }

  const toDemote = nonDeckInBand.slice(0, incoming.length);

  // Swap ranks: incoming gets the slot ranks (sorted ascending so the
  // most "important" incoming gets the best slot). toDemote gets the
  // incoming's old > 5000 ranks (sorted ascending so the best non-deck
  // gets the smallest demotion).
  const targetSlots = toDemote.map((n) => n.rank).sort((a, b) => a - b);
  const incomingOldRanks = incoming.map((n) => n.rank).sort((a, b) => a - b);

  for (let i = 0; i < incoming.length; i++) {
    incoming[i].rank = targetSlots[i];
  }
  // Sort toDemote ascending by rank so the smallest demotion goes to the
  // best non-deck noun.
  toDemote.sort((a, b) => {
    const ra = a.rank;
    const rb = b.rank;
    return ra - rb;
  });
  for (let i = 0; i < toDemote.length; i++) {
    toDemote[i].rank = incomingOldRanks[i];
  }

  bandReport.push({
    level,
    band: `[${bandMin}-${bandMax}]`,
    swapped: incoming.length,
    targetSlotRange: `${targetSlots[0]}-${targetSlots[targetSlots.length - 1]}`,
    demotedRange: `${incomingOldRanks[0]}-${incomingOldRanks[incomingOldRanks.length - 1]}`,
  });
}

// Verify uniqueness.
const ranks = nouns.map((n) => n.rank).filter((r) => typeof r === "number");
const uniq = new Set(ranks);
if (uniq.size !== ranks.length) {
  // Find duplicates for debugging
  const seen = new Map();
  const dupes = [];
  for (const n of nouns) {
    if (typeof n.rank !== "number") continue;
    if (seen.has(n.rank)) {
      dupes.push([seen.get(n.rank), n.word, n.rank]);
    } else {
      seen.set(n.rank, n.word);
    }
  }
  console.error("Rank collisions:", dupes.slice(0, 10));
  throw new Error(`Rank collision: ${ranks.length} ranks, ${uniq.size} unique.`);
}

writeJson("data/nouns.json", nounsData);

// Report
console.log("\nSwap summary:");
for (const r of bandReport) {
  if (r.swapped === 0) console.log(`  ${r.level}: 0 swapped`);
  else console.log(`  ${r.level}: swapped ${r.swapped} -> band ${r.band}, slots ${r.targetSlotRange}, demoted ${r.demotedRange}`);
}

// Verify post-state
const stillAbove5k = nouns.filter((n) => n.cefrLevel && typeof n.rank === "number" && n.rank > 5000);
console.log(`\nDeck nouns still above rank 5000: ${stillAbove5k.length}`);
const top5kDeck = nouns.filter((n) => n.cefrLevel && typeof n.rank === "number" && n.rank <= 5000);
console.log(`Deck nouns now in top 5000: ${top5kDeck.length}`);
