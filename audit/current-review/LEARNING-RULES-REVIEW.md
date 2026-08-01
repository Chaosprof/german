# Learner-facing grammar support audit

Date: 2026-08-01  
Scope: `data/article-rules.json`, `data/verb-form-rules.json`, `data/preposition-rules.json`, `data/noun-help.json`, its generator/override path, and the relevant rendering paths in `index.html`. No source data was edited.

## Bottom line

The support layer is not yet safe to present as authoritative learner guidance. The shared rule files contain several overgeneralizations, but the larger risk is the generated per-noun help: it sometimes gives a rule that directly predicts a different article from the stored answer, invents compound boundaries, calls non-diminutives diminutives, and attaches plural explanations for the wrong gender. The UI then gives shared rules priority over curated per-word notes and keys explanations by spelling alone, so homographs can receive the explanation for another sense.

This is supplemental to the row-by-row lexical audit. Counts below locate systemic defects; the examples were manually evaluated to establish what the counts mean.

## Priority summary

| Priority | Finding | Measured scope |
|---|---|---:|
| P0 | Explanations are keyed only by spelling, so homographs share/overwrite support | 4 collisions across 25,947 noun rows |
| P0 | Noun rule metadata contradicts the stored article/exception status | 38 rows |
| P0 | Generated compound analyses contradict the noun's article | 24 rows; 14,266 rows receive a compound analysis overall |
| P0 | Generated suffix/diminutive claims directly contradict or misanalyse words | 20 `-ung`, 11 `-ling`, 16 non-neuter `-chen`; at least 70 demonstrably false diminutive analyses |
| P0 | `als` hint conflicts with playable data | 8 of 10 `als` combinations are `Nom`, while the hint teaches an `Akk` object analysis |
| P1 | Gender-specific plural explanation is for another gender | 47 clear rows |
| P1 | Explicit article-rule exception values disagree with the noun bank | 23 exception records |
| P1 | Shared verb rules contain misleading formation procedures/absolute claims | 6 concrete claims detailed below |
| P2 | Curated per-word article notes are hidden whenever `ruleId` exists | Systemic rendering behavior; `Butter` is a concrete example |

## P0 findings

### 1. Spelling-only keys corrupt homographs and gender-specific help

`scripts/split_noun_help.py:23-30` builds `help_map` and assigns `help_map[n["word"]] = ...`; the later row silently overwrites the earlier row. Its own output contract says the file is “Keyed by word” (`scripts/split_noun_help.py:43-50`). `index.html:223-230` repeats the same loss for rule metadata by constructing both `NOUN_INDEX` and `EXPLANATIONS` as maps keyed by `word`; `index.html:271-280` then merges the spelling-only help.

Measured result:

- 25,947 noun rows, 25,943 unique spellings, and 25,943 `noun-help.json` keys.
- All four duplicate spellings have different articles and meanings: `Junge`, `Unbekannte`, `Böse`, `Süße`.
- `der Junge` therefore receives the note for `das Junge` (“young animal/offspring”).
- `der Unbekannte` receives the note for `das Unbekannte` (“the unknown,” singular-only).
- `der Böse` receives the note for `das Böse` (“evil,” singular-only).
- `das Süße` inherits the second row's `die.suffix_e` metadata and the note saying the `-e` ending predicts `die`.

The collision also leaks into rule decks: `index.html:450-455` looks up every row's rule through `EXPLANATIONS.get(noun[0])`, so both senses receive whichever metadata won the spelling collision. A stable entry/sense ID—not surface spelling—is required for noun help, rule tags, exceptions, and lookup.

### 2. Rule metadata can tell the learner the opposite of the accepted answer

Across `data/nouns.json`, 38 tagged rows are internally inconsistent with `data/article-rules.json`:

- 20 rows are marked as normal followers even though their stored article differs from the rule article. Examples: `das Feature` tagged `die.suffix_e`; `das Poster`, `das Thermometer`, `das Münster`, `das Polster`, and `das Zepter` tagged `der.suffix_er`; `das Mosaik` tagged `die.suffix_ik`; `die Flitterwochen` and `die Anziehsachen` tagged `das.diminutives`; `die Betonmauer` tagged `der.suffix_er`.
- 18 rows are marked `isException: true` even though their article is the same as the rule's predicted article. Examples: `das Radio`, `das Logo`, `das Kilo`, `das Tattoo`, `das Ghetto`, `das Graffito`, `das Pesto` under `das.suffix_o`; `die Challenge` under `die.suffix_e`; `das Versäumnis` under `das.suffix_nis`; `die Kontur` under `die.suffix_ur`.

