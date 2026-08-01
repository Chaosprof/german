# Word-bank remediation report

Reviewed and applied: 2026-08-01

## Outcome

Every one of the 3,280 retained audit findings is represented in the corrected
data and linked through `reviewHistory`:

| Bank | Findings |
|---|---:|
| Nouns | 1,829 |
| Adjectives | 763 |
| Verbs | 633 |
| Dual-gender nouns | 30 |
| Verbs with prepositions | 25 |
| **Total** | **3,280** |

The retained findings comprised 602 high-, 1,489 medium-, and 1,189 low-severity
issues. The application result is:

| Disposition | Findings | Meaning |
|---|---:|---|
| Corrected | 2,920 | A precise learner-safe correction was applied. |
| Reference only | 360 | The source record is retained, but no single answer is presented to learners. |

Reference-only is an intentional quality decision, not an unresolved live error.
It is used where a legacy row conflated senses, supplied unsafe morphology, was a
duplicate/form rather than a lemma, or could not be corrected without inventing
unsupported certainty. Validation guarantees that none of these findings remains
playable.

## Learner-facing bank after remediation

| Bank | Playable | Reference only/excluded |
|---|---:|---:|
| Nouns | 25,691 | 256 |
| Verbs | 5,335 | 107 |
| Adjectives | 9,049 | 213 |
| Verbs with prepositions | 363 | 1 |
| Dual-gender records | 98 | 0 |

This leaves 40,438 playable primary records, plus all 98 reviewed dual-gender
records. The source rows are preserved for provenance and later editorial work;
the game filters them before constructing a deck.

## Corrections and structural improvements

- Corrected articles, plurals, translations, headwords, spelling, CEFR metadata,
  weak-noun flags, verb paradigms, reflexivity, separability, auxiliaries,
  valency, examples, and preposition/case pairings according to the manifests.
- Added stable IDs and sense-aware structures while retaining legacy fields for
  website and saved-deck compatibility.
- Replaced word-keyed noun help with sense-ID help. Removed unverified suffix,
  percentage, and compound-parser claims.
- Added reviewed confidence/source labels to article rules and removed false or
  overgeneralized categories and exceptions.
- Rewrote verb-form rules for weak, strong, mixed, modal, auxiliary, separable,
  inseparable, and imperative formation; linked applicable verbs with
  `formRuleIds`.
- Corrected the two-way-preposition explanation to distinguish destination or
  change of location from location, rather than the misleading movement/static
  shortcut. The `als` note now distinguishes subject- and object-related uses.
- Preserved approximate CEFR judgments explicitly with `cefrApproximate` and
  `cefrRange` instead of presenting a range as an exact fact.
- Removed editorial markup/instructions from learner-visible glosses and
  deactivated post-normalization duplicates.

## Website compatibility

The site now builds decks only from active, learner-safe records. Noun help and
grammar explanations resolve by stable sense ID with a legacy spelling fallback.
Existing custom/textbook decks that contain only word strings still work. Verb
form review cards can expose the linked formation rules, and rule confidence and
learner notes are visible without replacing shared grammar guidance.

## Reproducible verification

The correction pipeline is implemented in:

- `scripts/apply_current_review_remediation.py`
- `scripts/finalize_reference_records.py`
- `scripts/migrate_learner_schema.py`

Two independent guards cover the result:

- `scripts/validate_word_bank.py`: IDs, schema, counts, noun help, rule links,
  articles, duplicates, and playable irregular paradigms.
- `scripts/validate_learner_quality.py`: all 3,280 findings accounted for,
  quarantines enforced, learner-copy cleanliness, and the corrected grammar-rule
  invariants.

Both validators pass on the remediated bank. The source manifests and their
per-bank reports are retained in `audit/current-review/remediation/`.
