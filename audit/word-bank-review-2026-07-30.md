# Word bank deep review — 30 July 2026

Scope: `data/nouns.json` (25,986), `data/verbs.json` (5,583), `data/adjectives.json` (9,759).
**41,328 entries total.**

Method: manual entry-by-entry reading of the high-frequency core (nouns rank 1–750, verbs
rank 1–200, all 1,202 irregular verb form sets, adjectives rank 1–260), plus stratified
manual samples from the 4k / 8k / 19k / 25k frequency bands, plus targeted consistency
checks used to generalise from what the reading turned up.

---

## Verdict

The German side is genuinely good — better than most free decks. **Articles are the strongest
part of the dataset and I found no errors in them at all.** Irregular verb forms are ~99%
correct. The problems are concentrated in three places:

1. the **English glosses**, which are machine-sorted alphabetically and were never
   curated for which sense a learner needs first;
2. the **plural field**, which invents plurals for mass nouns;
3. the **tail of `adjectives.json`**, which is a raw course-glossary dump and is partly garbage.

Nothing here is fatal. The dataset is a solid base with a handful of systematic,
scriptable defects layered on top.

---

## What is correct

Worth stating plainly, because it is the bulk of the data:

| Check | Result |
|---|---|
| Noun articles, manual read of rank 1–750 | **0 errors** |
| Noun articles vs. compound-head gender (all 25,986) | **0 mismatches** |
| Weak nouns (`weak: true`, 619 entries) all masculine | **0 errors** |
| Irregular verb Präteritum/Perfekt vs. base verb (1,202 sets) | 1 real corruption |
| Missing/empty English glosses | **0** |
| Missing plural field | **0** |
| Whitespace / malformed separators in glosses | **0** |
| Duplicate words within a bank | 4, all legitimate dual-gender pairs |
| Closed-class pollution in nouns.json / verbs.json | **0** |

German compounds inherit the head noun's gender, and across ~26k nouns not one compound
disagrees with its head. That is a very strong signal — it means the gender data is not
just accurate but internally coherent. The suffix-rule check I ran flagged 315 "violations"
and **every single one was a false positive of my own rule set** (`Raum`/`Baum` are not
*-um* nouns, `Frist` is not an *-ist* noun, `Kuchen` is not a *-chen* noun, English *-ing*
loanwords are neuter). I could not find a wrong article by any method.

---

## Issue 1 — Glosses are alphabetically sorted, so the wrong sense comes first

**Severity: high. This is the root cause of most translation complaints.**

79% of multi-sense glosses (12,118 of 15,306) are in exact alphabetical order. The gloss
list was machine-sorted, not ordered by usefulness. Consequences:

**Absurd senses land first:**

| Word | Current gloss | Should lead with |
|---|---|---|
| `der Lachs` | `longissimus dorsi muscle/salmon` | salmon |
| `der Totengräber` | `burying beetle/gravedigger` | gravedigger |
| `die Gondel` | `car/gondola` | gondola |
| `der Elan` | `go/vigor/vim` | verve/drive/enthusiasm |
| `die Achsel` | `armpit/axilla/oxter` | armpit |
| `die Müdigkeit` | `fatigue/languidness/tiredness` | tiredness/fatigue |
| `der Zufall` | `chance/coincidence/fortuity` | coincidence/chance |
| `die Ewigkeit` | `aeon/eternity` | eternity |

**American terms land first whenever they alphabetically precede the British one.** This
directly fights the British-spelling convention, and it is a pure artefact of the sort —
27 instances found, including:

`Wohnung` = apartment/flat · `Handy` = cell phone/mobile phone · `Parkplatz` = parking
lot/car park · `Gehweg` = sidewalk/pavement · `Fahrstuhl` = elevator/lift · `Windel` =
diaper/nappy · `Wasserhahn` = faucet/water tap · `Müll` = garbage/rubbish/trash ·
`Sommerurlaub` = summer vacation/summer holiday · `Kinofilm` = movie/feature film ·
`Etagenwohnung` = apartment/flat · `Ladendetektiv` = store detective/shop detective