The result renderer makes the second class especially absurd: `index.html:4143-4149` can literally produce “it takes **das** instead of **das**.” The deck/help renderer similarly labels the row an exception at `index.html:2652-2660`.

### 3. Compound detection treats any matching tail as a head noun

The generator first accepts any static suffix match without checking the noun's gender (`scripts/generate_nouns.py:196-203`). Its dynamic fallback treats any dictionary word found at the end as a compound head (`scripts/generate_nouns.py:204-217`). The generated prose then states this as the “#1 rule” (`scripts/generate_nouns.py:244-248`). The genuine German compound-head rule is good pedagogy; the segmentation procedure is not.

Concrete results:

- 14,266 noun-help entries contain a generated compound analysis.
- 24 analyses name a final element whose displayed article differs from the stored noun's article. Examples:
  - `der Kamerad` → alleged head `Rad (das)`.
  - `der Schwierigkeitsgrad` and `der Wirkungsgrad` → alleged head `Rad (das)`, splitting *Grad* incorrectly.
  - `der Einwand` → alleged head `Wand (die)`.
  - `die Unerfahrenheit` → alleged head `Fahrenheit (das)`; the same note then says `-heit` predicts `die`.
  - `das Kunststoffteil`, `das Plastikteil`, `das Fertigteil`, etc. → alleged head `Teil (der)`, even though the stored concrete sense is `das Teil`.
  - `die Feuerwehrleute`, `die Eheleute`, etc. → alleged head `Leute (das)`.
- 61 entries are said to end in the head `Mus (der)`, including `Populismus`, `Optimismus`, `Hummus`, and `Primus`. These are not compounds with *Mus*; moreover standard German is **das Mus**, not *der Mus*.
- `Apparat`, `Magistrat`, `Literat`, and `Verrat` are falsely analysed as compounds headed by `Rat`; `Uniform` is falsely analysed as headed by `Form`.

These are not harmless mnemonic extras: the rendered note explicitly teaches a false morphological decomposition and, in 24 cases, visibly undermines the accepted article.

### 4. Orthographic endings are confused with derivational suffixes

The generator labels its branch “Suffix rules (100% reliable)” and tests raw `endswith` strings (`scripts/generate_nouns.py:250-272`). This creates direct falsehoods:

- 20 masculine rows—including `der Sprung`, `der Ursprung`, `der Schwung`, `der Vorsprung`, and `der Dung`—receive “Suffix rule: `-ung` → always **die**. Zero exceptions.” These words do not contain the feminine derivational suffix `-ung`.
- 11 neuter English `-ing` loans—including `das Recycling`, `das Controlling`, `das Feeling`, `das Bowling`, and `das Styling`—receive “Suffix rule: `-ling` → always **der**.” They do not contain the German suffix `-ling`.
- `das Holzscheit` receives the `-heit` rule because its last letters happen to be `heit`.
- `der Schaft` receives “`-schaft` → always **die**,” although the word is not formed with that suffix.

The shared article rule descriptions are safer in some places, but `data/article-rules.json` key `die.suffix_ung` still says “All nouns ending in `-ung`,” rather than “nouns formed with the suffix `-ung`.” The distinction matters precisely because the bank contains the counterexamples above.

### 5. `-chen` detection teaches false diminutives

`scripts/generate_nouns.py:269-270` equates every spelling ending in `chen` with the diminutive suffix. Of 217 notes carrying that exact claim:

- 16 directly contradict the article: `der Kuchen`, `der Knochen`, `der Drachen`, `der Rachen`, `der Rochen`, `der Rechen`, `der Notgroschen`, plus compounds such as `der Pfannkuchen` and `der Kieferknochen`, are told “`-chen` ... always **das**.”
- At least 70 are demonstrably not diminutive formations, using conservative, manually inspectable groups only: the 16 non-neuters; 24 words also present as infinitives (`Kochen`, `Lachen`, `Sprechen`, `Waschen`, `Rauchen`, etc.); 31 members of the `Zeichen` family; and the `Kuchen`/`Knochen` families (deduplicated union = 70).
- Neuter agreement can conceal the bad analysis: `das Zeichen`, `das Verbrechen`, and `das Kochen` happen to be neuter for reasons unrelated to diminutive `-chen`.

