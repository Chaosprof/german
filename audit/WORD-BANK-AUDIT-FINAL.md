# German word bank — full audit report

**Date:** 31 July 2026
**Scope:** `data/nouns.json`, `data/verbs.json`, `data/adjectives.json`
**Coverage:** 41,328 / 41,328 entries — **100%, every entry read and judged individually**

---

## 1. Method

The bank was split into 60 batches of ~700 entries and each batch assigned to a reviewer
that read every row in order and applied linguistic judgement per word. Scripting the
review was explicitly forbidden; scripts were used only to build batches, verify coverage,
and consolidate results.

Reviewers worked to a fixed brief (`audit/REVIEW-BRIEF.md`) and, from batch 19 onward, to a
shared list of already-confirmed defect classes (`audit/DEFECT-CLASSES.md`), so later
batches hunted patterns proven earlier.

**Coverage verification.** Reviewer self-reports were not trusted. For each of the 60
findings files, every German word mentioned was mapped back to its row position in the
source batch, excluding the 765 words seeded by my own reference documents. Result:
**minimum reach 97.7%**, every file contains findings from its final third. A reviewer that
stopped early could not flag row 684 and then write a closing summary. Truncation is
additionally ruled out structurally: the write tool takes the whole file as one parameter,
so a killed reviewer leaves either a complete file or none.

**Residual limitation.** For an entry with no finding, "reviewed and clean" cannot be
distinguished from "not examined". Confidence in the ~2% tail of each batch is therefore
slightly lower than in the body.

---

## 2. Verdict

The German data is fundamentally sound and the collection is valuable. The **English side
is not trustworthy**, and the defects concentrate — badly — at A1/A2, where the learners
who can least detect an error are the ones being taught.

| | |
|---|---|
| Entries reviewed | 41,328 |
| Total findings | **5,122** |
| High severity (teaches something false) | **880** |
| Medium | 2,128 |
| Low | 2,114 |
| Entries affected | ~4,400 (≈11% of the bank) |

### Findings by bank

| Bank | Entries | Findings | Rate |
|---|---|---|---|
| `nouns.json` | 25,986 | 3,073 | 11.8% |
| `adjectives.json` | 9,759 | 1,315 | 13.5% |
| `verbs.json` | 5,583 | 734 | 13.1% |

### Findings by category

| Category | Total | High |
|---|---|---|
| Gloss (translation) | 3,224 | 240 |
| Plural | 707 | 232 |
| Junk headword | 522 | 119 |
| Verb auxiliary | 290 | 126 |
| Article | 174 | 93 |
| Verb forms | 70 | 35 |
| CEFR | 68 | — |
| Not an adjective | 67 | 35 |

---

## 3. Corrections to the earlier scripted report

An initial pass using automated checks (`audit/word-bank-review-2026-07-30.md`) reported
several reassuring zeros. **Three were produced by checks that were incapable of returning
anything else.** They are corrected here and that report should be read only alongside this one.

| Original claim | Reality | Why the check failed |
|---|---|---|
| "Articles are flawless — 0 errors" | **93 high-severity article errors** | Compound-head check compared lowercase tails (`"teil"`) against capitalised headwords (`"Teil"`) — it could never match. Suffix rules didn't cover loanwords. |
| "0 compound-head gender mismatches / 25,986" | Check was inoperative | As above. The zero was meaningless. |
| "0 missing plural fields" | **12 entries have `plural: null`** — app renders the literal string "None" | Test was `not str(e.get('plural','')).strip()`; `str(None).strip()` is `'None'`, which is truthy. |
| "Verbs ~1% error rate" | True of the 1,202 irregulars only. The regular-verb tail hides a 121-entry contamination block | Consistency checks only ever operated on irregulars. |
| "`plural == singular`, 3,539, mostly legitimate" | 3,198 are legitimate; **341 are not**, and many are real errors | Dismissed the class without inspecting the non-conforming subset. |

**Lesson:** a passing structural check is evidence only if the check has been shown capable
of failing. The per-word review found every one of these.

