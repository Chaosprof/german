# Noun Audit Summary

Generated: 2026-04-01T20:37:27.878Z

## Counts

- Total nouns audited: 5000
- Exact article+plural match to bundled source: 4596
- Exact article+plural+English match to bundled source: 3804
- Singular-only nouns represented as no plural: 403
- Ambiguous lemmas with multiple noun entries in source: 150
- Entries whose English gloss should be manually reviewed: 825
- Entries whose plural should be manually dictionary-checked: 5

## Main Findings

- I found no clear article errors against the bundled German-Words source.
- I found no clear plural errors against the bundled German-Words source once singular-only nouns are treated as having no plural in the app.
- The main quality problem is the English gloss field. Many entries inherit noisy or badly ordered Wiktionary/Kaikki translation lists, and the app keeps only the first few senses.
- Homographs are common. The app usually picks a valid sense, but some lemmas have other articles or plurals in other senses.

## Top-Ranked Gloss Problems

- 14. Schule: app="school/shoal" source="school/shoal"
- 19. Frau: app="Mrs/Mrs./spouse" source="Mrs/Mrs./spouse/wife/woman"
- 36. Ort: app="awl/border roof at the side of the façade/canton" source="awl/border roof at the side of the façade/canton/human settlement/inhabitant/location/place/point/settlement/site/situation/spot/tip/town"
- 41. Aufgabe: app="abandonment/business/checking-in" source="abandonment/business/checking-in/dropping/duty/giving up/job/mailing/posting/registration/task"
- 51. Programm: app="channel/cycle/program" source="channel/cycle/program/programme/schedule"
- 58. Einsatz: app="beginning/commitment/cue" source="beginning/commitment/cue/dedication/effort/entrance/entry/input/inset/involvement/mission/poker bet/service/stake/usage"
- 62. Haus: app="bod/cookie/critter" source="bod/cookie/critter/family/home/house/household/shell/slugger"
- 63. Stelle: app="digit/job/office" source="digit/job/office/passage/place"
- 68. Mann: app="God/husband/man" source="God/husband/man/men/oh boy/spouse"

## Plural Review Candidates

- 1821. Content: der, plural Contents, gloss "content"
- 1827. Support: der, plural Supporte, gloss "support"
- 1829. Community: die, plural Communitys, gloss "community"
- 1837. Teilzeit: die, plural Teilzeiten, gloss "part-time"
- 1853. Optik: die, plural Optiken, gloss "optics"

See `audit/nouns-audit.json` for the full per-word audit.
