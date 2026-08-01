# Deep review of the German learner word bank

> **Remediation complete (2026-08-01).** This document records the pre-fix
> audit verdict. All 3,280 retained findings have since been corrected or made
> reference-only so they cannot appear as scored learner answers. See
> [REMEDIATION-REPORT.md](REMEDIATION-REPORT.md) for the applied changes,
> disposition counts, schema, and verification results.

Audit date: 2026-08-01  
Audited revision: `4fbfd4e` (`master`)  
Scope: the current post-fix noun, verb, adjective, and verb-preposition banks, plus the dual-gender noun spelling set and the learner-facing grammar/help layer.

## Executive verdict

The bank is valuable and mostly usable as raw lexical material, but it is **not yet safe to present as an authoritative German-learning reference without another correction pass**.

The primary banks contain 41,015 rows. Every row received a fresh item-by-item editorial review, divided into 61 batches of no more than 700 entries. A supplemental set of 98 spellings with multiple noun genders was also reviewed, for 41,113 reviewed records in total. Scripts were used only to extract batches, prove coverage, and consolidate results; they were not used as the linguistic judgment.

After independent adjudication of every proposed high-severity finding:

- 602 high-severity defects remain confirmed;
- 3,280 records have a retained high-, medium-, or low-severity finding, including the supplemental dual-gender review;
- 3,250 of the 41,015 primary rows have a retained finding (7.9%);
- 37,765 primary rows had no retained finding in this pass (92.1%).

“No finding” is not a guarantee of dictionary-level perfection. It means a reviewer examined the row and did not identify a material learner-facing defect. The density and clustering of confirmed defects—especially incorrect sense/form pairings, single paradigms applied to polysemous verbs, contaminated adjective rows, and false generated grammar hints—make the remaining problems significant despite the relatively high clean percentage.

## What was reviewed

| Bank | Rows reviewed | Rows with retained findings | Rate | Confirmed high severity |
|---|---:|---:|---:|---:|
| Nouns | 25,947 | 1,829 | 7.0% | 325 |
| Verbs | 5,442 | 633 | 11.6% | 175 |
| Adjectives | 9,262 | 763 | 8.2% | 84 |
| Verb–preposition combinations | 364 | 25 | 6.9% | 9 |
| **Primary total** | **41,015** | **3,250** | **7.9%** | **593** |
| Supplemental dual-gender spellings | 98 | 30 | 30.6% | 9 |
| **All reviewed records** | **41,113** | **3,280** | **8.0%** | **602** |

The first-pass reviewers raised 3,307 candidate findings. Independent validators then rechecked all 782 candidates initially labelled high: 602 stayed high, 163 were downgraded, 13 were rejected, and four noun findings were revised to medium. A further 183-item cross-bank sample of medium/low candidates retained 169 as real issues and rejected 14. The final retained counts above incorporate those exact adjudications; unsampled medium/low rows remain first-pass findings.

The resulting editorial worklist contains 602 high-, 1,491 medium-, and 1,187 low-severity records. Severity was changed only for rows actually re-adjudicated; it was not statistically projected onto the unsampled findings.

## Method and coverage

1. The current JSON banks were flattened into deterministic, source-ordered batches of at most 700 rows.
2. A separate reviewer evaluated every row in each batch for German form, article/gender, plural, English meaning and sense alignment, learner usefulness, register, CEFR plausibility, duplicates, and data contamination. Verb review also covered principal parts, separability, reflexivity, valency, and Perfekt auxiliary. Verb–preposition review covered the construction, governed case, gloss, and example.
3. Review reports explicitly recorded the number of entries reviewed, the last row reached, every affected row, and the clean-row count.
4. Consolidation verified all 62 expected reports, all 41,113 review records, and the accounting identity `affected + clean = reviewed`. There are no missing batches or reconciliation errors.
5. Separate reviewers independently adjudicated all 782 proposed high-severity findings. A deterministic 183-item cross-bank sample of medium/low findings was also assigned for second-pass precision checking.
6. The learner-facing article, plural, compound, preposition, and verb-form support layer was inspected separately because correct lexical rows can still produce incorrect teaching through generated rules.

