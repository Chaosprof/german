# Dataset cleanup TODO

Open issues from the April 2026 dataset review.
Targeted fixes were applied in `7f5d9b4`; bulk translation work continues
across `b7966b6`, `524f11c`, `c812e28`. What follows is the remaining work,
roughly ordered by impact.

## Done June 2026 — weak-noun tagging + plural-lemma artifacts

`scripts/fix_weak_noun_tagging.py` (idempotent):
- Removed suffix-driven false weak-noun claims (Mist, Geist + compounds,
  Zwist, Twist, Käse, Autor, Mähroboter, Verarbeiter, Tempomat, Diakon;
  "often weak" hints corrected on Moment, Cent, Kontinent, Akzent, Client,
  Orient, Content, Advent, Wisent, Proviant, Consultant, Volant, Leutnant
  compounds; "mostly weak" -e class text corrected on Kaffee, See, Tee,
  Code, Cookie, Service, Single, Charme).
- Added the missing `⚠ Weak noun` marker to ~105 genuinely weak nouns
  (Patient, Experte, Junge, Graf, Jude, Favorit, Satellit, Kamerad, …).
  Weak deck: 513 → 619 members.
- Mixed -ns class (Name/Buchstabe/Gedanke/Glaube/Wille/Friede/Funke/Same/
  Haufe + compounds) now states the -ns genitive (des Namens); Herr family
  states sg -n vs pl -en; Autor pluralHelp no longer teaches *des Autoren*.
- Cleared bogus der.suffix_er/-ner ruleIds from 240+ adjectival nouns
  (der Deutsche, der Beamte, …) so the app shows their adjectival-declension
  note instead of the wrong -er rule, and the -er rule deck is clean.

`scripts/fix_plural_lemma_artifacts.py` (idempotent):
- Deleted 9 plural-as-lemma artifacts (der Zelte, der Zelten, der Romane,
  der Kanten, das Spatzen, das Utopien, der Live, der Terme, der Range) and
  removed them from the die.suffix_e exceptions in article-rules.json.
- Re-glossed die Zwecke (tack) and die Rabatte (flower bed) with notes
  distinguishing them from the plurals of Zweck/Rabatt.
- Fixed der → die Waise / Kriegswaise (Duden: die Waise).
- Plural-form entries with a living singular (Zutaten, Senioren, Getränke,
  Werte, Kenntnisse, …) no longer claim "Plurale tantum"; true pluralia
  tantum (Eltern, Leute, Kosten + -kosten compounds, Daten, Medien, Ferien,
  Schulden, …, 44 entries) are tagged `die.plural_only`, so that rule deck
  now materializes in the app.

Audit notes left in `audit/weak_noun_audit_dump.txt`. Spotted but NOT fixed
(out of scope): `Individualist` glossed "cunning" (should be "individualist").

## Done June 2026 — reverse-mode synonym collisions

7,587 first-gloss collisions exist bank-wide (e.g. Besorgung/Erledigung both
"errand"; Quatsch/Blödsinn/Unsinn all "nonsense"), so translation mode could
mark a correct synonym wrong. Fixes:

- index.html: reverse mode now shows the FULL gloss list as the prompt and
  accepts any same-class word whose glosses overlap the asked word's
  (`findReverseSynonym`), validating the chosen article against the typed
  word. Accepted synonyms show "X also works — we asked for: Y" for 1.5s;
  stats still credit the asked word. Matching mode accepts pairs whose
  meaning labels are textually identical (indistinguishable cards).
- `scripts/fix_synonym_glosses.py` (idempotent): disambiguated the named
  pairs — Besorgung "errand (shopping)/purchase", Erledigung "task to deal
  with/errand/completion", Blödsinn "nonsense/stupidity", Quatsch
  "nonsense (colloquial)/rubbish". Parentheticals are stripped by the
  matcher, so the words still accept each other.
- DATA_VERSION bumped to 2026-06-09b-synonym-gloss-fixes.

## Done June 2026 — rule description slips + rule tagging

`scripts/fix_rule_examples.py` (idempotent):
- article-rules.json descriptions rewritten: -ial no longer cites the
  non-word "das Sozial"; -nis explains the deverbal suffix vs the feminine
  minority (Erlaubnis, Erkenntnis) vs loan look-alikes (Tennis, Anis,
  Penis); -tum is now purely Germanic (Eigentum/Wachstum, exceptions der
  Reichtum/Irrtum) with Latin -tum stems pointed at the -um rule; -um
  (Latin) mentions the Datum/Faktum/Votum class; -in reframed around the
  real discriminator (unstressed person suffix vs stressed loan ending) and
  renamed "Suffix -in (female persons)".
- nouns.json retags: 21 Latin stems (Datum + 11 compounds, Faktum, Votum,
  Misstrauensvotum, Diktum, Momentum, Präteritum, Quantum, Arboretum,
  Rektum) moved das.suffix_tum → das.suffix_um_latin; Tennis/Tischtennis
  untagged from -nis with a loan note; 46 junk -in followers untagged
  (-medizin/-disziplin/-magazin/-termin compounds, Waschbenzin, Endorphin,
  Offizin, Kinogutschein, Kindesbein) with corrected articleHelp; Hasilein
  retagged das.diminutives; die Philosophin kept (genuine person suffix).
- tag-noun-rules.js regression guards: -tum/-nis/-in exclusion regexes and
  an adjectival-noun skip so re-running the tagger cannot reintroduce the
  bad tags or overwrite the adjectival-declension fix.
- DATA_VERSION bumped to 2026-06-10-rule-example-fixes.

## 1. Bulk translation gaps (in progress)

Status as of `c812e28`:

- `data/nouns.json` — **1,089 blanks remain** (was 1,385). Cleared rank
  band 5,108–9,989; gaps now start at ~rank 10,000.
- `data/adjectives.json` — **1,433 blanks remain** (was 2,068). Cleared
  rank band 1,999–5,000 (with gaps).

Approach for remaining work: same pattern (`scripts/fill-blanks-batch*.py`)
— translate in batches of 200–300, commit per batch, verify ambiguous cases
against Wiktionary/Duden. Each batch script is standalone and idempotent.

## 2. Compound-noun MT contamination beyond rank ~2,500

✅ **Done in `b7966b6`.** All 97 known-bad entries fixed:
- 27 `-kosten` compounds with "at the expense of" → proper "X costs"
- 33 `Fach-`/-abteilung compounds with "compartment" → "specialist/subject"
- 15 `Steuer-`/-steuer compounds with "controls" → "tax"
- Specific egregious errors: "verb belly", "circle bod", "compartment Earth",
  "finance bed", "navigation structure", "fine action", etc.

**Remaining sweep:** there may be similar wrong-sense MT errors with other
head morphemes that haven't been spotted. Quick check ideas:
- `Last` (load vs. burden vs. lorry) in compounds
- `Bahn` (train vs. lane vs. orbit) in compounds
- `Schein` (appearance vs. note vs. certificate) in compounds
- Other suspicious-token sweeps similar to the original triage

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