**Fix:** re-rank each gloss's senses by frequency rather than alphabet, and add a
British-preference tiebreak. This one change fixes the largest visible quality problem.

---

## Issue 2 — Reverse-translation through an ambiguous English pivot

**Severity: high (few entries, but these are outright wrong).**

Some glosses were produced by translating German → English → and back-filling synonyms of
the *English* word, which imports senses German never had:

| Word | Gloss | Problem |
|---|---|---|
| `die Marmelade` | `jam/marmalade/snarl-up` | "snarl-up" = traffic jam. Marmelade is never that. |
| `der Lift` | `elevator/lift/sniff` | "sniff" is drug slang for *a lift*. Nonsense. |
| `das Butterbrot` | `bread and butter/buttershag/sandwich` | "buttershag" is not an English word. |
| `die Konzertkarte` | `concert billett` | "billett" is not English. |
| `die Erpressung` | `blackmail/blackmailing/chantage` | "chantage" is French. |
| `der Individualist` | `cunning` | Completely wrong; should be "individualist". |
| `die Herrenmode` | `Lord fashion` | Should be "men's fashion". |
| `die Damenmode` | `lady fashion` | Should be "women's fashion". |
| `schicker` (adj) | `shicker/shickered` | Australian slang for *drunk*. `schicker` is the comparative of `schick` (chic). |
| `unentschieden` | `draw/pendant/undecided` | "pendant" is a back-translation artefact. |
| `tauglich` | `fit/military/qualified` | "military" is not a sense of *tauglich*. |
| `die Übergröße` | `oversise/plus size` | "oversise" — the *-ize→-ise* conversion corrupted "oversize". |
| `die Filmproduktion` | `filmproduction` | Not a word; needs a space. |
| `rezidivierend` | `recidivous/recurrent/recurring` | "recidivous" is not standard English. |
| `spartanisch` | `Spartan/Spartanic` | "Spartanic" is not a word. |
| `alevitisch` | `alevitic` | Should be "Alevi". |

**Fix:** these need hand correction — there is no rule that finds them. The list above plus
the alphabetical re-ranking covers most of what a learner would actually hit.

---

## Issue 3 — Invented plurals for mass / abstract nouns

**Severity: high. This actively teaches wrong German.**

Of 175 known singular-only nouns I checked, **115 carry a fabricated or misleading plural.**
The `—` convention exists and is used correctly elsewhere (`Gesundheit`, `Verantwortung`,
`Zusammenarbeit`, `Ruhe`, `Vertrauen`, `Jugend`, `Handel` all have `—`), so this is
inconsistency rather than a missing feature.

Clear errors — these plurals do not exist in standard German:

`der Beginn` → **Beginne** · `der Alltag` → **Alltage** · `der Unterricht` → **Unterrichte** ·
`die Software` → **Softwares** · `die Polizei` → **Polizeien** · `die Musik` → **Musiken** ·
`die Dauer` → **Dauern** · `der Verkehr` → **Verkehre** · `die Chemie` → **Chemien** ·
`die Geografie` → **Geografien** · `die Psychologie` → **Psychologien** ·
`die Soziologie` → **Soziologien** · `die Theologie` → **Theologien** ·
`die Poesie` → **Poesien** · `die Hitze` → **Hitzen** · `der Beton` → **Betons** ·
`die Sauberkeit` → **Sauberkeiten** · `die Unendlichkeit` → **Unendlichkeiten**

Sense-mismatch errors — the plural exists but means something else than the gloss:

| Entry | Plural given | Actually means | Gloss says |
|---|---|---|---|
| `die Zukunft` | Zukünfte | futures (futurology jargon) | future |
| `die Liebe` | Lieben | loved ones | love |
| `die Lust` | Lüste | lusts (pejorative) | desire/pleasure |
| `die Natur` | Naturen | temperaments | nature |
| `die Luft` | Lüfte | airs (poetic) | air |
| `der Spaß` | Späße | jokes, pranks | fun |
| `die Gewalt` | Gewalten | branches of government | violence/power |
| `der Rat` | Räte | councils | advice/council |
| `die Erde` | Erden | soil types | earth/ground |
| `der Tod` | Tode | deaths (literary) | death |
| `die Politik` | Politiken | policies (jargon) | politics/policy |

**Fix:** scriptable. Set `plural: "—"` for the mass-noun set; for the sense-mismatch rows
either drop the plural or split the entry.

---

## Issue 4 — `adjectives.json` tail is a raw glossary dump

**Severity: high. Worst single quality problem in the dataset.**

**141 of 9,759 entries (1.4%) are not adjectives** — and **121 of them sit in the final 209
entries**, so roughly 58% of that terminal block is unusable. All are tagged `cefrLevel: A1`,
so a learner filtering for A1 adjectives gets the worst of it.

What is in there: pronouns (`du`, `er`, `sie`, `wir`, `ihr`, `mich`, `dir`, `wen`, `wem`),
definite articles (`der`, `die`, `das`, `den`, `dem`), prepositions (`an`, `auf`, `aus`,
`bei`, `für`, `mit`, `nach`, `über`, `um`, `von`, `vor`, `zu`, `durch`, `ohne`, `unter`),
conjunctions (`und`, `aber`, `oder`, `denn`, `ob`, `als`, `sondern`), greetings (`hallo`,
`ciao`, `tschüs`, `hi`, `hey`, `moin`, `grüezi`, `prost`, `danke`, `bitte`), numbers (`null`,
`einhundert`, `eintausend`), the grammar term `neutrum`, and **11 country names**
(`Japan`, `Frankreich`, `Italien`, `Polen`, `Russland`, `Spanien`, `Portugal`, `Thailand`,
`Algerien`, `Brasilien`, `Südamerika`).

26 of these glosses are corrupted rather than merely misfiled:

| Entry | Gloss | Correct |
|---|---|---|
| `am` | `to work (What do you work as?)` | "at the / on the" |
| `für` | `oft often` | "for" |
| `zum` | `cheers` | "to the" |
| `gute` | `good night` | "good" |
| `dem` | `(The ships sail on the river.)` | no translation at all |
| `besonders` | `besonders?) special (What's special...)` | German lemma leaked into gloss |
| `das` | `(the sausage)` | example only, no gloss |
| `der` | `(the kindergarten)` | example only, no gloss |
| `die` | `(the bottle)` | example only, no gloss |
| `los` | `to be up (What's up?)` | fragment of *was ist los* |
| `Brasilien` | `Brasil` | "Brazil" |
| `im` | `in the` — tagged **C1** | A1 at most |

**Fix:** delete the 121-entry terminal block from `adjectives.json`. If those words are
wanted, they belong in a separate function-words deck with hand-written glosses.

Note the mid-tail of the adjective bank (I read rank 4000–4110 closely) is genuinely
**good** — real adjectives, accurate glosses. The rot is localised, not pervasive.

---

## Issue 5 — `withSein: null` is rendered as "hat"

**Severity: medium-high. A code bug, not a data bug — one-line area.**

`index.html:305`:

```js
IRREGULAR_VERBS = (verbData.verbs || []).filter(v => v.irregular).map(({...}) =>
  [word, english, rank, prateritum, (withSein ? "ist " : "hat ") + perfekt]);
```

`withSein` is `true` for 340 verbs, `false` for 922, and **`null` for 4,321**. The ternary
collapses `null` into `"hat"`, so every verb with unknown auxiliary is asserted to take
*haben*. Most are, but these are wrong:

`platzen` · `glücken` · `stürzen` · `ausreisen` · `schrumpfen` · `verhungern` · `abreisen` ·
`flüchten` · `eilen` — all take **sein**.