---

## 4. Defect classes

### A. Wrong articles — 174 findings, 93 high

The single most damaging class for a German learner, because gender is memorised with the
noun and is hard to unlearn.

**Loanwords** (no native head noun, so no rule catches them):
`der Radio` · `der Autoradio` · `die Feature` · `der Logo` · `der Kilo` · `der Fax` ·
`der Poster` · `der Backup` · `der Bluetooth` · `der Release` · `der Firewall` ·
`der Trikot` · `der Couch` · `der Taxi` · `der Cannabis` · `der Tattoo` · `der Challenge` ·
`der Headset` · `der Iban` · `der Riff` · `der Zucchini` · `der Ghetto` · `der Tape` ·
`der Array` · `der Salami` · `das Basics`

**Native words:**
`der Zwiebel` (→die) · `der Ersatzteil` (→das) · `der Einzelteil` (→das) ·
`das Schnupfen` (→der) · `der Schnitzel` (→das) · `der Socken` (→die Socke) ·
`die Mosaik` (→das) · `der Graffito` (→das) · `der Pfand` (→das) · `das Treff` (→der) ·
`der Kontur` (→die) · `die Versäumnis` (→das) · `der Münster` (→das) · `der Polster` (→das) ·
`der Geisel` (→die) · `das Furnier` · `der Ozon` (→das) · `der Barometer` /
`der Thermometer` (→das) · `der Zepter` (→das) · `der Nutzungsart` (→die)

**Plurale-tantum nouns given a singular article** — a systematic sub-fault (~25 entries):
`das Masern` · `das Gasteltern` · `das Gebrüder` · `das Trümmer` · `das Eckdaten` ·
`das Wirren` · `das Magenbeschwerden` · `das Adoptiveltern` · `die Flitterwochen` ·
`das Kontodaten` · `das Rohdaten` · `das Heimtextilien` · `das Schwiegereltern` ·
`das Pflegeeltern` · `das Urgroßeltern` · `das Staatsfinanzen` · `das Leggings` ·
`das Shorts` · `das Cornflakes` · `das Augentropfen` · `das Anziehsachen`

**Wrong gender chosen for a dual-gender noun** — `das Teil` (rank 26) is the wrong choice:
the frequent, learner-essential word is **der Teil**. The bank contradicts itself here —
sixteen `-teil` compounds correctly take **der** (`der Vorteil`, `der Anteil`,
`der Bestandteil`, `der Nachteil`, `der Großteil`, `der Elternteil`, `der Körperteil`…),
inheriting from a head noun the base entry declares neuter. Likewise `der Gehalt`
("content") was chosen over the A2-essential `das Gehalt` ("salary"), and `der Schild`
("shield") over the everyday `das Schild` ("sign").

### B. Wrong plurals — 707 findings, 232 high

**B1. Invented plurals on mass/abstract nouns** (~200). The `—` convention exists and is
used correctly elsewhere (`Gesundheit`, `Verantwortung`, `Ruhe`), so this is inconsistency:
`Beginn→Beginne` · `Alltag→Alltage` · `Unterricht→Unterrichte` · `Software→Softwares` ·
`Polizei→Polizeien` · `Musik→Musiken` · `Dauer→Dauern` · `Verkehr→Verkehre` ·
`Blut→Blute` · `Stress→Stresse` · `Bewusstsein→Bewusstseine` · `Mais→Maise` ·
`Spinat→Spinate` · `Wolle→Wollen` · `Chemie→Chemien` · `Beton→Betons`

**B2. Plural borrowed from a different lexeme** — actively teaches a wrong word:
`Heck→Hecke` (hedge) · `Etikett→Etikette` (etiquette) · `Strass→Strasse` (street) ·
`Zeug→Zeuge` (witness) · `Fülle→Füllen` (foal) · `Star→Stare` (starling) ·
`Applaus→Applause` (the English word) · `Genesis→Genesen`