One methodological trap was caught and corrected during review: the application prepends `die ` to stored plural forms. Nominalised adjectives therefore correctly store weak plural forms such as `Erwachsenen`, `Beamten`, and `Grünen`; they should not be changed to bare strong forms merely because those are common citation forms. Early reports were revised accordingly. Unset CEFR is optional in the schema and was likewise not counted as an error.

## Main findings

### 1. Nouns: broadly useful, but sense alignment is still the largest problem

Articles are substantially better than in the earlier audit, but 42 article findings and 160 plural findings remain in the first-pass corpus. More often, a valid German spelling has been paired with the wrong English sense, the wrong gender for that sense, or a plural belonging only to a secondary meaning.

Examples include:

- `der Weise` paired with “way/manner,” which requires `die Weise`;
- `Date` presented as generic “date,” encouraging the classic false-friend error instead of “romantic date”;
- `Police` presented as generic “policy” rather than an insurance policy/document;
- `Spaß` given `Späße` while the gloss teaches only mass-like “fun,” not the count sense “jokes/pranks”;
- `das Teil` and `der Teil` senses not reliably separated;
- rare or specialist translations placed before the ordinary learner sense, or ordinary senses omitted altogether.

Many plural strings are morphologically possible but pedagogically misaligned with the supplied gloss. A learner deck must treat article, sense, and plural as a single unit, not three independently harvested fields.

### 2. Verbs: the highest-risk primary bank

Verbs have the highest retained issue rate (11.7%) and the most consequential schema problem. A single auxiliary flag and a single set of principal parts cannot correctly represent verbs whose senses differ in separability, transitivity, reflexivity, or auxiliary.

Representative cases:

- `umziehen`: moving house is `ist umgezogen`; changing clothes is reflexive and uses `haben`;
- `abheben`: aircraft takeoff uses `sein`; withdrawing money uses `haben`;
- `übergehen`, `durchlaufen`, and `umlaufen`: separable and inseparable readings have different forms and meanings;
- `hängen`: `hing/gehangen` and `hängte/gehängt` belong to different constructions;
- `wohlfühlen`, `erholen`, `weigern`, `verlieben`, and similar learner senses require `sich` but are stored as bare headwords;
- compounds of `haben` were repeatedly treated as if they followed a generic weak-verb template.

This cannot be made robust by correcting individual booleans alone. Sense-specific verb records are needed when morphology or syntax changes with meaning.

### 3. Adjectives: a contaminated tail and an unresolved inclusion policy

The adjective bank contains genuine gloss errors and clear non-adjectives, especially near its tail: adverbs, prepositions, contractions, finite verb forms, numerals, country names, and leaked editorial instructions. Examples include `nahm`, `wie`, `sehr`, `noch`, `Brasilien`, `darauf`, `am`, `für`, and `zum`.

The independent validation also corrected an important overstatement from the first pass: productive participles such as `gebaut`, `erwartet`, or `unterschrieben` can be used adjectivally and are not automatically invalid German. Most such rows were downgraded from high-severity “not an adjective” findings to medium-severity deck-scope/lemma-policy issues. The bank should decide explicitly whether it teaches:

- lexical adjective lemmas only;
- common lexicalised participial adjectives; or
- all productive participles that can appear attributively.

Without that policy, the deck is inconsistent and needlessly repetitive even when a form is grammatically possible.

### 4. English glosses are the dominant editorial weakness

The first pass tagged 2,122 records for gloss/sense issues, far more than any other category. The recurring problems are:

- obscure senses ranked before the everyday meaning;
- near-synonyms treated as exact equivalents;
- missing register, region, domain, or offensiveness labels;
- several senses collapsed into one slash-separated field even though they require different German syntax or morphology;
- raw glossary fragments and editing notes leaking into learner-visible English.