The shared JSON rule `das.diminutives` is correctly limited to diminutives “formed with `-chen` or `-lein`” (`data/article-rules.json:2834`). The generated per-noun classifier fails to preserve that condition.

### 6. The `als` hint contradicts most playable `als` combinations

`data/preposition-rules.json` key `als` (`line 34`) describes `als` only through an accusative-object analysis: after verbs such as *halten / ansehen / bezeichnen + Akk + als*, the following noun agrees with the object in accusative. This is incomplete and includes an odd example selection (*jemanden für ... halten* is the normal construction with *halten*).

The actual playable data has 10 `als` combinations:

- 8 are stored as `Nom`: `gelten als`, `dienen als`, `sich erweisen als`, `fungieren als`, `wirken als`, `sich entpuppen als`, `sich herausstellen als`, `sich verdingen als`.
- 2 are stored as `Akk`: `anrechnen als`, `wahrnehmen als`.

When reviewing an error, the UI prints the generic hint at `index.html:4113-4125` and the actual combo case immediately below at `index.html:4127-4129`. It can therefore tell a learner both that `als` is an accusative/object construction and that `gelten als` takes nominative. The hint needs at least separate subject-predicative and object-related analyses, and should explain that `als` is not an ordinary case-governing preposition.

## P1 findings

### 7. Forty-seven plural notes are explicitly gender-mismatched

The final `noun-help.json` has 47 clear cases where a gender-specific template names a different gender from the noun row. Representative examples:

- 18 neuters (`das Bauteil`, `das Fax`, `das Biotop`, `das Kondom`, `das Apfelmus`, etc.) receive “the default **masculine** plural.”
- `die Unerfahrenheit` and `der Erbbauzins` receive “Less common for **neuter** nouns.”
- `das Tausend` and `das Mosaik` receive “The most common **feminine** plural.”
- `der Forschungsstandort` receives the “Some **neuter** nouns take `-e`” template.
- 24 feminine rows with invariant stored forms—including `die Spezies`, `die Salami`, `die SMS`, `die Nanopartikel`, and `die AGB`—receive the template “**Masculine and neuter** nouns ending in `-er`, `-el`, `-en` usually keep the same plural form.”

The source template branches are at `scripts/generate_nouns.py:430-432`, `455-462`, and `471-486`. Some mismatches likely reflect stale help generated before a gender correction; others, especially the invariant-form branch, result from a template that does not branch on gender at all. Either way, the learner sees the wrong generalization.

There are also six direct stored-form/help contradictions where a real plural is present but the note says the noun “has no plural form”: `Barrierefreiheit → Barrierefreiheiten`, `Lebensfreude → Lebensfreuden`, `Schulbildung → Schulbildungen`, `Atlas → Atlanten`, `Filmindustrie → Filmindustrien`, `Auffassungsgabe → Auffassungsgaben`. The generator conflates an explicit `singularOnly` flag with a missing source plural and turns either into an absolute linguistic claim (`scripts/generate_nouns.py:413-422`). “No plural supplied / normally singular in this sense” would be safer unless lexically verified.

### 8. Explicit exception lists contain wrong or cross-layer-conflicting articles

There are 637 exception records in `data/article-rules.json`. Twenty-three records disagree with every noun-bank row of the same spelling/article. Clear errors include:

- `der.suffix_er`: `die Furnier` (should be `das Furnier`), `das Gebrüder` and `das Stadtväter` (both plural and therefore `die`). See `data/article-rules.json:154-167` and `438-439`.
- `die.suffix_ik`: `der Mikroplastik` while the bank has `das Mikroplastik`.
- `die.suffix_ur`: `der Kontur` while the bank has `die Kontur`.
- `die.suffix_e`: `der Challenge`, `der Großtrappe`, and `der Tape` conflict with `die Challenge`, `die Großtrappe`, and `das Tape`; the `das Spätzle` record needs singular/plural sense handling rather than a spelling-only exception.
- `das.suffix_nis`: `die Versäumnis` conflicts with correct `das Versäumnis`.
- `das.suffix_o`: 11 conflicts, including `der Radio`, `der Logo`, `der Tattoo`, `der Ghetto`, `der Graffito`, and `der Pesto`; standard learner articles are neuter.
- `das.prefix_ge`: `der Geisel` conflicts with correct `die Geisel`. `die Genua` is correct for the sail sense, which instead exposes the bank's `das Genua` row as wrong.