**B3. Wrong irregulars:** `Kaufmann→Kaufmänner` (→Kaufleute) ·
`Bergmann→Bergmänner` (→Bergleute) · `Regenbogen→Regenbogen` (→Regenbögen) ·
`Preisnachlass→Preisnachlasse` (→Preisnachlässe) · `Herpes→Herpetes`

**B4. Two mechanical generator bugs** (batch 36, ~25 entries):
- *Truncated umlaut plurals* — umlaut applied, suffix dropped. Every form is a non-word:
  `Arbeitsvertäg`, `Handyverträg`, `Bildungsabschlüss`, `Palmenhäus`, `Gutenachtküss`
- *Doubled stems*: `Migrationsdramadramen`, `Wissenschaftszentrumzentren`,
  `Kundenkontokonten`, `Sportpensumpensen`

**B5. `plural: null`** — 12 entries; the app renders the literal string "None":
`Schulkleidung`, `Dings`, `Tango-Musik`, `Beste`, `Arztkleidung`, `Englisch-Studium`,
`Sprachenlernen`, `Kitesurfen`, `Hasilein`, `Ticketwahl`, `Hardrock`, `Pop`

**B6. Adjectival nouns cite the weak plural** — all 288 `adjectivalNoun` entries, appearing
in **every single noun batch**. `Erwachsenen` is given where the citation form is
`Erwachsene` ("viele Erwachsene"). Also affects `Jugendliche`, `Deutsche`, `Betroffene`,
`Beschäftigte`, `Angehörige`, `Beamte`, `Angestellte`, `Abgeordnete`.

### C. Wrong or unusable translations — 3,224 findings, 240 high

**C1. Root cause: glosses are alphabetically sorted.** 79% of multi-sense glosses
(12,118 / 15,306) are in exact alphabetical order. Senses were never ranked by usefulness.
This one mechanism produces three separate harms.

**C2. The primary sense is lost entirely** — the most damaging finding in the audit.
These are A1/A2 words whose everyday meaning is simply absent:

| Word | CEFR | Gloss in the bank | Missing |
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
| `der Becher` | A1 | **Crater**/beaker/cup | (constellation leads) |
| `der Giebel` | — | **Prussian carp**/gable | (fish leads) |
| `die Leiste` | — | band/bar/**fess** | skirting board, groin |
| `der Lachs` | B2 | **longissimus dorsi muscle**/salmon | (butchery term leads) |
| `der Totengräber` | — | **burying beetle**/gravedigger | (insect leads) |

`der Kellner` is the clearest case: all three glosses are archaic wine-cellar occupations,
because each sorts before "waiter". A beginner cannot learn the word for *waiter*.

**C3. Morpheme-mangled compounds** — each part translated separately with the wrong sense
chosen. These are flatly wrong, not merely mis-ordered:

| Word | Gloss | Actually means |
|---|---|---|
| `der Vertragsarzt` | "agreement doc" | doctor on the statutory health-insurance panel |
| `der Kultusminister` | "cult minister" | state minister for education and cultural affairs |
| `die Risikobewertung` | "chance assessment" | risk assessment |
| `die Einsendung` | "one desinence" | submission / entry |
| `der Kritikpunkt` | "criticism dot" | point of criticism |
| `der Leitsatz` | "composition" | guiding principle |
| `die Vorarbeit` | "business" | preliminary work |
| `die Dachorganisation` | "roof organisation" | umbrella organisation |
| `die Lehranstalt` | "apprenticeship asylum" | educational institution |
| `altersbedingt` | "conditioned by **dude**" | age-related |
| `genussvoll` | "full of **gender**" | with relish / pleasurable |
| `risikoreich` | "rich in chance" | risky / high-risk |
| `zuckerreich` | "rich in blood sugar level" | high in sugar |
| `teamfähig` | "capable of team" | able to work in a team |
| `rechtsfähig` | "capable of jurisprudence" | having legal capacity |
| `wissensbasiert` | "based knowledge" | knowledge-based |
| `heillos` | "without/free of hail" | utter / hopeless / disastrous |
| `streifenfrei` | "free of patrol" | streak-free |
| `praxisorientiert` | "oriented doctor's office" | practice-oriented |

