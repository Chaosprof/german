# TODO

State of the repository as of **18 August 2026**. Every claim in the "open"
sections below was re-verified against `data/` on that date — the previous
revision of this file had drifted badly (it still listed ~2,500 blank glosses
that had in fact all been filled). If you act on an item, re-run its check
first; the one-liners are given so that stays cheap.

The site is already public: <https://chaosprof.github.io/german/>, served by
GitHub Pages from `master`. So "release" here means *announceable*, not
*reachable*.

---

## 1. Release readiness

### Done 18 August 2026 (in the working tree, not yet committed)

- **Cold boot 24.3s → ~6s.** `hydrateWordData` rebuilt `NOUN_INDEX` by
  re-scanning all 25,947 noun entries once per distinct word — ~670M
  comparisons, measured at 13,063ms standalone versus 13ms for the
  Map-bucketed equivalent. The loading screen sat at 100% for ~18s of that.
  Replaced with a single-pass `SOURCE_ROWS_BY_WORD` bucket map
  (`index.html:260`); sense ordering and the `sensePriority` sort are
  unchanged.
- **Service worker precache repaired.** `sw.js` still precached
  `berlin-runner-hero-v1.glb?rev=4`; the runner has requested
  `berlin-runner-hero-v9.glb?rev=1` since August, so the real model was never
  precached and a dead 570KB entry was. Cache keys include the query string,
  so the precache URL now matches the runner's request verbatim.
  `CACHE_NAME` bumped `artikel-blitz-v6` → `v7`. Verified: all 11 entries
  populate, and `caches.match()` on the runner's exact hero URL returns
  958,620 bytes.

### Open, roughly by how much a visitor would notice

- **~6s to first interactive screen, structurally.** 655KB gz of
  `@babel/standalone` is pulled from unpkg and compiles the JSX in the
  browser on *every* load, plus 1.0MB gz `nouns.json`, plus 13 sequential
  round-trips for the deck folders (`VIELFALT_DECK_DIRS`). Precompiling the
  JSX at build time removes the download and the compile together. It also
  removes unpkg as a single point of failure — and note the service worker
  cannot cache those cross-origin scripts, so the PWA is not genuinely
  offline today.
- **A "GitHub PAT" pill sits directly under the title** on the front page
  (`index.html`, progress-sync UI). It is the first thing a visitor sees
  after the logo. Gate it behind settings.
- **`cc_ui_bridge/widget.js` 404s on every public page load**
  (`index.html:4929`). Self-removing via `onerror`, and deliberate — but it
  costs every visitor a request and a console error. Strip it for release.
- **No `<meta name="description">`, no OG/Twitter cards**, and the GitHub
  repo has no description or homepage set. Any shared link renders a blank
  card. Cheapest item here, and the one that matters most on announcement day.
- **No README, no LICENCE**; the repo is public with `license: null`.
  three.js r156 is correctly MIT-attributed inline, but the word bank derives
  from the German-Words repo *and* the publisher glossaries listed in
  `SOURCES.md` (Goethe, Netzwerk, Aspekte, Vielfalt). Decide what licence can
  actually be granted before people start forking.
- **Google Fonts `@import`** at `index.html:16` blocks first paint, has no
  offline fallback, and transmits visitor IPs to Google — the GDPR angle from
  the 2022 LG München ruling is live for a German-learner audience.
  Self-hosting the two families fixes all three.
- **~41MB of unreferenced textures in `assets/img`**: `facade_01`–`09`,
  `shop_01`–`06`, `asphalt`, `cobble`, `pavement`, `pretzel`,
  `sky_berlin_dusk`, and all three `*-atlas-v2` sets with their
  normal/height/AO/roughness maps. Nothing in any HTML or JS references them.
  `berlin-runner-hero-v1.{blend,glb}` joins them now that `sw.js` no longer
  names v1. The repo is 211MB on GitHub, `.git` is 601MB locally — visitors
  never download this, but every cloner does.
- **`berlin-slice.html`** — the retired vertical-slice prototype is still
  served publicly next to the real app.
- **Hero v9 improvements are not live.** The working tree carries 256 lines of
  runner changes and a 230KB → 959KB `.glb`; the site serves the older
  committed model.

---

## 2. Word-bank schema work

The two structural items below are unchanged since the April 2026 review and
are the only genuine data blockers left.

### `withSein` is still a single boolean

Confirmed 18 August 2026: `data/verbs.json` entries carry `withSein`; there is
no `auxiliary` field on any entry. Verbs whose auxiliary depends on
transitivity are therefore unrepresentable:

- `fahren` — *Ich bin nach Berlin gefahren* (motion, sein) vs. *Ich habe das
  Auto gefahren* (transitive, haben).
- `fliegen` — sein for the trip, haben for piloting.
- `schwimmen` — *Ich bin geschwommen* (across the lake) vs. *Ich habe
  geschwommen* (as an activity).
- `ziehen` — sein (move house) vs. haben (pull).

Schema change: replace `withSein: bool` with
`auxiliary: "sein" | "haben" | "both"` plus a note string for the
distinction. Affects the schema and the `IRREGULAR_VERBS` mapping in
`index.html` (`loadWordData`), which currently renders `withSein` as a bare
`"ist "` / `"hat "` prefix.

