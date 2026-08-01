# Textbook deck word review (Goethe / Vielfalt / Aspekte / Netzwerk)

Reviewed: every noun/verb/adjective referenced by the textbook decks, looked up
in `data/nouns.json`, `data/verbs.json`, `data/adjectives.json`. Checks:
article correctness, plural correctness, translation quality, and rule-help
text. Cross-checked articles + plurals against the independent upstream
dataset `sources/German-Words/data/all.json`.

Tooling: `scripts/review_deck_words.py`, `scripts/crosscheck_articles_plurals.py`.

## 1. Coverage — unique lemmas across all textbook decks

**Total unique: 10,793** — **6,401 nouns, 2,126 verbs, 2,266 adjectives.**

Per series (series overlap, so these sum to more than the de-duplicated total):

| Series | Nouns | Verbs | Adjectives | Total |
|---|---:|---:|---:|---:|
| Goethe (A1/A2/B1) | 1,855 | 661 | 635 | 3,151 |
| Vielfalt (B1+/B2.1/B2.2/C1.1/C1.2) | 1,636 | 809 | 758 | 3,203 |
| Aspekte (B2/C1) | 2,945 | 1,174 | 1,061 | 5,180 |
| Netzwerk (A1/A2/B1) | 2,707 | 761 | 851 | 4,319 |

## 2. Articles — effectively 100% correct

- Cross-check vs upstream flagged only **11 disagreements**, and in **every one the
  app is right** (upstream is wrong or incomplete): `das Drittel/Viertel/Fünftel`
  (fractions), `das Event`, `das Foto`, `die Waise`, `die Butter` (the app even
  documents "der Butter is regional"), `das Radiofeature`. No action needed.
- Suffix-rule checks (-ung/-heit/-keit/-chen/-ung/-tum/-in …) found **0 real
  article errors** among deck nouns.
- **289** nouns carry a `ruleId` that disagrees with their article — all are
  legitimate `isException: true` markers with correct explanatory `articleHelp`
  ("Most Ge- nouns are das, but this one is die …"). This exception system is a
  strength.

**Only 2 genuine article-rule defects** (the article is correct; the *rule label
shown to the learner* is wrong):
- `das Auslandssemester` — `articleHelp` says "-er agent nouns are mostly der";
  it should reference `das Semester`. (ruleId `der.suffix_er`, not flagged exception.)
- `der Qualitätssprung` — `articleHelp` says "-ung → always die"; this is a
  `der Sprung` compound. (Also has a malformed plural — see below.)

## 3. Plurals — one real generator bug, ~70 affected deck nouns

Articles are clean, but a **compound-noun plural generator** has produced wrong
forms. Cross-check vs upstream + internal help-marker checks found ~70 genuine
errors in four shapes:

1. **Malformed umlaut truncation (17)** — umlauts the stem but drops the ending,
   producing non-words:
   `Backsteinhaus→"Backsteinhäus"` (Backsteinhäuser), `Bundesverband→"Bundesverbänd"`,
   `Deutschbuch→"Deutschbüch"`, `Fragewort→"Fragewört"`, `Freiraum→"Freiräum"`,
   `Hochschulabschluss→"Hochschulabschlüss"`, `Hustensaft→"Hustensäft"`,
   `Lebensplan→"Lebensplän"`, `Löschblatt→"Löschblätt"`, `Probenraum→"Probenräum"`,
   `Pulsschlag→"Pulsschläg"`, `Rachefeldzug→"Rachefeldzüg"`, `Scheidungsgrund→"Scheidungsgründ"`,
   `Suppenhuhn→"Suppenhühn"`, `Tagebucheintrag→"Tagebucheinträg"`, `Wortanfang→"Wortanfäng"`,
   `Billiglohnland→"Billiglohnländ"`.
2. **Doubled stem (5)** — head plural appended to the full singular:
   `Bundesministerium→"Bundesministeriumministerien"` (Bundesministerien),
   `Computerfirma→"Computerfirmafirmen"` (Computerfirmen),
   `Familiendrama→"Familiendramadramen"`, `Musikalbum→"Musikalbumalben"`,
   `Stuntman→"Stuntmanmen"`.
3. **Wrong/missing umlaut (7)** — `Blaumann→"Bläumann"` (Blaumänner),
   `Herbststurm→"Herbststurme"` (Herbststürme), `Nachbardorf→"Nachbardorfer"` (Nachbardörfer),
   `Satzanfang→"Satzanfange"` (Satzanfänge), `Wortstamm→"Wortstamme"` (Wortstämme),
   `Witwer→"Witwern"` (Witwer, invariant), `Fauxpas→"Fauxpass"` (Fauxpas, invariant).
4. **Plural left equal to the singular (≈40)** where the noun is countable —
   `pluralHelp` even says how to change it. Includes:
   - **14 feminine `-in` nouns** missing the `-innen` plural (the help text says
     "+nen plural." but the field shows the singular): Augenoptikerin,
     Englischlehrerin, Entertainerin, Fernfahrerin, Gebärdendolmetscherin,
     Herzchirurgin, Kletterin, Kunstexpertin, Lernhelferin, Nachrichtensprecherin,
     Radiosprecherin, Stadtbewohnerin, Synchronsprecherin, Wanderin.
     (Note: ~47 other `-in` deck nouns *were* pluralised correctly — the bug is partial.)
   - **8 `-ung`/`-ion` nouns** missing `-en`: Bildbeschreibung, Datenschutzbestimmung,
     Ferienwohnung, Filmbeschreibung, Kurzbeschreibung, Lernerfahrung,
     Platzreservierung, Sofort-Überweisung.
   - compound/other countables: Arbeitswelt, Bahnhofshalle, Eishöhle, Fragesatz,
     Hauptsatz, Gegenvorschlag, Oberarzt, Skistock, Kosename, Kunstexperte,
     Käsebrot, Glückwunschkarte, Fußballschuh, Lampion, Tiername, Verkehrsproblem … ;
     loanwords missing `-s`: `Assessment→"Assessments"`, `Bordbistro→"Bordbistros"`,
     `Trattoria→"Trattorien"`.

