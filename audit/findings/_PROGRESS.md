# Per-word review progress

60 batches × 700 entries = 41,328 entries (every word in all three banks).
Findings land in `audit/findings/<batch>.md`.

**Dispatch policy: 3 subagents at a time.** (A 20-agent wave on 2026-07-30 exhausted the
monthly spend limit — do not repeat.)

## STATUS 2026-07-31: 40/60 batches, 27,942 entries (68%)

- `adjectives.json` — **complete** (9,759)
- `verbs.json` — **complete** (5,583)
- `nouns.json` — 12,600 / 25,986 (batches 001–018 done)
- **Remaining: nouns_019 … nouns_038 = 20 batches = 7 waves at 3/wave**

Confirmed article errors so far: **39** (originally reported as zero).
Prompt for remaining noun batches must carry the accumulated defect list — see the
`nouns_018` dispatch prompt for the current version.

**Agents MUST write their findings file before composing any reply.** Three agents were
killed by the spend limit mid-reply on 07-31 and lost nothing because of this.

### Corrections to the earlier scripted report (`../word-bank-review-2026-07-30.md`)
1. **Articles are NOT flawless.** 7 confirmed errors, all loanwords (invisible to the
   compound-head and suffix checks): `der Radio`, `die Feature`, `der Logo`, `der Kilo`,
   `der Fax`, `der Poster`, `der Backup` — all should be `das`.
2. **`verbs.json` has a contamination block too.** Ranks 5310–5569: 121 past participles
   as lemmas, 15 non-verbs, junk lemmas (`enhalten` = typo for `enthalten`), and strong
   verbs mistyped `regular` with null forms — three tagged A1 (`rausgehen`,
   `zurückfahren`, `mitsprechen`). The earlier "~1% error" figure covered only the 1,202
   irregulars.
3. **`der Nationalsozialismus` = "NatSoc/..."** — neo-Nazi shorthand, sorted first.
4. **Compound-head check was broken.** It looked up tails case-sensitively (`"teil"`)
   against capitalised headwords (`"Teil"`), so it could never match — the reported
   "0 mismatches / 25,986" was incapable of returning non-zero. Disregard it.
5. **39+ confirmed article errors** (was: "flawless"). Loanwords AND native words.
6. **12 entries have `plural: null`** — app renders the literal string "None". The scan
   reported 0 because `str(None).strip()` == `'None'` is truthy, so nulls passed the test.
   Affected: Schulkleidung, Dings, Tango-Musik, Beste, Arztkleidung, Englisch-Studium,
   Sprachenlernen, Kitesurfen, Hasilein, Ticketwahl, Hardrock, Pop.
7. **`plural == singular` was under-weighted.** 3,539 total; 3,198 end in -er/-en/-el/
   -chen/-lein (legitimately invariant) but 341 do not, and many of those are real errors
   (Fanseite, Klettergurt, Wortfamilie, Satzakzent, Zwischensumme…).

**Meta-lesson: two of the three "exhaustive" scripted checks in the original report were
themselves broken and reported reassuring zeros. Prefer the per-word review.**

### NEW HIGH-SEVERITY CLASS: A1 words that lost their primary sense
Alphabetical gloss sorting did not merely reorder senses — in some entries the core
everyday meaning is **absent altogether**:

| word | cefr | gloss in bank | missing |
|---|---|---|---|
| `die Birne` | A1 | bulb/globe/nut | **pear** |
| `der Herd` | A1 | focus/hearth/hotbed | **cooker/hob** |
| `der Anzug` | A1 | approach/attire/move | **suit** |
| `der Aufzug` | A1 | act/approach/attire | **lift** |
| `der Becher` | A1 | Crater/beaker/cup | (leads with the constellation) |
| `die Ziege` | — | bag/goat | (leads with a slang insult) |

Every common noun must be checked for a missing primary sense. This is the single most
damaging defect found and it is invisible to any structural check.

### NEW HIGH-SEVERITY CLASS: morpheme-mangled compound glosses
Compounds translated part-by-part with the wrong sense chosen for each part — these are
outright wrong, not merely badly ordered:

| word | gloss in bank | actually means |
|---|---|---|
| `der Vertragsarzt` | "agreement doc" | doctor on statutory health insurance panel |
| `der Kultusminister` | "cult minister" | state minister for education & cultural affairs |
| `die Risikobewertung` | "chance assessment" | risk assessment |
| `die Einsendung` | "one desinence" | submission / entry |
| `der Kritikpunkt` | "criticism dot" | point of criticism |
| `der Leitsatz` | "composition" | guiding principle |
| `die Vorarbeit` | "business" | preliminary work |

## Complete — 21 batches, 14,659 entries reviewed word by word

All findings files verified complete (each closes with its clean-count and reviewed tally).

| batch | reviewed | high | med | low |
|---|---|---|---|---|
| adjectives_001 | 700 | 5 | 16 | 25 |
| adjectives_002 | 700 | 14 | 38 | 9 |
| adjectives_003 | 700 | 17 | 63 | 81 |
| adjectives_004 | 700 | 13 | 61 | 25 |
| adjectives_005 | 700 | 17 | 57 | 62 |
| adjectives_006 | 700 | 11 | 44 | 74 |
| adjectives_007 | 700 | 16 | 35 | 31 |
| adjectives_008 | 700 | 6 | 27 | 52 |
| adjectives_009 | 700 | 4 | 37 | 68 |
| adjectives_010 | 700 | 17 | 30 | 20 |
| adjectives_011 | 700 | 19 | 30 | 62 |
| adjectives_012 | 700 | 12 | 19 | 44 |
| adjectives_013 | 700 | 16 | 27 | 21 |
| adjectives_014 | 659 | 38 | 35 | 28 |
| verbs_001 | 700 | 3 | 16 | 20 |
| verbs_002 | 700 | 13 | 27 | 11 |
| verbs_003 | 700 | 23 | 35 | 33 |
| verbs_004 | 700 | 16 | 52 | 40 |
| verbs_005 | 700 | 25 | 34 | 34 |
| verbs_006 | 700 | 18 | 45 | 34 |
| verbs_007 | 700 | 50 | 45 | 53 |
| **TOTAL** | **14,659** | **353** | **773** | **827** |

- `adjectives.json` — **100% covered** (all 9,759 entries)
- `verbs.json` — 4,900 of 5,583 covered (88%)

## Remaining — 39 batches, 26,669 entries

- `verbs_008` (683 entries — finishes the verb bank)
- `nouns_001` … `nouns_038` (25,986 entries — whole noun bank)

At 3 agents per wave that is 13 waves. Resume when spend limit allows.