### Reflexive verbs are still stored without `sich`

Confirmed 18 August 2026: no `reflexive` field exists on any entry, and no
headword is stored `sich`-prefixed. Reflexive-only or predominantly reflexive
verbs (`sich freuen`, `sich erinnern`, `sich kümmern`, `sich verlieben`,
`sich gewöhnen`, `sich konzentrieren`, `sich verabreden`, `sich beschweren`)
present as bare infinitives.

Suggested schema: `reflexive: "always" | "common" | null`, with the drill
presenting them with `sich`.

*Stale sub-item corrected:* the file previously claimed `sich beeilen` and
`sich schämen` were "missing entirely". Both `beeilen` and `schämen` are
present as headwords — only the `sich` marking is absent.

---

## 3. Adjective list classification (partly done)

`data/adjectives.json` gained an `entryType` field, which is direction 1 from
the old plan under a different name. Current tagging (9,262 entries):

| entryType | count |
|---|---|
| *(untagged)* | 9,049 |
| participle | 142 |
| adverb | 30 |
| duplicate_or_variant | 8 |
| pronominal_adverb | 7 |
| preposition | 6 |
| degree_form | 5 |
| conjunction | 4 |
| ordinal_adjective | 2 |
| contraction | 2 |

Resolved by this: comparatives are tagged `degree_form` with a
`baseAdjective` back-reference (`weiter`→`weit`, `besser`→`gut`,
`später`→`spät`), and the bound stems `letzt`, `nächst`, `besonder` are gone
from the file entirely.

**Still open:** adverb tagging is thin — 30 entries, and they skew obscure
(`nichtsdestotrotz`, `folgendermaßen`, `demzufolge`). Every common adverb the
original audit named is still untagged: `eben`, `endlich`, `natürlich`,
`plötzlich`, `völlig`, `gleichzeitig`, `anschließend` all have
`entryType: None`. Either finish the sweep or document the file as
"describing/qualifying words" rather than strict adjectives.

Check: `[a['word'] for a in adjs if a.get('entryType') == 'adverb']`

---

## 4. Coverage gaps (scope expansion, not errors)

No data file exists for any of these:

- **Numerals** — `eins`–`zwölf`, ordinals, `halb`, fractions. (`Dutzend` is
  present, as a noun.)
- **Modal particles** — `doch, mal, eben, halt, ja, schon, eigentlich`.
  Critical for B1+ and they fit no existing category.
- **Pronouns / determiners** — `mein, dein, sein, ihr, dieser, jener, jeder,
  mancher`.
- **Conjunctions** — `weil, dass, obwohl, während, falls, sobald, sondern`.

---

## 5. Closed since the last revision

Re-verified 18 August 2026; no action needed.

- **Bulk translation gaps — done.** The previous file claimed 1,089 blank noun
  glosses and 1,433 blank adjective glosses remained. Actual count is **zero**
  blanks across `nouns.json` (25,947), `adjectives.json` (9,262) and
  `verbs.json` (5,442).
  Check: `sum(1 for w in items if not str(w.get('english','')).strip())`
- **Compound-noun MT contamination — done.** The 97 known-bad entries were
  fixed in `b7966b6`; the follow-up sweep this file proposed also comes back
  clean. `Bahn` compounds: 0 stray "orbit" glosses. `Schein` compounds: 0
  stray "appearance". `Last` compounds return only correct lorry/truck senses
  (`Lastwagen`, `Lastkraftwagen`, `Lastzug`).
- **Plural-only article check — done.** 0 plurale-tantum-shaped entries carry
  a non-`die` article.
- **`Individualist`** — was glossed "cunning"; now correctly "individualist".
- **`der Schüler`** — tightened to "pupil/school student", disambiguating it
  from `Student`.
- **`der Mai`** and the other months — plural is `—`.
- **`der Beamer`** — plural `Beamer`, as decided (masc. -er rule); *Beamers*
  deliberately not added.
- **Weak-noun tagging and plural-lemma artifacts** — `fix_weak_noun_tagging.py`
  and `fix_plural_lemma_artifacts.py`, June 2026. Weak deck 513 → 619; 9
  plural-as-lemma artifacts deleted; `die Waise` corrected; 44 true pluralia
  tantum tagged `die.plural_only`. Audit dump in
  `audit/weak_noun_audit_dump.txt`.
- **Reverse-mode synonym collisions** — `findReverseSynonym` in `index.html`
  accepts any same-class word whose glosses overlap the asked word's, plus
  `fix_synonym_glosses.py` for the named pairs. June 2026.
- **Rule description slips and rule tagging** — `fix_rule_examples.py`:
  `-ial`, `-nis`, `-tum`, `-um`, `-in` descriptions rewritten; 21 Latin stems
  retagged to `das.suffix_um_latin`; 46 junk `-in` followers untagged;
  regression guards added to `tag-noun-rules.js`. June 2026.

### Still unfixed, low priority

- **`freuen` ranks 5,213**, still numerically wrong — it should sit near the
  top 100 if the lemmatiser counted reflexive forms. Fixing it means
  re-extracting from the corpus or a manual rerank. Related to the reflexive
  schema item in §2.