`Alter`→"dude" and `Genus`→"gender" show the mechanism precisely: a slang or grammatical
sense of the German morpheme was selected, then glued in.

**C4. False friends glossed as their English lookalike:**
`Publizist` = "publicist" (means commentator on public affairs) ·
`Protestant` = "demonstrator/protester" (that is `Demonstrant`) ·
`Ausspruch` = "pronunciation" (that is `Aussprache`) ·
`Engländer` = "British/Briton" (means **Englishman**) ·
`Kran` = "faucet" (that is `Hahn`) · `Angina` = "angina" (means tonsillitis) ·
`familiär` = "familiar" · `spürbar` = "sensible" · `plastisch` = "plastic" ·
`einschlägig` = "respective" · `link` = "left" (uninflected `link` means "dodgy/shady")

**C5. Non-words and corrupted English:**
"buttershag" (`Butterbrot`) · "momification" (`Konservierung`) · "sweapstakes" (`Lotto`) ·
"one desinence" (`Einsendung`) · "chantage" (`Erpressung`) · "billett" (`Konzertkarte`) ·
"oversise" (`Übergröße` — the -ize→-ise conversion corrupting "oversize") ·
"opinionaire" (`Fragebogen`) · "attack piece" (`Locke`) · "arbitrário" (`eigenmächtig`
— Portuguese) · "filmproduction" · "shicker/shickered" (`schicker`, Australian slang for
drunk; the word is the comparative of *schick*)

**C6. Reverse-translation through an ambiguous English pivot:**
`Marmelade` = "jam/marmalade/**snarl-up**" (traffic jam) · `Lift` = "elevator/lift/**sniff**"

**C7. Offensive or inappropriate register:**
`der Nationalsozialismus` = "**NatSoc**/national socialism/nazism" — NatSoc is neo-Nazi
internet shorthand and the sort placed it first · `behindert` = "handicapped" (use
"disabled") · `die Ziege` = "**bag**/goat" (slang insult first) · `lesbisch` = "**dykey**/
lesbian" · `die Scham` = "**genitals**/shame" · `das Mausi` = "mouse" (it is an endearment)

### D. Verb auxiliary — 290 findings, 126 high

**A code bug, not only a data bug.** `index.html:305`:

```js
(withSein ? "ist " : "hat ") + perfekt
```

`withSein` is `true` for 340 verbs, `false` for 922, and **`null` for 4,321**. The ternary
collapses `null` into `"hat"`, so every verb with unknown auxiliary is asserted to take
*haben*. Confirmed wrong for at least these:

`auftauchen` · `stürzen` · `anreisen` · `schlüpfen` · `flüchten` · `schrumpfen` ·
`platzen` · `gelangen` · `strömen` · `radeln` · `erwachen` · `schlendern` · `abrutschen` ·
`marschieren` · `hüpfen` · `erfolgen` · `glücken` · `ausreisen` · `verhungern` ·
`abreisen` · `eilen` — all take **sein**.

Explicitly wrong values: `begeben` marked *sein* (reflexives always take *haben*) ·
`erlöschen`, `entspringen`, `schwinden`, `erliegen`, `einschreiten`, `entweichen`,
`aufbleiben`, `wegbleiben` marked *haben* (need *sein*) · `befallen`, `durchdringen`,
`vorliegen` marked *sein* (need *haben*).

`einreisen` is missing from the verb bank entirely.

### E. Verb forms — 70 findings, 35 high

**E1. A 121-entry contamination block** at ranks 5310–5569: past participles listed as
lemmas, typed `regular` with null forms, duplicating infinitives already present —
`gekommen`, `gegangen`, `gewonnen`, `aufgenommen`, `wahrgenommen`, `eingegangen`,
`umgegangen`, `zerrissen`, `schwergefallen`, `dahergekommen`.

