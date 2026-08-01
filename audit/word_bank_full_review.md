# Word-bank full review

Scope: `data/nouns.json`, `data/verbs.json`, `data/adjectives.json`, and `data/verbs-with-prepositions.json`.

## Summary

- Rows reviewed: **41701**
- Blank English glosses: **0**
- High-confidence translation/POS issues: **0**
- Fixed-preposition issues: **0**
- Targeted article-rule issues: **0**
- Noun plural-help text mismatches: **0**

## File checks

| file | rows | meta count | rank max | rank gaps | duplicate ranks | blank English |
|---|---:|---:|---:|---:|---:|---:|
| `data/nouns.json` | 25995 | 25995 | 26523 | 528 | 0 | 0 |
| `data/verbs.json` | 5583 | 5583 | 5583 | 0 | 0 | 0 |
| `data/adjectives.json` | 9759 | 9759 | 9761 | 2 | 0 | 0 |
| `data/verbs-with-prepositions.json` | 364 | 364 | 370 | 6 | 0 | 0 |

## High-confidence translation/POS issues

No unresolved high-confidence translation/POS issues.

## Fixed-preposition issues

No unresolved fixed-preposition issues.

## Form/article notes

- Targeted article checks found no clear `der/die/das` corrections in the active nouns.

- Stored noun plural-help text matches the stored plural for all rows checked.

## Rank notes

- `data/verbs-with-prepositions.json` has rank gaps at: 110, 192, 223, 280, 289, 298.
- `data/nouns.json` has non-dense ranks because the bank preserves source/frequency ranks after filtering; I did not treat those as linguistic errors.
