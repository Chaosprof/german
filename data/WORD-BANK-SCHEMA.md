# Learner word-bank contract

This repository keeps source/reference coverage separate from what may safely be
shown as a single-answer learner card. The website remains compatible with the
legacy top-level fields, while the reviewed data can express senses and editorial
status without collapsing genuine ambiguity.

## Common fields

- `id`: stable, bank-specific identifier. Never derive identity from array order
  or spelling after migration.
- `active`: `false` retains a source/reference record but removes it from games.
- `learnerSafe`: `false` means the record must not be used as a scored answer.
- `reviewStatus: "reference_only"`: an explicit quarantine for ambiguous,
  malformed, duplicated, or otherwise unsafe legacy records.
- `reviewHistory[]`: finding ID, date, severity, action, disposition, and the
  review recommendation. This is provenance, not learner-facing copy.
- `cefrLevel`: the recommended first teaching level. When a review could support
  only a range, `cefrApproximate: true` and `cefrRange` preserve that uncertainty.
- `senses[]`: optional sense-level records. Each has a stable `id`; one may be
  marked `default: true` for the backward-compatible top-level card.

An entry is playable only when `active !== false`, `learnerSafe !== false`, and
none of its `learnerSafety.excludeFrom…` flags excludes the current drill.

## Nouns

Playable nouns require `article` to be exactly `der`, `die`, or `das`. Proper
names and articleless records may use `—`, but must be inactive and reference
only. `noun-help.json` is keyed by stable noun sense ID, not by spelling, so
homographs can receive different help. Help states only reviewed facts; it does
not infer suffixes or compound heads from raw spelling.

The website's internal noun tuple is still backward compatible:
`[word, article, plural, english, rank, id]`. Custom and textbook decks that
store only a spelling continue to resolve through the spelling index.

## Verbs

The legacy top-level fields (`word`, `english`, `prateritum`, `perfekt`,
`withSein`) describe the reviewed default sense. Rich `senses` preserve
reflexivity, separability, valency, auxiliary alternatives, principal parts,
and attested patterns when relevant.

Every playable irregular verb must have a complete preterite, participle, and
boolean auxiliary choice. `formRuleIds` links a verb to reviewed formation rules
shown by the verb-form game.

## Adjectives and participles

Valid lexical adjectives remain playable. Productive participles that are useful
as vocabulary may remain in the reference bank but can carry
`learnerSafety.excludeFromCoreLemmaDrills` or
`learnerSafety.excludeFromAdjectiveDrills`. Non-adjectival leakage is inactive.

## Maintenance workflow

After applying editorial manifests, run:

```text
python scripts/finalize_reference_records.py
python scripts/migrate_learner_schema.py
python scripts/validate_word_bank.py
python scripts/validate_learner_quality.py
```

Do not reactivate a reference-only row without resolving the review finding and
updating its history. Do not remove stable IDs when re-ranking or regenerating a
bank.
