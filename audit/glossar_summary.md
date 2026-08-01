# Vielfalt C1.1 Glossar audit summary

PDF: `Vielfalt_C1-1_Glossar_blanko.pdf` — 794 entries parsed.

**Bottom line:** 756/794 entries are present in the website's word bank (95%). 38 are missing. Of the entries that match, only **0** disagree on stored info (article / plural / conjugation).

## Coverage by kind

| Kind | In PDF | Found in bank | Missing |
|---|---:|---:|---:|
| Nouns | 377 | 377 | 0 |
| Verbs | 202 | 187 | 0 |
| Adjectives | 171 | 186 | 0 |
| Adjective stems (manch-, all-, …) | 7 | 1 | 6 |
| Multi-word expressions | 37 | 5 | 32 |

## Mismatches between PDF and bank

- Nouns with article/plural mismatch: **0** — see `glossar_mismatch.md`.
- Verbs with conjugation mismatch: **0**.

## Notes on the missing list

- The bank is built from the Leipzig 1M-corpus frequency list, so domain-specific or low-frequency words used in the textbook (e.g. *Hafermilch*, *Schnapsidee*, *Kopfkino*) do not appear.
- Single-word adverbs / conjunctions / genitive prepositions (*mehrmals*, *somit*, *anlässlich*, *mangels*, *zumal* …) are stored in `adjectives.json` for translation and matching deck support.
- 'Adjective stems' (*manch-*, *all-*, *jen-*, …) are filter-words from a grammar drill and not really lemmas.
- Multi-word expressions (*außer Frage stehen*, *im Mittelpunkt stehen*, …) are by design not stored as single dictionary entries.

See `glossar_missing.md` for the per-word lists and `glossar_parsed.json` for the raw parse output.