Also `einreisen` is missing from the verb bank entirely.

**Fix:** distinguish the three states — render `ist/hat` only when known, and backfill the
flag for the intransitive change-of-state and motion verbs.

---

## Issue 6 — Auxiliary and form errors in irregular verbs

**Severity: low. ~1% error rate — the verb table is the best-curated part of the dataset.**

Confirmed wrong auxiliary (all should be **sein**):
`vorliegen` (→ haben actually correct; listed sein — **reversed**), `aufbleiben`,
`wegbleiben`, `überbleiben`, `einschreiten`, `entspringen`, `entweichen`, `losfliegen`,
`hineinrennen`, and several `-schwimmen` compounds (`durchschwimmen`, `einschwimmen`,
`zurückschwimmen`, `vorbeischwimmen`, `aufschwimmen`) marked *haben*.

`begeben` is marked **sein**, but `sich begeben` is reflexive and reflexives always take
*haben*.

One corrupted record:

```json
"besehen": { "prateritum": "besah sich", "perfekt": "sich" }
```

Should be `besah` / `besehen`.

Others worth a look: `backen` gives the archaic `buk` rather than modern `backte`;
`eingefrieren` is not a German verb; `entflechten` is flagged irregular but carries the
weak Präteritum `entflechtete`.

**Traps where one entry hides two verbs:**

- **`schaffen`** — gloss is `create (irregular: schuf/geschaffen)/manage (regular: schaffte/geschafft)`
  but the form fields give only `schuf`/`geschaffen`. The A1/A2 meaning learners need
  ("manage, get done") is the *weak* one, so the deck teaches the wrong conjugation as the
  answer. Split into two entries.
- **`bestehen`** — glossed `exist/consist of/insist on`, missing the most common learner
  sense: **pass (an exam)**.
- `hängen`, `wenden`, `senden`, `bewegen`, `wiegen`, `durchlaufen` each have both a strong
  and a weak conjugation with different meanings; only one is given.
- `ziehen` is marked *haben*, but "move house" (`er ist nach Berlin gezogen`) takes *sein*.
- `treten`, `fahren` take both auxiliaries depending on transitivity; only one is listed.

---

## Issue 7 — `cefrLevel` means "appeared in a course glossary", not "is at this level"

**Severity: medium. Misleading rather than wrong, but it breaks level filtering.**

The field is derived from which textbook glossary a word appeared in, so it conflates
course membership with difficulty. Evidence:

- **48 C1-tagged nouns sit inside the true top 800** by frequency, including
  `Nutzer` (user, rank 108), `Nutzung` (127), `Anwendung` (148), `Umsetzung` (177),
  `Standort` (location, 180), `Kooperation` (214), `Behandlung` (218), `Version` (372),
  `Element` (491), `Standard` (555).
- **266 A1-tagged nouns have a true frequency rank worse than 4000**, including
  `Apfelschorle` (18,776), `Butterbrot` (18,946), `Damenmode` (17,572),
  `Herrenmode` (23,080), `Präteritum` (23,774), `Konzertkarte` (23,308).
- Only 1,547 of 6,103 CEFR-tagged nouns even have a `source` field, so ~75% of the tags
  have no recorded provenance.
- Absurd individual tags: `der Weise` = "sage" tagged **A1**; `das Junge` = "cub" tagged
  **A1**; `die Digitalisierung` tagged **A2**; `im` tagged **C1**.

**Fix:** rename the field to something honest (`courseLevel` / `firstSeenIn`) and, if a real
difficulty band is wanted, derive it from frequency. Don't present it as CEFR in the UI.

---

## Issue 8 — Dual-gender nouns flattened to one gender in the main bank

`data/dual-gender-nouns.json` is good work — 98 entries, correctly modelled, and
`index.html` does load it as its own deck. But `nouns.json` keeps only **one** gender for
each, and for several it kept the less useful one:

| Word | nouns.json teaches | Problem |
|---|---|---|
| `Teil` (**rank 26**) | `das Teil` / "part/piece/part (concrete: ein Ersatzteil)" | **der Teil** is the frequent, learner-essential one ("ein Teil des Problems"). Gloss is also garbled and self-duplicating. |
| `Gehalt` | `der Gehalt` / "content/substance" | **das Gehalt** = *salary* is the A2 word learners need. |
| `Band` | `das Band` / "ribbon/tape/band" | Gloss says "band", which reads as the music group — that is **die Band**. Actively misleading. |
| `Schild` | `der Schild` / "shield" | **das Schild** (sign) is far more common in daily life. |
| `Golf` | `der Golf` / "Golf/gulf" | **das Golf** (the sport) is the common sense; gloss is confusing. |

`Bank` is the sharpest case: glossed `bank/bench` with plural **Bänke** only. For the
money sense the plural is **Banken**. A learner asked for "the plural of *Bank*" gets
marked wrong for the correct answer.

---

## Issue 9 — Adjectival-noun plurals given in the weak form

288 entries carry `adjectivalNoun: true`, and their plural is consistently the
post-article form rather than the bare citation form:

`der Jugendliche` → **Jugendlichen** · `der Erwachsene` → **Erwachsenen** ·
`der Deutsche` → **Deutschen** · `der Betroffene` → **Betroffenen** ·
`der Beschäftigte` → **Beschäftigten** · `der Angehörige` → **Angehörigen**

`die Erwachsenen` is right after a definite article, but the bare plural is
**Erwachsene** ("viele Erwachsene"). A plural-drill will teach the wrong form. Also
`der Jugendliche` is missing the `adjectivalNoun` flag entirely.

---

## Issue 10 — Corpus lemmatisation artefacts

Junk lemmas whose frequency came from a *different* word's inflected form:

| Entry | Real source of the frequency | Note |
|---|---|---|
| `der Weise` "wise man/sage", **rank 165** | `die Weise` (manner, *auf diese Weise*) / adj. `weise` | Rank 165 for "sage" is absurd; tagged A1. The common `die Weise` is what's missing. |
| `die Zwecke` "tack/drawing pin" | plural of `der Zweck` (purpose) | Valid word, but toxic next to `Zweck` |
| `der Fächer` "fan" | plural of `das Fach` (subject) | |
| `der Kursus` "course" | archaic variant of `Kurs` | Duplicate of `der Kurs` |
| `das Fallen` "falling" | verb `fallen` / plural of `die Falle` | Nominalised infinitive |
| `das Reisen`, `das Handeln` | verbs | Same class |
| `das Go` "go-ahead", `das Bare` "cash", `der Klare` "clear schnapps` | | Obscure fillers |

In `adjectives.json`, comparative forms are listed as separate lemmas — `weiter` (rank 4,
= *weit*), `besser` (21, = *gut*), `später` (49, = *spät*), `länger`, `früher` — and
bare stems that never occur uninflected are presented as words: `letzt`, `besonder`,
`nächst`, `zweit`, `dritt`, `viert`, `mittel`, `vorder`.

---

## Issue 11 — Residual American spellings and mixed-spelling glosses

Given the British-spelling convention, three violations remain:

**104 glosses contain both spellings at once** — e.g. `Etage` = `floor/storey/story`,
`Axt` = `ax/axe`, `Altern` = `ageing/aging`, `Archäologie` = `archaeology/archeology`,
`Scheck` = `check/cheque`, `Mathe` = `math/maths`, `Leukämie` = `leukaemia/leukemia`,
`Östrogen` = `oestrogen/œstrogen`, `Tiefgang` = `(AE) draft/(BE) draught/profoundness`.

