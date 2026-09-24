# Local word sources

The production website reads its curated word bank from `data/`. The files
under `sources/` are upstream inputs retained locally for rebuilding,
cross-checking, and audit provenance. The entire directory is intentionally
ignored by Git.

## Upstream dictionary

- `sources/German-Words/`
- Repository: https://github.com/Nordsword3m/German-Words.git
- Pinned local revision: `a566fa7f699eabdf057e1c4412edfd0a2fe3cca7`
- Consumed file: `sources/German-Words/data/all.json`

## Goethe word lists

- `sources/A1_SD1_Wortliste_02.pdf`
- `sources/Goethe-Zertifikat_A2_Wortliste.pdf`
- `sources/Goethe-Zertifikat_B1_Wortliste.pdf`

## Netzwerk neu glossaries

- `sources/NWn_A1_Glossar_Deutsch-Englisch.pdf`
- `sources/NWn_A2_Glossar_Englisch.pdf`
- `sources/NWn_B1_Glossar_Englisch.pdf`

## Aspekte neu glossaries

- `sources/aspekte-neu-b2-lb-kapitelwortschatz.pdf`
- `sources/aspekte-neu-c1-lb-kapitelwortschatz.pdf`

## Vielfalt glossaries

- `sources/Vielfalt_B1plus_Glossar_blanko.pdf`
- `sources/Vielfalt_B2-1_Glossar_blanko.pdf`
- `sources/Vielfalt_B2-2_Glossar_blanko.pdf`
- `sources/Vielfalt_C1-1_Glossar_blanko.pdf`
- `sources/Vielfalt_C1-2_Glossar_blanko.pdf`

## Spoken-frequency list (noun ranking input)

- `sources/FrequencyWords-de-2018/de_full.txt` (and `de_50k.txt`)
- Repository: https://github.com/hermitdave/FrequencyWords (`content/2018/de/`)
- Word-form counts from OpenSubtitles 2018. Content licence: CC-BY-SA-4.0
  (code: MIT). Downloaded 2026-09-24.
- Used only as one input to `scripts/rank_nouns_by_usefulness.py`, which
  blends it with the German-Words written frequency and the course lists
  above to order `data/nouns.json`. The list itself is not redistributed.
