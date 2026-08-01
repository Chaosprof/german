# Adjective and dual-gender remediation manifest report

## Outcome

The machine-readable manifest contains **793 retained findings exactly once**:

| Bank | Consolidated findings | Rejected by validation | Retained manifest fixes |
|---|---:|---:|---:|
| adjectives | 766 | 3 | **763** |
| dual_gender | 31 | 1 | **30** |
| **Total** | **797** | **4** | **793** |

The four excluded rejects are adjective `kratzfest`, adjective `internal`, adjective `unternehmungslustig`, and dual-gender `Mast`. They do not appear in the manifest.

Every retained record includes the bank/batch/source-row identity, zero-based production index, exact current production object, original finding, validation provenance and verdict, effective severity, action, path-addressed set/remove/split operations, learner-safety metadata, and an exactness result.

This remediation-manifest work did not write production data. The manifest is tied to the SHA-256 production snapshots recorded in its `meta.productionSnapshot` object.

## Validation reconciliation

| Validation source | Retained |
|---|---:|
| `adjective_dual_high.md` | 242 |
| `medium_low_sample.md` | 68 |
| Not independently sampled (`ORIGINAL_RETAIN`) | 483 |
| **Total** | **793** |

| Verdict | Count |
|---|---:|
| CONFIRM | 139 |
| REVISE | 10 |
| DOWNGRADE | 161 |
| ORIGINAL_RETAIN | 483 |
| **Total** | **793** |

Effective severities after validation are **93 high, 358 medium, and 342 low**.

## Remediation policy encoded

- **Productive participles are retained:** 142 entries use `retain_and_tag_participle`, including the contextual compounds `backsteingefasst` and `blumengeschmückt`. Every one has exact `entryType`, `participleType`, `baseVerb`, and learner-safety metadata. They remain reference/derived vocabulary but are excluded from core adjective-lemma drills.
- **True non-adjective contamination is deactivated:** 54 entries use `deactivate_non_adjective`, setting `active=false`, recording the actual entry type, and excluding the row from adjective drills.
- **Degree forms are retained as derived forms:** 5 comparative/superlative entries are linked to a `baseAdjective` and removed from core lemma drills rather than described as invalid German.
- **Inflected headwords are normalised:** 7 entries receive exact citation stems.
- **Duplicates and nonstandard variants are deactivated reversibly:** 8 entries retain a `canonicalForm` pointer.
- **Ordinal metadata is repaired:** `tausendst` and `zweihundertst` keep their correct uninflected stems, remove `notDeclinable`, and are tagged as ordinal adjectives.
- **Restricted adjective use remains teachable:** `dingfest` is retained with its fixed expression rather than deleted as a non-adjective.
- **Dual-gender changes are exact and sense-addressed:** all 30 have exact operations; `Ex` has an explicit additional gender-sense split, while invalid `der Alter` is deactivated within its gender record instead of deleting valid `das Alter`.

## Action totals

| Action | Count |
|---|---:|
| update | 521 |
| retain_and_tag_participle | 142 |
| deactivate_non_adjective | 54 |
| manual_review | 52 |
| deactivate_duplicate_or_variant | 8 |
| normalize_headword | 7 |
| retain_and_tag_degree_form | 5 |
| repair_declension_metadata | 2 |
| clean_learner_gloss | 1 |
| retain_and_tag_restricted_adjective | 1 |
| **Total** | **793** |

The operations contain 486 exact English-gloss sets, 142 exact base-verb links, 142 participle-type tags, 62 top-level reversible `active=false` settings, 15 exact CEFR assignments, 7 exact headword normalisations, 2 field removals, and 1 split/add-sense operation.

## Exactness and manual queue

**738 findings are safe to apply exactly as represented.** The remaining **55** are all CEFR-only uncertainty: reviewers recommended a range or qualitative reassessment rather than a single defensible level. No lexical, participle, dual-gender, spelling, or gloss operation remains structurally unresolved. Of these 55, 52 deliberately have no production operation (`manual_review`); 3 contain an exact gloss correction but leave the CEFR component manual.

The manifest intentionally does not guess among CEFR candidates. Exact manual flags follow:

- `adjectives:211:verfügbar` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:701:empfindlich` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:915:zart` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:922:winzig` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:1107:unsichtbar` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:1292:schlau` — CEFR remedy is not a single exact level; candidates: A2, B1.
- `adjectives:1306:ungewohnt` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:1400:bescheiden` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:1714:talentiert` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:1716:übel` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:1907:brandneu` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:1989:würzig` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:2056:unschuldig` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:2205:verwirrt` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:2294:tagelang` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:2316:glutenfrei` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:2324:mittelmäßig` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:2349:anständig` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:2380:überlegen` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:2423:lesenswert` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:2475:lauwarm` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:2576:zeitaufwendig` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:2652:gestört` — CEFR remedy is not a single exact level; candidates: B1, B2.
- `adjectives:2717:nagelneu` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:2725:regnerisch` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:2761:hellblau` — CEFR remedy is not a single exact level; candidates: A1, A2. No safe exact field operation could be derived.
- `adjectives:2779:riesengroß` — CEFR remedy is not a single exact level; candidates: A1, A2. No safe exact field operation could be derived.
- `adjectives:2967:zuckerfrei` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:2999:gleichgültig` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:3040:unrealistisch` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:3295:eklig` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:3317:grammatisch` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:3254:undicht` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:3824:unattraktiv` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:4015:unbenutzt` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:4019:ungebildet` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:4337:gefleckt` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:4339:gelangweilt` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:4498:ungeschickt` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:4585:bitterkalt` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:4739:recycelbar` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:4791:tollpatschig` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:5232:abwaschbar` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:5671:wohnhaft` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:6103:prim` — CEFR remedy is not a single exact level; candidates: .
- `adjectives:6286:vergesslich` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:6932:pflichtbewusst` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:7261:wolkenlos` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:7554:desinteressiert` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:7937:inkompetent` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:8007:kitzlig` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:8994:linkshändig` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:9179:barfuß` — CEFR remedy is not a single exact level; candidates: A2, B1. No safe exact field operation could be derived.
- `adjectives:9188:überfordert` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.
- `adjectives:9198:überzeugt` — CEFR remedy is not a single exact level; candidates: B1, B2. No safe exact field operation could be derived.

## Integrity checks

- JSON parsed successfully after generation.
- Manifest count: **793**; unique manifest identity keys: **793**; duplicate IDs: **0**.
- Every `current` object was compared with its production object at the recorded zero-based index: **0 mismatches**.
- Every retained participle has a base verb: **142/142**.
- Rejected-entry presence checks: **0/4 present**.
- Truncation/corruption marker scan: **0 markers**.
- Final retained adjective item: `adjectives:9262:bestens`.
- Final retained dual-gender item: `dual_gender:98:Kurkuma`.

## Applicator requirements

An eventual applicator must understand dotted/array paths such as `genders[1].english`, preserve object identity IDs, support `operations.remove`, and treat `operations.split` as an additive sense operation rather than an in-place overwrite. It should verify the two stored SHA-256 hashes before applying. New metadata fields (`entryType`, `participleType`, `baseVerb`, `canonicalForm`, `active`, and `learnerSafety`) must either be accepted by the production schema or mapped into an equivalent sidecar/index before deployment.