**E2. Strong verbs mistyped `regular` with no forms** — the app will generate weak forms.
Three are tagged A1: `rausgehen` (ging raus / rausgegangen, sein) · `zurückfahren` (fuhr
zurück / zurückgefahren, sein) · `mitsprechen` (sprach mit / mitgesprochen) ·
`aufspringen` (C1) · `schwellen` · `beschreiten` · `aufliegen` · `verschleißen`

**E3. One entry hides two verbs** — separable/inseparable or strong/weak pairs collapsed:
`schaffen` (the form fields give strong *schuf/geschaffen*, but the A1/A2 meaning learners
need is weak *schaffte/geschafft* — the deck marks the right answer wrong) · `hängen` ·
`wenden` · `senden` · `schleifen` · `erschrecken` · `durchbrechen` · `überziehen` ·
`umreißen` · `unterschlagen` · `durchscheinen`

**E4. Corrupted records:** `besehen` has Präteritum `"besah sich"` and Perfekt `"sich"` ·
`eingefrieren` is not a German verb · `enhalten` is a typo for `enthalten` ·
`backen` gives archaic `buk` rather than `backte`

**E5. Missing core senses:** `bestehen` glossed "exist/consist of/insist on" — missing
**pass (an exam)**, the sense every learner needs.

### F. Junk headwords — 522 findings, 119 high

- **Nominalised infinitives**: `das Fallen`, `das Reisen`, `das Lernen`, `das Waschen`,
  `das Baden`, `das Tanzen`, `das Warten`, `das Handeln` (~60 entries)
- **Plurals entered as lemmas**: `die Blicke`, `die Drucke`, `die Kästen`, `die Pedale`,
  `die Taxis`, `die Feuerwehrleute`, `die Bergleute`, and `der Gräber` — whose own gloss
  reads *"graves (plural of Grab)"*
- **Back-formations**: `die Fossilie` (real lemma `das Fossil` is also present),
  `die Windpocke`, `die Metropolis`
- **Bare stems**: `der Süd`, `der Nord` (→`der Süden`, `der Norden`); `der Linker`
  (the *ein*-form; lemma is `der Linke`)
- **Place and company names**: `das Aalen`, `das Posen`, `das Microsoft`, `die Bellevue`
- **Non-German lexemes**: `das Food`, `der Road`, `das Basics`
- **Archaic duplicates**: `der Kursus` (=`der Kurs`), `der Dinosaurus` (=`der Dinosaurier`)
- **Corpus artefacts** — lemmas whose frequency came from another word's inflected form:
  `der Weise` "sage" at **rank 165** (from `die Weise`, "manner"), `die Zwecke` (from
  `der Zweck`), `der Fächer` (from `das Fach`), `die Feste`, `die Rande`
- **Hyphen-stripped duplicates**: `das AspergerSyndrom`, `die Work-LifeBalance`,
  `das Preis-LeistungsVerhältnis`
- **Misspelt headwords**: `der Arbeitsvertag`, `enhalten`

### G. Non-adjectives in `adjectives.json` — 67 high-severity findings

The bank's tail (ranks ~9550–9759) is a raw A1 course-glossary dump: **121 of the final 209
entries are not adjectives**, all tagged `cefrLevel: A1`.

Pronouns (`du`, `er`, `sie`, `wir`, `mich`, `dir`, `wen`) · definite articles (`der`, `die`,
`das`, `den`, `dem`) · prepositions (`an`, `auf`, `aus`, `bei`, `für`, `mit`, `nach`,
`über`, `um`, `von`, `vor`, `zu`, `durch`, `ohne`) · conjunctions (`und`, `aber`, `oder`,
`denn`, `ob`, `als`) · greetings (`hallo`, `ciao`, `tschüs`, `hi`, `moin`, `grüezi`,
`prost`, `danke`) · numerals (`null`, `einhundert`, `eintausend`) · the grammar term
`neutrum` · **11 country names** (`Japan`, `Frankreich`, `Italien`, `Polen`, `Russland`,
`Spanien`, `Portugal`, `Thailand`, `Algerien`, `Brasilien`, `Südamerika`)

