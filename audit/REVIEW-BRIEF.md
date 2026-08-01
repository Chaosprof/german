# Reviewer brief — German word-bank audit

You are auditing a German→English vocabulary bank used by a **British-English-speaking
learner app**. You will be given ONE batch file of ~700 entries as TSV.

## Your job

Evaluate **every single row, one at a time.** Do not sample. Do not skim. Do not write a
script to do it for you — the whole point is your linguistic judgement applied per word.
Work down the file in order.

For each row ask, in this order:

### Nouns (`rank / article / word / plural / english / cefr / flags`)
1. **Article** — is `der/die/das` correct for this word in the sense the gloss gives?
   Flag it if wrong. Also flag if the word is dual-gender and the chosen gender is the
   *less useful* one for a learner (e.g. `das Teil` chosen when `der Teil` is far commoner).
2. **Plural** — is it the correct standard plural?
   - `—` means "no plural". Flag if a real plural exists, or if `—` is missing on a genuine
     mass/abstract noun (an **invented plural** like `Beginn→Beginne` is an error).
   - Flag if the plural given belongs to a *different sense* than the gloss
     (e.g. `Bank` glossed "bank" but plural `Bänke`, which is the bench plural).
   - For adjectival nouns (`adjNoun` flag) the bare citation plural is expected
     (`Erwachsene`, not `Erwachsenen`).
3. **English gloss** — is it correct, and is the **first** sense the one a learner needs?
   Glosses are `/`-separated. Flag:
   - outright wrong translations;
   - non-words or non-English words (e.g. "buttershag", "chantage", "billett");
   - an obscure/technical/archaic sense placed first (e.g. `Lachs` = "longissimus dorsi
     muscle/salmon");
   - **American spelling** — this app uses British English. Flag `color`, `labor`,
     `defense`, `program` (for programme), `judgment`, `-ize`/`-yze`, etc.
   - **both** a British and an American spelling in the same gloss (e.g. "ax/axe") — the
     rule is one form only, British.
   - an American term placed before its British equivalent ("apartment/flat",
     "cell phone/mobile phone", "sidewalk/pavement").
4. **Is this even a usable dictionary entry?** Flag corpus junk: nominalised infinitives
   (`das Fallen`), plural-of-something-else lemmas (`die Zwecke` from `der Zweck`),
   archaic variants duplicating a live word (`der Kursus` vs `der Kurs`), proper nouns.
5. **CEFR** — flag only *gross* mismatches (a top-200 everyday word tagged C1; a very rare
   or technical word tagged A1).

### Verbs (`rank / word / type / praeteritum / perfekt / auxiliary / english / cefr`)
1. **Präteritum and Perfekt** — correct? For separable verbs the Präteritum is written
   `"gab an"` style. Participles of inseparable-prefix verbs have no `ge-`.
2. **Auxiliary** — `sein` vs `haben`. `UNSET` is rendered as **"hat"** by the app, so
   flag `UNSET` whenever the verb actually takes **sein** (motion / change of state).
   Reflexive verbs always take *haben*.
3. **`regular` vs `irregular`** — is the classification right?
4. **Verbs with two conjugations / two meanings** — flag when one entry hides two verbs
   (`schaffen` strong "create" vs weak "manage"; `hängen`, `senden`, `wenden`, `wiegen`,
   `bewegen`, `schleifen`). Note which sense is missing.
5. **Gloss** — same standards as nouns. Also flag a missing core learner sense
   (`bestehen` without "pass (an exam)").
6. Flag reflexive-only verbs whose gloss doesn't say so, and separable verbs whose
   separability is wrong.

### Adjectives (`rank / word / english / cefr / flags`)
1. **Is it actually an adjective?** Flag pronouns, articles, prepositions, conjunctions,
   interjections/greetings, adverbs-only forms, numerals, proper nouns, country names,
   grammar metalanguage. This bank is known to be contaminated — be strict.
2. **Bare stems that never occur uninflected** (`letzt`, `besonder`, `nächst`, `mittel`)
   and **comparatives listed as lemmas** (`weiter` for *weit*, `besser` for *gut*).
3. **Gloss** — same standards as nouns, plus flag glosses that are corrupted, that leak
   the German lemma, or that contain only an example sentence and no translation.
4. Flag false-friend traps with no warning (`eventuell` ≠ "eventually").

## Output format — IMPORTANT

Write your findings to `audit/findings/<BATCHNAME>.md` using the Write tool, where
`<BATCHNAME>` is the batch filename without extension (e.g. `nouns_007`).

Use exactly this structure — one bullet per problem entry:

```
# <BATCHNAME>  (reviewed N entries, ranks X–Y)

## Errors
- **Wort** | `field` | severity=high|medium|low | category=article|plural|gloss|junk|cefr|verbform|aux|notadj
  current: <what the data says>
  correct: <what it should say>
  why: <one line>

## Clean
<count> entries had no issues worth reporting.
```

Rules for the write-up:
- Report **only real problems.** No praise, no restating correct entries.
- Severity `high` = teaches the learner something factually wrong (bad article, invented
  plural, wrong translation, wrong verb form, non-adjective in the adjective deck).
  `medium` = misleading or wrong-register. `low` = style, spelling variant, ordering.
- Be specific and terse. One bullet per entry, not per sub-issue.
- If you are unsure whether something is wrong, say `severity=low` and add
  `uncertain: yes` — do not inflate.
- **Do not** flag every American spelling individually if a batch has many; group them
  into a single bullet listing the words.
- At the end, state the count of entries you reviewed so completeness can be verified.

Then reply to me with just: batch name, entries reviewed, count of high/medium/low
findings, and the 5 most serious items. Keep the reply under 200 words — the file is the
deliverable.