A large bank is not automatically a better beginner/intermediate bank. The common, productive sense should come first, with specialist senses clearly labelled or moved to separate records.

### 5. CEFR values should be treated as rough metadata, not truth

The first pass found 421 populated CEFR labels that looked materially implausible. Unset CEFR was not treated as an error. The problem is not merely a handful of bad values: very rare, formal, technical, or morphologically complex items sometimes receive beginner levels, while common material is inconsistently placed.

Unless CEFR labels have a documented source and sense-level derivation, the UI should call them approximate difficulty bands rather than CEFR certification.

## Learner-support and grammar layer

The support layer contains several publication-blocking issues even where the underlying word-bank row is correct:

1. **Spelling-only keys collapse distinct entries.** The 25,947 noun rows become 25,943 map keys. `Junge`, `Unbekannte`, `Böse`, and `Süße` overwrite different senses/genders, so the wrong help can be shown.
2. **Rule metadata contradicts accepted articles.** Thirty-eight noun rule assignments are internally inconsistent: 20 normal followers have the opposite article, and 18 records marked as exceptions actually have the same article as the rule. The UI can effectively say a noun “takes das instead of das.”
3. **Compound analysis is based on suffix-shaped tails, not verified morphology.** Among 14,266 generated compound analyses, 24 directly contradict the row article. False heads include `Kamerad → Rad`, `Einwand → Wand`, and `Unerfahrenheit → Fahrenheit`; 61 `-ismus` words are analysed with `Mus` as their head.
4. **Raw endings are mistaken for derivational suffixes.** `Sprung` and `Dung` receive the “-ung is always die” rule; neuter English `-ing` loans receive the masculine `-ling` rule; `Holzscheit` is treated as a `-heit` derivation and `Schaft` as `-schaft`.
5. **`-chen` help is especially unreliable.** There are 217 generated `-chen` claims, including 16 direct non-neuter contradictions and at least 70 words that are not diminutives.
6. **Plural help contradicts the noun rows.** Forty-seven notes explicitly name the wrong gender, and six claim that a noun has no plural despite a stored plural.
7. **Exception lists disagree with the bank.** Twenty-three explicit article-rule exception values conflict with the noun data.
8. **The `als` case hint is wrong for most playable examples.** It teaches accusative object agreement, while eight of ten stored playable combinations are nominative subject-predicative constructions.
9. **Verb formation rules overgeneralise.** They mishandle `-ieren`, infinitives in `-n`, imperative derivation, Konjunktiv I versus II, modals/`wissen`, and absolute auxiliary claims.
10. **The UI hides better per-word help.** When a shared rule is present, curated `articleHelp` is suppressed; for `Butter`, the useful standard-versus-regional note is replaced by a generic suffix rule.

The full evidence, file references, and proposed regression checks are in `LEARNING-RULES-REVIEW.md`.

## First-pass finding distribution

These are candidate tags from the complete item-by-item pass, before the independent high-severity adjudication. A row may have one consolidated primary category.

| Category | Candidate rows |
|---|---:|
| English gloss/sense alignment | 2,122 |
| CEFR placement | 421 |
| Adjective/deck classification | 208 |
| Noun plural | 160 |
| Verb Perfekt auxiliary | 118 |
| Spelling/headword form | 115 |
| Junk or data contamination | 43 |
| Noun article | 42 |
| General classification | 27 |
| Verb principal form | 21 |
| Duplicate | 19 |
| Verb–preposition choice | 6 |
| Example sentence | 4 |
| Governed case | 1 |

## Independent severity validation

| Validation packet | Reviewed | Confirmed | Revised | Downgraded | Rejected | Final high retained |
|---|---:|---:|---:|---:|---:|---:|
| Nouns | 348 | 325 | 4 | 11 | 8 | 325 |
| Verbs + verb–preposition | 190 | 176 | 8 | 3 | 3 | 184 |
| Adjectives + dual-gender nouns | 244 | 84 | 9 | 149 | 2 | 93 |
| **Total** | **782** | **585** | **21** | **163** | **13** | **602** |