**45 glosses use American-only spellings:** `labor` ×8 (`Wehe`, `Arbeitseinsatz`,
`Landesarbeitsgericht`…), `favorite` ×5 (`Leibspeise`, `Lieblingslied`…), `defense` ×4,
`judgment` ×3, `sulfur` ×3, plus `fiber`, `harbor`, `vigor`, `maneuver`, `paralyze`,
`fertilizer`, `anemia`, `pediatric`, `armor`, `installment`, `traveled`, `standardize`,
`categorize`.

**`program` vs `programme` is split down the middle:** 24 nouns use "program",
26 use "programme" — including inconsistency *within* related entries
(`Investitionsprogramm` = "investment programme/investment program").

---

## Issue 12 — Minor data hygiene

- **`rank` ≠ `leipzigRank`** for 23,681 nouns, and `index.html:2701` sorts by `rank`.
  Mostly a harmless offset from inserting 1,556 manual entries, but **21 genuinely common
  nouns get demoted past rank 1200**: `Bildung` (true rank 111 → 1988), `Medium` (120 →
  1996), `Landkreis` (134), `Website` (164), `Software` (271), `Einblick` (345),
  `Kategorie` (348), `Analyse` (379), `Bundesregierung` (425), `Anfrage` (478),
  `Fachkraft` (476), `Union` (598), `Marketing` (599). A learner drilling "the first 500
  nouns" never sees *Bildung*.
- One mojibake: `Herzensangelegenheit` = "matter close to one**?**s heart".
- `steckenbleiben` uses an acute accent for an apostrophe: "forget one**´**s line".
- `Fernsehfilm` uses U+2010 hyphens instead of ASCII: "made‐for‐TV movie".
- 8 case-only duplicate glosses: `Gott` = "God/god", `Renaissance` = "Renaissance/renaissance",
  `Wikinger` = "Viking/viking", etc.
- `das Teil` gloss repeats itself: "part/piece/**part** (concrete: ein Ersatzteil)".
- 30 words appear in both `verbs.json` and `adjectives.json` (`vergessen`, `verlassen`,
  `erhalten`, `ergeben`…). Mostly legitimate participial adjectives, but `vergessen` and
  `erhalten` are not standard adjectives.
- `die Verfügung` glossed "disposal/decree" — misses the only construction learners meet,
  `zur Verfügung stehen/stellen` (= be/make available).
- `eventuell` glossed "possibly/perhaps" with no false-friend warning against
  English *eventually* — a classic learner trap.
- `die Praxis` = "doctor's office/practice" — AmE; BrE is "doctor's surgery".

---

## Recommended order of work

Ranked by learner impact per unit of effort:

1. **Delete the 121-entry garbage block at the tail of `adjectives.json`.** Biggest quality
   win, near-zero risk, purely subtractive.
2. **Fix `withSein: null` → "hat"** in `index.html:305`, and backfill the ~9 sein-verbs.
   One-line code fix plus a small data patch; currently teaching wrong grammar.
3. **Re-rank gloss senses by frequency instead of alphabetically,** with a British-spelling
   tiebreak. Fixes Issue 1 and most of Issue 11 in one pass.
4. **Set `plural: "—"` on the mass-noun set** (115 identified). Scriptable.
5. **Hand-fix the ~16 reverse-translation errors** in Issue 2.
6. **Split `schaffen`**, and add "pass (an exam)" to `bestehen`.
7. **Rename `cefrLevel`** to reflect what it actually is, or re-derive it from frequency.
8. **Reconsider `Teil`, `Gehalt`, `Band`, `Schild`, `Bank`** in the main bank — either
   switch to the learner-relevant gender or carry both.
9. Adjectival-noun plurals → bare form; add the missing `adjectivalNoun` flag to `Jugendliche`.
10. Remove the lemmatisation artefacts (`der Weise` at rank 165 is the worst offender).
11. Repair the `rank` field for the 21 displaced high-frequency nouns.
12. Mojibake and Unicode cleanup.

Items 1, 2, 4 and 12 are mechanical. Items 3 and 5 are where the real editorial value is.