**Related rule-tagging slip (6):** non-feminine nouns ending in -in/-ein were
tagged `pluralHelp: "+nen plural."` though their (correct) plural is `-e`:
Besprechungstermin, Endorphin, Karrieremagazin, Kindesbein, Kinogutschein,
Stadtmagazin. Here the plural field is fine; the help marker is wrong.

**Lower-confidence / defensible (~91):** nouns the app marks plural `—` where
upstream lists a rare/theoretical plural. Most are correctly treated as
mass/abstract (Milch, Reis, Sport, Toleranz, Verantwortung, months …). A
minority of countables arguably *should* carry a plural: Lauf→Läufe,
Anbau→Anbauten, Umgang→Umgänge, Migrationshintergrund→Migrationshintergründe,
Sprachschatz→Sprachschätze, Zeitmangel→Zeitmängel.

Full machine list: `scripts/crosscheck_articles_plurals.py`.

## 4. Translations — good; small British-spelling cleanup

Current glosses are concise and learner-appropriate. (The historical
`audit/nouns-audit.json` flagged 825 "gloss problems" in the top 5000, but those
are **already fixed** — e.g. `Haus` is now "house/home" not "bod/cookie/critter",
`Ort` is "place/location", `Aufgabe` is "task/assignment".)

Remaining issues, all minor, all per the British-spelling rule:
- **~21 US spellings** to anglicise: behaviour (Konsumverhalten, Verhaltenstherapie,
  Verhaltensregel, Bewältigungsverhalten, Gesundheitshandeln), colour (Farbstift),
  centre (Klinikum, Lebensmittelpunkt, Paketzentrum), theatre (Theaterbesuch,
  Open-Air-Kino), honour (Ehrentag), mould (Schimmel), neighbourhood (Stadtteil);
  verbs/adjectives: realise (eingesehen), emphasise (hervorgehoben), flavourful
  (aromatisch), recognisable (erkennbar), cosy (gemütlich), skilful (geschickt),
  realisable (realisierbar).
- **~4 dual UK/US glosses** (rule: never both): Geruch "odor/odour", Hautfarbe
  "skin color/skin colour", Programm "program/programme", plus enrol/fulfil cases.

## 5. Rules (articleHelp / pluralHelp) — strong, but ~23% of nouns thin

- The rule content is high quality: suffix rules, semantic categories, and
  per-noun exception notes are accurate and genuinely useful for learners.
- Coverage of deck nouns: **rich help 4,928 (77%)**, terse one-liner **660 (10%)**,
  **none 813 (13%)**. The ~1,473 thin/empty entries are the later deck-import
  additions; they're also where the plural bugs above cluster. Back-filling rich
  `articleHelp`/`pluralHelp` for these would close the gap.
- Irregular verbs: **all** carry Präteritum + Perfekt (0 missing); forms
  spot-checked correct (bezog/bezogen, kam auf/aufgekommen, erhielt aufrecht/…).

## Bottom line

Articles and verb forms are essentially flawless; translations are good with a
small British-spelling pass outstanding; the one systemic defect is the
compound-noun **plural generator** (~70 malformed/unchanged plurals) concentrated
in the thin deck-import entries, which also lack rich rule-help.

---

## Fixes applied (2026-06-14)

All three issues above were fixed. Tooling:
`scripts/backfill_thin_deck_nouns.py`, `scripts/anglicise_glosses.py`
(+ `generate_nouns.py` given a `__main__` guard so its generators are importable).

1. **Plurals — 90 deck nouns corrected.** 78 got correct plural forms
   (malformed `Backsteinhäus`→`Backsteinhäuser`, doubled `Computerfirmafirmen`→
   `Computerfirmen`, 14 feminine `-innen`, `-ung`→`-en`, wrong-umlaut
   `Herbststurme`→`Herbststürme`); 12 mass nouns wrongly stored with
   plural==singular were set to no-plural (`Schulkleidung`, `Pop`…). Curated
   entries (`Ton`→Töne, `Umbau`→Umbauten) were preserved. Cross-check vs upstream:
   malformed 41→0, doubled 6→0 real, feminine/`-ung` singular-left→0; remaining
   disagreements are all legitimate variants (`Denkmäler`, `Risiken`, `Euro`).
2. **Rule-help — back-filled for all thin entries.** 1,473 `articleHelp` +
   1,517 `pluralHelp` regenerated via the existing generator. Deck-noun help
   coverage **77% → 100%** (rich=6,401, thin=0, none=0). `isException` entries
   and already-rich help were left untouched. This also auto-fixed the 2
   rule-label bugs (`Auslandssemester`, `Qualitätssprung` now show the compound
   rule; their stale `ruleId`s were removed).
3. **British spelling — 110 glosses anglicised** (87 nouns, 10 verbs, 17 adj):
   behaviour, colour, centre, theatre, honour (not "honorary"), neighbour,
   flavour, odour, mould, cosy, skilful, fulfil(ment), enrol, and `-ise`
   (realise/recognise/emphasise/organise/analyse). Dual UK/US glosses resolved
   (`Geruch`, `Hautfarbe`, `Programm`); duplicate senses collapsed.

Post-fix review: 0 missing-help findings, 0 real article/rule-tag bugs, 0 real
plural bugs, 0 US spellings (the few remaining flags are false positives —
correct umlaut plurals and German text in explanatory parentheses).
