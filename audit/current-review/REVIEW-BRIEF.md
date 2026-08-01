# Reviewer brief — current German word-bank audit

You are auditing one TSV batch from the **current committed word bank** used by a
British-English-speaking German learner app. Review every row manually and in order.
Do not sample, skim, or substitute automated pattern checks for lexical judgement.
Scripts may only help count rows or format your report.

The source banks are `data/nouns.json`, `data/verbs.json`, `data/adjectives.json`, and
`data/verbs-with-prepositions.json`. A major audit was applied in commit `4fbfd4e`; this
review is a fresh post-fix audit. Judge what is in your assigned TSV, not the old report.

## What to judge

### Nouns

For every noun assess: headword validity and spelling; article for the glossed sense;
standard citation plural and whether a plural is genuinely usable; English accuracy,
sense priority, idiomatic British English, and learner clarity; gross CEFR mismatch;
duplicates or inflected/corpus-junk headwords. **App-specific plural convention:** the UI
prepends `die ` to the stored plural. For adjectival nouns the stored weak form is therefore
intentional (`Erwachsenen` renders as `die Erwachsenen`; `Beamten` as `die Beamten`). Do
not flag these values merely because the determiner-free nominative citation form would be
`Erwachsene` or `Beamte`.

`cefrLevel` is intentionally optional. `UNSET` is not an error; only flag a populated
level when the mismatch is gross enough to mislead deck selection.

### Verbs

For every verb assess: infinitive/headword validity; regular/irregular classification;
Präteritum and Perfekt spelling and separability; `sein`/`haben`; reflexivity and valency;
English accuracy and missing everyday senses; gross CEFR mismatch; corpus junk or
participle/adverb/noun contamination. For a regular verb with blank stored forms, verify
that the app can safely derive them. Treat `withSein` missing as `haben`, matching the app.

### Adjectives

For every adjective assess: whether it is really a usable adjective lemma; stem or
comparative contamination; spelling; English accuracy, false-friend risk and British
English; gross CEFR mismatch; corpus junk, participles that are not lexical adjectives,
and duplicates.

### Verbs with prepositions

For every row assess: canonical verb/reflexive form, fixed preposition, governed case,
translation, and grammatical/natural example sentence. Flag ordinary contextual
prepositions incorrectly presented as fixed government.

## Severity and categories

- `high`: teaches a false fact (wrong article/plural/form/auxiliary/case/translation), or
  puts a non-member/junk item in a part-of-speech bank.
- `medium`: materially misleading sense choice, missing reflexivity/valency, unnatural
  learner model, or serious register/usefulness issue.
- `low`: lesser wording, sense-ordering, consistency, or debatable learner-quality issue.

Use categories: `article`, `plural`, `gloss`, `junk`, `cefr`, `verbform`, `aux`,
`classification`, `notadj`, `preposition`, `case`, `example`, `duplicate`, `spelling`.

## Deliverable

Write `audit/current-review/findings/<BATCHNAME>.md` with exactly this shape:

```md
# <BATCHNAME> (reviewed N entries, source rows X–Y)

## Errors
- **Wort** | `field` | severity=high|medium|low | category=<category>
  current: <current value>
  correct: <recommended value/action>
  why: <concise reason>

## Clean
<count> entries had no issues worth reporting.

## Coverage attestation
I manually evaluated all N rows in order, including the final row `<word>`.
```

One bullet per affected entry, combining multiple faults on that entry. Report only real
problems. If uncertain, use low severity and write `uncertain: yes`. The reviewed count
plus clean count must reconcile: clean = total rows minus affected entries. Do not edit
the source JSON or any other reviewer's file.