**26 glosses in that block are corrupted:** `am` = "to work" · `für` = "oft often" ·
`zum` = "cheers" · `gute` = "good night" · `dem` = "(The ships sail on the river.)" ·
`das` = "(the sausage)" · `besonders` = "besonders?) special (...)" — the German lemma
leaking into its own gloss · `Brasilien` = "Brasil"

Elsewhere in the bank: **bare stems that never occur uninflected** (`letzt`, `besonder`,
`nächst`, `mittel`, `vorder`, `zweit`, `dritt`, `viert`, `neunt`, `zehnt`, `siebt`),
**comparatives as lemmas** (`weiter` for *weit*, `besser` for *gut*, `später` for *spät*),
**bound suffixes** (`jährig`, `haltig`), **prepositions** (`bezüglich`, `vorbehaltlich`),
and **participles** (`gewesen`, `benötigt`, `verwendet`, `beschrieben`).

### H. CEFR levels — 68 findings

`cefrLevel` records **which course glossary a word first appeared in**, not its difficulty.
Presented as CEFR, it is misleading:

- **48 C1-tagged nouns sit inside the true top 800** by frequency: `Nutzer` (rank 108),
  `Nutzung` (127), `Anwendung` (148), `Umsetzung` (177), `Standort` (180), `Version` (372),
  `Element` (491), `Standard` (555)
- **266 A1-tagged nouns rank worse than 4000**: `Apfelschorle` (18,776),
  `Butterbrot` (18,946), `Herrenmode` (23,080), `Präteritum` (23,774)
- Only 1,547 of 6,103 CEFR-tagged nouns carry a `source` field, so ~75% have no provenance
- Individual absurdities: `der Weise` "sage" = A1 · `das Junge` "cub" = A1 · `im` = C1

### I. British English violations

The app is British English. Three distinct faults:

1. **104 glosses contain both spellings** — forbidden by the project convention:
   `Etage` = "floor/storey/story" · `Axt` = "ax/axe" · `Altern` = "ageing/aging" ·
   `Scheck` = "check/cheque" · `Mathe` = "math/maths" · `Zucchini` = "courgette/zucchini"
2. **45 glosses use American-only spellings**: `labor` ×8, `favorite` ×5, `defense` ×4,
   `judgment` ×3, `sulfur` ×3, plus `fiber`, `harbor`, `maneuver`, `paralyze`, `fertilizer`,
   `anemia`, `pediatric`. `program`/`programme` is split 24 / 26.
3. **American terms ordered first** — an artefact of alphabetisation, ~27 confirmed:
   `Wohnung` = "apartment/flat" · `Handy` = "cell phone/mobile phone" ·
   `Gehweg` = "sidewalk/pavement" · `Windel` = "diaper/nappy" ·
   `Fahrstuhl` = "elevator/lift" · `Parkplatz` = "parking lot/car park"

Plus **over-correction** in the other direction: `Blutdruckmessgerät` = "blood pressure
**metre**", `Gaszähler` = "gas **metre**" — a measuring instrument is a *meter* in British
English too. Same failure mode as "oversise".

---

## 5. Root causes

Five pipeline defects explain almost all 5,122 findings:

1. **Glosses were alphabetically sorted, never ranked by usefulness.** Causes lost primary
   senses (C2), obscure-sense-first, and the American-first ordering — one fix, three wins.
2. **A bilingual dictionary was ingested wholesale**, including archaic, dialectal,
   technical and slang senses, with no filter for register or currency.
3. **Compounds were translated morpheme-by-morpheme** with independent (and often wrong)
   sense selection per part.
4. **Plurals and genders were rule-generated without an exception list** — hence invented
   plurals on mass nouns, truncated umlauts, doubled stems, and the loanword gender errors.