For nouns, all four “revise” verdicts were reassigned to medium rather than retained as high. For the other packets, “revise” means the high-severity defect stands but the first recommendation needed correction. The adjective downgrade count is large because valid productive participles were initially judged too harshly.

### Medium/low precision sample

The deterministic cross-bank sample contained 183 findings: 86 medium and 97 low, distributed across every bank. An independent reviewer found:

| Verdict | Count | Share |
|---|---:|---:|
| Confirm as reported | 134 | 73.2% |
| Revise diagnosis/remedy, issue remains | 3 | 1.6% |
| Downgrade severity, issue remains | 31 | 16.9% |
| Upgrade severity, issue remains | 1 | 0.5% |
| Reject | 14 | 7.7% |
| **Real issue retained** | **169** | **92.3%** |

The sample supports the substance of the lower-severity worklist, while showing that medium findings are often overstated: 31 of 86 sampled medium findings were downgraded and three rejected. Low findings were more stable: 85 of 97 were confirmed at low, one was upgraded to medium, and 11 were rejected. Because the sample was deterministic and stratified rather than a probability sample, these percentages should be read as a quality check, not a confidence-bounded estimate for every unsampled row.

## Recommended remediation order

### P0 — block learner misinformation

1. Correct the 602 independently retained high-severity records using the validation reports, not the unadjudicated first-pass wording.
2. Introduce stable sense IDs. Key noun help by sense ID rather than spelling, and split homographs/genders explicitly.
3. Split verbs into sense-specific paradigms wherever auxiliary, reflexivity, separability, transitivity, or principal parts differ.
4. Remove the clearly invalid adjective-tail records and adopt a written participle/adjective inclusion policy.
5. Stop publishing generated morphology/help unless its article, plural, case, and exception flags agree with the final lexical record.
6. Replace raw `endswith` inference for compounds and suffixes with verified morphological tags.
7. Fix `als`, two-way-preposition, imperative, `-ieren`, Konjunktiv, and auxiliary teaching text.

### P1 — improve learner quality

1. Re-edit glosses sense by sense: common meaning first, specialist/dated/regional/offensive senses labelled, and syntactically distinct senses split.
2. Recheck plural against the exact glossed sense, especially mass/count alternations and specialist plurals.
3. Treat dual-gender spellings as distinct sense records, not an invitation to teach every rare gender equally.
4. Rename or rederive CEFR metadata from a documented, sense-aware source.
5. Render curated per-word notes alongside—not instead of—shared heuristics.

### P2 — make future regressions harder

1. Add rule confidence and provenance: categorical morphology, strong tendency, weak guess, semantic convention.
2. Add invariants for sense-ID uniqueness, article/rule agreement, gender wording in plural notes, plural/no-plural agreement, verified compound heads, case agreement, and exception-list consistency.
3. Connect missed verb-form questions to the applicable sense-specific pattern and auxiliary note.
4. Run automated checks as regression guards after editorial correction, while retaining human review for lexical judgment.

## Deliverables

- `findings-consolidated.tsv`: one sortable row per first-pass finding.
- `findings-consolidated.json`: the same findings with structured evidence and recommendations.
- `findings/`: all 62 complete per-batch reports.
- `validation/noun_high.md`, `validation/verb_high.md`, and `validation/adjective_dual_high.md`: every proposed high finding independently adjudicated.
- `validation/medium_low_sample.md`: independent cross-bank sample of the lower-severity findings.
- `LEARNING-RULES-REVIEW.md`: detailed learner-facing grammar/help audit with exact source references.
- `validated-summary.json`: final counts after the independent high review and medium/low sample.
- `manifest.json`, `supplemental-manifest.json`, and `summary.json`: scope and first-pass reconciliation records.

No production word-bank entries were edited in this audit. The deliverables are an editorial worklist and a design diagnosis for the next correction phase.
