# Confirmed defect classes — check every entry against these

Accumulated from 40 audited batches (27,942 entries). All examples below are **verified**
against the data. Use them as the pattern to hunt, not as an exhaustive list.

## 1. Wrong article (39 confirmed — originally believed to be zero)
Loanwords are the worst offenders, but native words fail too.

- Loanwords: `der Radio`, `der Autoradio`, `die Feature`, `der Logo`, `der Kilo`, `der Fax`,
  `der Poster`, `der Backup`, `der Bluetooth`, `der Release`, `der Firewall`, `der Trikot`,
  `der Couch`, `der Silvester`, `der Taxi`, `der Cannabis`, `der Tattoo`, `der Challenge`,
  `der Headset`, `der Iban`, `der Riff`, `der Zucchini`, `der Match`, `der Ghetto`,
  `der Juwel`, `der Workout` — nearly all should be `das` or `die`.
- Native: `der Zwiebel` (→die), `der Ersatzteil` (→das), `der Einzelteil` (→das),
  `das Schnupfen` (→der), `der Schnitzel` (→das), `der Socken` (→die Socke),
  `die Mosaik` (→das), `der Graffito` (→das), `der Pfand` (→das), `das Treff` (→der),
  `der Kontur` (→die), `die Versäumnis` (→das), `der Münster` (→das).
- **Plurale-tantum given a singular article**: `das Masern`, `das Gasteltern`,
  `das Gebrüder`, `das Trümmer`, `das Eckdaten`, `das Wirren`.
- **Dialect/regional gender presented as standard** (`der Socken`, `die Versäumnis`).

## 2. Wrong plural
- **Invented plurals on mass/abstract nouns** (~200 found): `Beginn→Beginne`,
  `Musik→Musiken`, `Polizei→Polizeien`, `Software→Softwares`, `Blut→Blute`,
  `Stress→Stresse`, `Mais→Maise`, `Spinat→Spinate`, `Wolle→Wollen`. Correct value is `—`.
- **Plural borrowed from a different lexeme**: `Heck→Hecke` ("hedge"),
  `Etikett→Etikette` ("etiquette"), `Strass→Strasse` ("street"), `Zeug→Zeuge` ("witness"),
  `Fülle→Füllen` ("foal"), `Star→Stare` (starling plural), `Applaus→Applause` (English).
- **Wrong irregular**: `Kaufmann→Kaufmänner` (→`Kaufleute`),
  `Bergmann→Bergmänner` (→`Bergleute`), `Regenbogen→Regenbogen` (→`Regenbögen`),
  `Preisnachlass→Preisnachlasse` (missing umlaut).
- **Adjectival nouns (`adjNoun` flag) carry the weak `-en` plural** instead of the bare
  citation form — `Erwachsenen` for `Erwachsene`. This appears in EVERY noun batch so far.

## 3. Lost or displaced primary sense — THE MOST DAMAGING CLASS
Glosses are alphabetically sorted, so senses that sort early survive and the core everyday
meaning is sometimes **absent entirely**. Verified:

| word | cefr | gloss in bank | missing |
|---|---|---|---|
| `die Birne` | A1 | bulb/globe/nut | **pear** |
| `der Herd` | A1 | focus/hearth/hotbed | **cooker/hob** |
| `der Anzug` | A1 | approach/attire/move | **suit** |
| `der Aufzug` | A1 | act/approach/attire | **lift** |
| `der Kellner` | A1 | cellarer/cellarman/cellarmaster | **waiter** |
| `der Schnitzel` | A1 | escalope/snippet | the food sense |
| `die Muschel` | — | bivalve shellfish/clam/clamshell | **shell, mussel** |
| `der Hirte` | — | herder/herdsman | **shepherd** |
| `die Ausrede` | B2 | pretext | **excuse** |
| `der Giebel` | — | Prussian carp/gable | (fish leads) |
| `die Leiste` | — | band/bar/fess | **skirting board, groin** |
| `der Becher` | A1 | Crater/beaker/cup | (constellation leads) |

**Check every common word for a missing or displaced primary sense.**

## 4. Morpheme-mangled compounds — flatly wrong translations
Each part translated separately with the wrong sense chosen:
`Vertragsarzt` = "agreement doc" · `Kultusminister` = "cult minister" ·
`Kritikpunkt` = "criticism dot" · `Risikobewertung` = "chance assessment" ·
`Einsendung` = "one desinence" · `Leitsatz` = "composition" · `Vorarbeit` = "business" ·
`Dachorganisation` = "roof organisation". **Read every compound gloss for this.**

## 5. False friends glossed as their English lookalike
`Publizist` ≠ "publicist" · `Protestant` wrongly glossed "demonstrator/protester" ·
`Ausspruch` glossed "pronunciation" (that is `Aussprache`) · `Engländer` glossed
"British/Briton" (means **Englishman**) · `Kran` glossed "faucet".

## 6. Non-words / misspellings / offensive terms in glosses
"buttershag" · "momification" · "sweapstakes" · "one desinence" · "chantage" · "billett" ·
"oversise" · "opinionaire" · "attack piece" · `Nationalsozialismus` = "**NatSoc**"
(neo-Nazi shorthand, sorted first) · `behindert` = "handicapped" (use "disabled").

## 7. Fabricated headwords / corpus junk
- Nominalised infinitives: `das Fallen`, `das Reisen`, `das Lernen`, `das Waschen`.
- Plurals entered as lemmas: `die Blicke`, `die Drucke`, `die Kästen`, `der Gräber`
  (its own gloss reads "graves (plural of Grab)"), `die Pedale`, `die Taxis`.
- Back-formations: `die Fossilie` (real lemma `das Fossil` is also present).
- Plurale-tantum as singular: `die Feuerwehrleute`, `die Bergleute`, `der Lebzeiten`.
- Place/company names: `das Aalen`, `das Posen`, `das Microsoft`.
- Non-German lexemes: `das Food`. Archaic duplicates: `der Kursus`, `der Dinosaurus`.

## 8. British English violations
App is British English. Flag:
- US-only glosses: sneaker (→trainer), drugstore, faucet, gas station, vacation, soccer,
  mailman, parking lot, flashlight (→torch), diaper (→nappy), feces, ardor.
- US spellings with no British form: labor, favorite, defense, judgment, sulfur, fiber,
  program (for programme), -ize/-yze.
- **Both spellings in one gloss** — forbidden: "ax/axe", "courgette/zucchini",
  "storey/story", "ageing/aging", "leukaemia/leukemia".
- **US term ordered before the British one** (an artefact of alphabetical sorting):
  "apartment/flat", "cell phone/mobile phone", "sidewalk/pavement", "garbage/rubbish".

## 9. CEFR nonsense
`cefrLevel` records which course glossary a word came from, not difficulty. Flag only
gross cases: a top-200 everyday word tagged C1, or a rare/technical word tagged A1.