The grammar browser renders the raw exception records (`index.html:4643-4653`), so this is directly learner-visible. Card exception filtering (`index.html:624-629`) hides values that disagree with the bank, but that merely makes the two UI surfaces inconsistent.

### 9. Two-way-preposition wording teaches “movement = accusative”

`data/preposition-rules.json:9,25-33` repeatedly reduces Wechselpräpositionen to “Akk for direction, Dat for static location”; `index.html:4713-4716` strengthens this to “Akk for direction/movement.” Movement is not the deciding test. A change of location/destination (*wohin?*) generally selects accusative, while location (*wo?*) selects dative—even with movement: *Ich laufe im Park*.

For fixed verb-preposition combinations, saying “the verb sets the case” is a usable shorthand, but the lexical **combination** sets it; the same verb can participate in different constructions. This should be phrased as a locative-vs-lexically-fixed distinction, not movement-vs-stillness.

### 10. Verb-form rules need correction before being treated as formation recipes

Concrete defects in `data/verb-form-rules.json`:

1. **Weak verbs:** lines 11-12 say “drop `-en`” and form `ge-…-t`. This fails infinitives in `-n` such as *wandern/handeln* and weak verbs in `-ieren` (*studieren → studiert*, never *gestudiert*). No `-ieren` rule is supplied elsewhere.
2. **Strong verbs:** lines 22-23 likewise present `ge-…-en` as the form, without qualifying inseparable prefixes. The later prefix rule helps, but the top-level recipe is still overbroad.
3. **Mixed verbs:** line 35 calls its list “closed,” although *senden* and *wenden* have regular and irregular alternatives with meaning/register differences (*sendete/sandte*, *wendete/wandte*). “Memorize these principal parts” is safer than presenting one closed behavior.
4. **Modals + wissen:** line 47 says the whole group “drop[s] the umlaut.” *sollen* and *wollen* have no infinitive umlaut to drop, and *wissen* changes by a different historical/present paradigm. The useful shared fact is preterite-present singular endings, not universal umlaut removal.
5. **Imperative:** line 114 says to take the present *du* form and “drop `-st`.” That mechanical procedure fails where the written ending is only `-t`: *du tanzt → tanz!*, *du heißt → heiß!*. It should derive the imperative from the stem and then teach the vowel-change/`-e` conditions.
6. **Konjunktiv II:** line 125 lists “indirect speech” without saying that Konjunktiv I is the normal first choice and Konjunktiv II is used when K I is ambiguous, unavailable, or a distancing/unreality reading is intended. The same paragraph says “Three verbs” but then names *sein*, *haben*, and the entire modal class; common synthetic forms such as *fände, ginge, käme, gäbe,* and *nähme* are not simply “bookish.”

The Perfekt auxiliary rule (`lines 55-58`) is good as a first approximation but “Reflexive and transitive verbs **always** take *haben*” is too absolute; lexicalized constructions and *werden* compounds provide counterexamples (e.g. *Ich bin ihn losgeworden*). Mark it explicitly as a learner heuristic.

### 11. Several article semantic claims are overbroad or factually stale

- `der.precipitations` (`data/article-rules.json:707`) calls fog (*Nebel*) and dew (*Tau*) precipitation. Their articles are masculine, but the semantic category is meteorologically wrong and encourages a false mnemonic.
- `die.plants_trees` (`line 2223`) says most plants and trees are feminine while listing only two exceptions. Tree species in `-e` are often feminine, but plants broadly span all three genders (*der Ahorn, der Kaktus, das Moos, das Veilchen*). The rule should be narrowed to the useful subpattern.
- `das.chemical_elements` (`line 2858`) says there are “~112” elements. There are 118 named elements; the gender heuristic and listed masculine exceptions can remain after correcting the count.
- `die.country_with_article` (`line 2932`) is titled as though it covers fixed-article countries generally, but only teaches feminine singular names. Plural country names (*die Niederlande, die USA*) and masculine names/variants are missing; either narrow the title or cover the full system.

## P2 rendering and pedagogy findings

### 12. A shared rule suppresses the curated per-word article note

