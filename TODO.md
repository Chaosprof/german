# Dataset cleanup TODO

Open issues from the April 2026 dataset review (commit `7f5d9b4`).
The targeted, high-confidence fixes have already been applied. What follows
is the remaining work, roughly ordered by impact.

## 1. Bulk translation gaps

These are large enough that they warrant a single LLM batch pass, not manual
edits. Easiest is a script that walks the affected entries, sends German +
existing context to a model, and writes back the gloss.

- `data/nouns.json` — **1,385 entries** (≈5.7%) have empty `english`,
  starting around rank 5,108.
- `data/adjectives.json` — **2,068 entries** (≈22.9%) have empty `english`,
  starting around rank 1,999. Worst-affected file proportionally.

## 2. Compound-noun MT contamination beyond rank ~2,500

Same root cause: an unreviewed machine-translation pass that translated
compound components in isolation, picking the wrong sense of the head morpheme.

**Concrete examples already observed in the data:**

| Rank | German | Stored EN | Should be |
|---|---|---|---|
| 5001 | Navigationssystem | "navigation **structure**" | navigation system |
| 5002 | Problemlösung | "problem **answer**" | solution / problem-solving |
| 5003 | Strafverfahren | "**fine** action" | criminal proceedings |
| 5005 | Testergebnis | "**check** outcome" | test result |
| 5007 | Versicherungssumme | "**affirmation** sum" | sum insured |
| 5010 | Fachkenntnis | "**compartment acquaintance**" | expertise / specialist knowledge |
| 5012 | Kreishaus | "**circle bod**" | district administrative building |
| 5014 | Ortsgruppe | "**awl group**" | local branch / local chapter |
| 5016 | Verbleib | "**verb belly**" | whereabouts |
| 5057 | Personalkosten | "human resources at the expense of" | personnel costs |
| 7002 | Klarstellung | "**attitude**" | clarification |
| 7006 | Lehrjahr | "apprenticeship **age**" | apprenticeship year |
| 7007 | Lernzeit | "**tense**" | study time / learning period |
| 7013 | Menschenbild | "human **idea**" | image of humanity / view of mankind |
| 10010 | Fachwelt | "**compartment Earth**" | specialist community / experts |
| 10012 | Fertigungsverfahren | "**manufactory action**" | manufacturing process |
| 10015 | Finanzlage | "finance **bed**" | financial situation |
| 20005 | Steilvorlage | "**template**" | perfect setup / assist (sports) |
| 20010 | Steueridentifikationsnummer | "**controls** identification number" | tax identification number |
| 20011 | Steuerzahlung | "**controls** payment" | tax payment |

**Pattern to fix specifically: `Steuer` translated as "controls" instead of
"tax" inside compounds.** A regex sweep over `*Steuer*` compounds with
"controls" in the gloss would catch most.

**Pattern: `-kosten` compounds with "at the expense of".** All 22 already
have `article: die` after the previous fix; the translations still need
work. e.g. `Stromkosten` → "current at the expense of" should be
"electricity costs"; `Lohnkosten` → "reward at the expense of" should be
"wage costs"; `Mietkosten` → "clamp at the expense of" should be "rental
costs". Likely fixable by a small targeted pass.

Recommendation: rerun translation for everything from rank ≈2,500 to end-of-file,
or at minimum filter for entries whose English contains suspicious tokens
("at the expense of", "compartment", "controls", "verb belly", empty string).

## 3. Structural issues

### `withSein` is a single boolean
Some verbs take different auxiliaries depending on transitive vs.
intransitive sense:

- `fahren` — *Ich bin nach Berlin gefahren* (motion, sein) vs. *Ich habe
  das Auto gefahren* (transitive, haben).
- `fliegen` — same pattern (sein for the trip, haben for piloting).
- `schwimmen` — *Ich bin geschwommen* (across the lake, sein) vs.
  *Ich habe geschwommen* (as activity, haben).
- `ziehen` — sein (move house) vs. haben (pull).

Schema change: replace `withSein: bool` with something like
`auxiliary: "sein" | "haben" | "both"` (with a note string for the
distinction). Affects schema and any drill code that consumes the field.

### Reflexive verbs are stored without `sich`
The `freuen` rank-5,213 anomaly is the symptom. Verbs that are reflexive-only
or predominantly reflexive (`sich freuen`, `sich erinnern`, `sich beeilen`,
`sich kümmern`, `sich verlieben`, `sich gewöhnen`, `sich konzentrieren`,
`sich schämen`, `sich verabreden`, `sich beschweren`) should be flagged.

Suggested schema: add `reflexive: "always" | "common" | null` and have the
drill present them with `sich`.

Also missing entirely: `sich beeilen`, `sich schämen`.

### Plural-only article check
Beyond the 22 `-kosten` compounds already fixed, the audit reported ≈60
total plurale-tantum entries with non-`die` articles. Worth rerunning the
check across all noun suffixes — a script like:

```python
plural_endings = ('kosten','daten','ferien','medien','schaften',...)
# flag if article != 'die' AND word looks plural
```

## 4. Adjective list contamination

The file mixes pure adjectives with adverbs, participles, comparatives, and
bound stems. Examples flagged:

- Comparatives as headwords: `weiter`, `besser`, `später`.
- Adverbs (or primarily-adverbial): `eben`, `endlich`, `natürlich`,
  `plötzlich`, `völlig`.
- Bare/bound stems: `letzt`, `nächst`, `besonder`, `gleichzeitig`,
  `anschließend`.

Two reasonable directions:

1. **Keep the file broad** (current behavior) and document it as
   "describing/qualifying words" rather than strict adjectives. Add a `pos`
   field so consumers can filter.
2. **Split**, moving comparatives to the verb file (under their base
   adjective) and adverbs to a new `data/adverbs.json`.

## 5. Smaller polish items

- `der Mai` etc. now have plural `—`. The `articleHelp`/`pluralHelp` text
  might be tweaked further (currently still mentions month-plural rule).
- `der Beamer` plural is given as `Beamer` (no change, masc-er rule). Some
  speakers say `Beamers`. Probably leave.
- `freuen` rank 5,213 is still numerically wrong even with the gloss fix —
  it should rank around top-100 if the lemmatizer counted reflexive forms.
  Fixing this requires re-extracting from the corpus or manual rerank.
- `der Schüler` gloss "student/pupil": could be tightened to "pupil /
  school student" to disambiguate from `Student` (university).
- `höflich`: dropped "debonair" — gloss now reads "polite/courteous".
  Good. No further action.

## 6. Coverage gaps (not strictly errors)

If we expand scope:

- **Numerals dataset** — `eins`–`zwölf`, ordinals, `halb`, `Dutzend`,
  fractions. Currently nowhere.
- **Modal particles** — `doch, mal, eben, halt, ja, schon, eigentlich`.
  Critical for B1+ but don't fit the existing categories.
- **Pronouns / determiners** — `mein, dein, sein, ihr, dieser, jener,
  jeder, mancher`. Drilling these is common.
- **Conjunctions** — `weil, dass, obwohl, während, falls, sobald, sondern`.