5. **Course glossaries were merged in unfiltered**, importing function words into the
   adjective bank, participles into the verb bank, and conflating course level with CEFR.

---

## 6. Remediation plan

Ordered by learner impact per unit of effort.

**Mechanical — do first, low risk**

1. **Delete the 121-entry non-adjective block** at the tail of `adjectives.json`. Purely
   subtractive, biggest single quality win.
2. **Fix `index.html:305`** — distinguish `null` from `false` so unknown auxiliaries are not
   asserted as "hat"; backfill `withSein` for the ~21 confirmed sein-verbs.
3. **Delete the 121 past-participle lemmas** (verbs ranks 5310–5569) and the 15 non-verbs.
4. **Set `plural: "—"`** on the ~200 mass nouns; fix the 12 `plural: null` entries.
5. **Repair the generator bugs** — truncated umlaut plurals, doubled stems.
6. **Fix the 93 high-severity articles** from the list in §4A.
7. **Change adjectival-noun plurals** to the bare citation form (288 entries, one rule).
8. **Remove junk headwords** — nominalised infinitives, plurals-as-lemmas, place/company
   names, back-formations (§4F).

**Editorial — where the real value is**

9. **Re-rank gloss senses by frequency** rather than alphabet, with a British-English
   tiebreak. Fixes C2, C3-ordering and most of §4I in a single pass.
10. **Restore the lost primary senses** (§4C2) — begin with every A1/A2 noun.
11. **Hand-fix the morpheme-mangled compounds and false friends** (§4C3, C4) — no rule
    finds these.
12. **Purge the offensive/inappropriate glosses** (§4C7), starting with `NatSoc`.
13. **Split the dual-conjugation verbs** (`schaffen`, `hängen`, `wenden`, `senden`,
    `erschrecken`) and add `bestehen` = "pass (an exam)".
14. **Reconsider `Teil`, `Gehalt`, `Schild`, `Band`, `Bank`** — take the learner-relevant
    gender or carry both.
15. **Rename `cefrLevel`** to `courseLevel`, or re-derive difficulty from frequency.

**Lower priority**

16. Restore the 21 high-frequency nouns demoted by the `rank`/`leipzigRank` divergence
    (`Bildung` is truly rank 111 but sorts at 1988).
17. Unicode and mojibake cleanup (`one?s heart`, `one´s line`, U+2010 hyphens).

---

## 7. Artefacts

| File | Contents |
|---|---|
| `audit/findings/*.md` | 60 per-batch reports, 25,878 lines — the primary record |
| `audit/findings-consolidated.json` | All 5,122 findings, structured |
| `audit/findings-consolidated.tsv` | Same, spreadsheet-ready |
| `audit/DEFECT-CLASSES.md` | The nine confirmed classes with verified examples |
| `audit/REVIEW-BRIEF.md` | The standard every reviewer applied |
| `audit/findings/_PROGRESS.md` | Run log and corrections to the earlier report |
| `audit/word-bank-review-2026-07-30.md` | Earlier scripted pass — **superseded; contains three false zeros corrected in §3** |

---

## 8. Bottom line

**Is the German correct?** Largely yes. Genders are right in the overwhelming majority,
the 1,202 irregular verb paradigms are excellent, and the frequency data is real.

**Are the translations correct?** Frequently not. 3,224 gloss findings, including compounds
that are outright nonsense and A1 words whose primary meaning is absent.

**Are the articles correct?** 93 are not — concentrated in loanwords and plurale-tantum
nouns, which is exactly where rule-based generation fails.

**Are the verb forms correct?** The irregulars are. The regular tail contains a 121-entry
contamination block, and 4,321 verbs have an auxiliary the app silently guesses wrong.

**Is it good for German learners?** Good bones, not yet shippable at beginner level. The
defects cluster hardest at A1/A2 — `Birne` without "pear", `Kellner` without "waiter",
`der Taxi`, `rausgehen` with no past tense. Items 1–8 above are mechanical and would remove
most of the harm; items 9–11 are what turn it into a genuinely good learning resource.