Both help surfaces use an exclusive `rule ? ... : expl.article` branch (`index.html:2652-2668` and `4141-4155`). If a noun has `ruleId`, its `articleHelp` is not shown at all—even for an exception where the curated note is more valuable than the predictor.

Concrete example: `data/noun-help-overrides.json` key `Butter` assigns `standard_die_butter` (“Standard German uses **die Butter**. **Der Butter** is regional...”) and also assigns `ruleId: der.suffix_er`, `isException: true` (`lines 137-143`). The UI hides that curated regional/standard guidance and shows only the enormous shared `-er` description plus a generic exception label. Render the per-word note in addition to the shared rule, especially for exceptions.

### 13. Grammar-rule confidence and provenance are not communicated

The article browser introduces every entry uniformly as a “rule” and labels empty exception arrays “no exceptions” (`index.html:4617-4639`). That makes a categorical suffix rule, an approximate orthographic heuristic, and a broad semantic tendency look equally reliable. Examples include 100% morphology (`-keit`), approximate spelling (`-e`, `-o`), and weak semantic groupings (plants, mountains, rivers).

The generated help compounds the problem with unsupported precision:

- 1,626 noun-help entries contain the `~90%` `-e` claim, while the bank itself contains 4,059 feminine rows among 4,906 literal `-e` endings (82.7%). Corpus composition means the bank is not a universal estimate, but it does show that `90%` is too precise to present without source/scope.
- 665 entries contain the claim that monosyllables are `~60% der / 25% das / 15% die`. Under the generator's own vowel-group syllable approximation, the bank's 1,877 one-syllable rows are 51.0% `der`, 27.2% `das`, 21.8% `die`. Again, present this as a weak heuristic with provenance, not a statistic.

Suggested UI labels: **categorical morphological rule**, **strong tendency**, **weak guess**, **semantic convention**, with an explicit confidence/source field in the JSON.

### 14. Verb-form rules are detached from verb-form review

The grammar browser renders the 12 verb rules correctly as expandable cards (`index.html:4670-4698`), but error review explicitly excludes verb-form explanations (`index.html:4134` requires `!isVerbForms`). Learners who miss *studieren → studierte → hat studiert* or a separable verb see the correct forms but no relevant formation rule. This is not a correctness bug, but it substantially limits the educational value of the support layer. A per-verb pattern tag could link a missed row to the applicable weak/strong/mixed, prefix, and auxiliary notes.

## Recommended remediation order

1. Replace spelling-only noun-help/rule keys with a stable sense ID containing at least word + article + sense/plural; migrate all four homographs and use the ID in maps, decks, and mistake review.
2. Block publication/rendering of any row where `(isException == false && noun.article != rule.article)` or `(isException == true && noun.article == rule.article)`. Resolve the current 38 rows manually.
3. Stop generating morphological claims from raw `endswith` alone. Require a verified derivational tag for `-ung`, `-ling`, `-chen`, compounds, nominalizations, and person suffixes.
4. Regenerate noun help only after article/plural corrections, then validate templates against final `article` and `plural`. Add invariants for the 47 gender-template mismatches and six plural contradictions.
5. Split `als` into subject-predicative and object-related constructions; revise the hint and audit whether “case” is pedagogically the right field for each stored combo.
6. Correct the 23 exception-list conflicts and make the grammar browser display only validated, sense-aware exceptions.
7. Rewrite the verb formation recipes, especially `-ieren`, `-n` infinitives, imperative derivation, Konjunktiv I vs II, and confidence around auxiliary selection.
8. Render curated per-word help alongside shared rules and add confidence/provenance labels to the grammar browser.

## Suggested regression checks (after manual corrections)

Automated checks are appropriate here as guards, not as substitutes for linguistic review:

- noun-help key count equals noun sense-ID count; no overwrite on duplicate spelling;
- rule/article/exception invariant described above;
- a generated article note must never contain “always der/die/das” different from the row article;
- a plural template naming masculine/feminine/neuter must agree with the final article, unless it explicitly labels the noun an exception;
- “no plural” help requires final `plural == "—"` and a manually verified singular-only flag;
- compound head article must equal the compound article, and the split must be manually/lexically verified rather than a bare suffix match;
- fixed-accusative/fixed-dative preposition rules must agree with all playable combinations;
- every `als` hint subtype must agree with the associated stored construction;
- every explicit exception article must exist as that article/sense in the noun bank.
