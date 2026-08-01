# adjectives_001  (reviewed 700 entries, ranks 1–700)

## Errors

- **letzt / besonder / nächst / mittel** | `word` | severity=high | category=junk
  current: ranks 15, 24, 29, 238 listed as uninflected lemmas ("last", "special/particular", "next", "medium/middle")
  correct: cite as `letzte`, `besondere`, `nächste`, `mittlere` (or drop)
  why: these stems never occur uninflected; the deck will teach "das letzt Jahr".

- **erst / zweit / dritt / viert** | `word` | severity=high | category=junk
  current: ranks 22, 133, 286, 626 = "first", "second", "third", "fourth"
  correct: `erste / zweite / dritte / vierte`, and ideally in a numerals deck, not adjectives
  why: bare ordinal stems, unusable as given; `erst` uninflected is in fact the adverb "only/not until".

- **link** | `english` | severity=high | category=gloss
  current: link = "left"
  correct: the left-hand adjective is `linke`/`links`; uninflected `link` = "dodgy, shady, underhand"
  why: teaches a form that never means "left" and hides the one meaning it does have.

- **einschlägig** | `english` | severity=high | category=gloss
  current: "respective"
  correct: "relevant, pertinent, applicable" (einschlägige Erfahrung/Vorschriften)
  why: outright wrong; "respective" is `jeweilig`, which is already rank 55.

- **familiär** | `english` | severity=high | category=gloss
  current: "familiar/family"
  correct: "family, family-related; informal/intimate" — not "familiar"
  why: false friend put first; English "familiar" is `vertraut` (rank 478).

- **weiter / besser / später** | `word` | severity=medium | category=junk
  current: ranks 4, 21, 49 listed as lemmas alongside `weit` (67), `gut` (2), `spät` (375)
  correct: keep only the base forms; if the comparative is wanted, mark it as such
  why: comparatives as headwords duplicate the base entry and hide the comparative relationship.

- **benötigt / verwendet / angegeben / beschrieben / stattfindend / liegend** | `word` | severity=medium | category=junk
  current: ranks 406, 416, 450, 629, 679, 446 as adjective entries ("needed", "used", "specified", "described", "taking place", "lying")
  correct: remove — these are plain verb participles, not lexicalised adjectives
  why: corpus artefacts; a learner gets no adjective, only an inflected verb form.

- **erhalten** | `word` | severity=medium | category=junk
  current: erhalten = "preserved"
  correct: only adjectival in the fixed frame "gut erhalten"; the lemma `erhalten` is the very common verb "receive/maintain"
  why: homograph collision teaches the wrong headword sense.

- **eventuell** | `english` | severity=medium | category=gloss
  current: "possibly/perhaps"
  correct: "possible (attributive), any; possibly — NOT 'eventually'"
  why: classic false friend with no warning, and the adjectival sense ("eventuelle Änderungen") is missing.

- **stationär** | `english` | severity=medium | category=gloss
  current: "stationary/inpatient"
  correct: "inpatient, in-hospital" first; "stationary" only in technical physics collocations
  why: the everyday German sense is medical; "stationary" first reads as a false friend.

- **maßgeblich** | `english` | severity=medium | category=gloss
  current: "authoritative"
  correct: "decisive, significant, key" (maßgeblich beteiligt); "authoritative" is secondary
  why: the commonest sense is missing entirely.

- **bestmöglich** | `english` | severity=medium | category=gloss
  current: "as best as possible"
  correct: "best possible"
  why: gloss is ungrammatical English and not an adjective.

- **liebevoll** | `english` | severity=medium | category=gloss
  current: "full of love"
  correct: "loving, affectionate; lovingly"
  why: paraphrase instead of the ordinary English adjective.

- **behindert** | `english` | severity=medium | category=gloss
  current: "handicapped"
  correct: "disabled"
  why: "handicapped" is dated and offensive in British usage.

- **konstruktiv** | `english` | severity=medium | category=gloss
  current: "constructive/design"
  correct: "constructive" (engineering sense: "structural/design-related")
  why: bare "design" is wrong — it comes from *Konstruktion*, not *konstruktiv*.

- **physikalisch** | `english` | severity=medium | category=gloss
  current: "physical"
  correct: "physics-related, physical (of physics)"
  why: undifferentiated from `physisch` (696) and `körperlich` (239); learner will use it for the body.

- **spürbar** | `english` | severity=medium | category=gloss
  current: "noticeable/sensible"
  correct: "noticeable, palpable, perceptible"
  why: "sensible" in modern English means "reasonable" — wrong translation.

- **süß** | `english` | severity=medium | category=gloss
  current: "cute/sweet"
  correct: "sweet/cute"
  why: the taste sense is the core learner sense and should come first.

- **überregional** | `english` | severity=medium | category=gloss
  current: "national/supraregional"
  correct: "supraregional, more than local, nationwide in scope"
  why: "national" first conflates it with `national` (130) and `bundesweit` (141).

- **recht** | `english` | severity=medium | category=gloss
  current: "right"
  correct: "quite, fairly (adv.); all right, agreeable (es ist mir recht)" — right-hand is `rechte/rechts`
  why: bare "right" is ambiguous and points at a sense the uninflected form does not carry.

- **mathematisch / ethisch** | `english` | severity=medium | category=gloss
  current: "mathematic/mathematical", "ethic/ethical"
  correct: "mathematical", "ethical"
  why: "mathematic" and "ethic" are not usable English adjectives; one form only.

- **bayerisch / sächsisch / hessisch / niedersächsisch** | `word` | severity=low | category=junk
  current: ranks 103, 174, 288, 411 in a general adjective deck
  correct: drop, or move to a place-names list
  why: German-state adjectives are regional-newspaper corpus artefacts with little learner value.

- **festgelegt / zugelassen / geprägt / bevorzugt / vermehrt** | `word` | severity=low | category=junk
  current: ranks 539, 697, 687, 641, 519
  correct: drop or gloss with the governing frame (geprägt *von*, vermehrt = "increasingly", adv.)
  why: marginal participles; usable only inside fixed constructions.

- **erstmalig / jahrelang / dortig / damalig / inhaltlich / vorrangig / gesundheitlich / studentisch** | `english` | severity=low | category=gloss
  current: "for the first time", "for years", "local/there", "at that time/former", "in terms of content", "priority", "health", "student (adj.)"
  correct: adjective glosses: "first-time/initial", "years-long", "of that place", "then, of that time", "content-related", "primary, top-priority", "health-related", "student, student-run"
  why: adverbial phrases, bare nouns and metalanguage instead of a translation.

- **aktuell / sensibel / konsequent / evangelisch** | `english` | severity=low | category=gloss
  current: "current", "sensitive", "consistent", "Protestant" — all correct, all unmarked
  correct: add the trap: ≠ "actual", ≠ "sensible", ≠ "consequent", ≠ "evangelical"
  why: high-frequency false friends with no warning.

- **nah / nahe** and **vereint / vereinigt** | `word` | severity=low | category=junk
  current: ranks 540/351 both "close/near"; ranks 564/593 both "united"
  correct: keep one of each pair, note the variant
  why: duplicate lemmas cost review time and teach nothing extra.

- **thematisch / kulturell / gegenseitig / deutschsprachig / individuell / selbstständig / zentral / verfügbar / klassisch / intern** | `cefr` | severity=low | category=cefr
  current: first seven tagged A1; `verfügbar`, `klassisch`, `intern` tagged C1
  correct: roughly B1–B2 for the first group; B1 for the last three
  why: abstract derived adjectives at A1 and everyday B1 words at C1 are both gross mis-levels.

- **analog** | `english` | severity=low | category=gloss
  current: "analog/analogous"
  correct: "analogue; analogous"
  why: American spelling in a British-English app.

- **großartig** | `english` | severity=low | category=gloss
  current: "awesome/brilliant"
  correct: "brilliant, splendid, magnificent"
  why: American colloquialism placed before its British equivalent.

- **touristisch / telefonisch** | `english` | severity=low | category=gloss
  current: "touristic/tourism-related", "by phone/telephonic"
  correct: "tourist, tourism-related"; "by telephone, over the phone"
  why: "touristic" and "telephonic" are not natural British English.

- **anschließend** | `english` | severity=low | category=gloss
  current: "following"
  correct: "afterwards, subsequently; subsequent"
  why: predominantly adverbial; "following" duplicates `folgend` (87).

- **übersichtlich** | `english` | severity=low | category=gloss
  current: "clear"
  correct: "clearly laid out, well organised, easy to follow"
  why: bare "clear" collides with `klar`/`deutlich` and misses the layout sense.

- **flächendeckend** | `english` | severity=low | category=gloss
  current: "comprehensive"
  correct: "blanket, across the board, covering the whole area"
  why: loses the spatial-coverage core and duplicates `umfassend` (111).

- **landesweit** | `english` | severity=low | category=gloss
  current: "nationwide/statewide"
  correct: "statewide (of a Bundesland); regional" — nationwide is `bundesweit`
  why: wrong sense first in a German-federal context.

- **anhaltend** | `english` | severity=low | category=gloss
  current: "continuous/incessant"
  correct: "persistent, sustained, continuing"
  why: "incessant" is too strong/negative.

- **gründlich** | `english` | severity=low | category=gloss
  current: "diligent/thorough"
  correct: "thorough, careful"
  why: "diligent" is `fleißig`; wrong sense first.

- **leistungsstark** | `english` | severity=low | category=gloss
  current: "efficient"
  correct: "powerful, high-performance, high-achieving"
  why: "efficient" is `effizient` (227); mistranslation of the core sense.

- **handwerklich** | `english` | severity=low | category=gloss
  current: "artisanal"
  correct: "manual, craft-, in terms of craftsmanship"
  why: far too narrow for the usual usage (handwerkliche Ausbildung/Fähigkeiten).

- **gleichnamig** | `english` | severity=low | category=gloss
  current: "eponymous"
  correct: "of the same name, same-named"
  why: "eponymous" reverses the direction of naming and is stylistically remote.

- **ordnungsgemäß** | `english` | severity=low | category=gloss
  current: "duly"
  correct: "proper, in due form, compliant; duly"
  why: adverb only, no adjective translation given.

- **olympisch** | `english` | severity=low | category=gloss
  current: "olympic"
  correct: "Olympic"
  why: needs a capital in English.

- **außerordentlich** | `english` | severity=low | category=gloss
  current: "exceptionally/extraordinary"
  correct: "extraordinary, exceptional; exceptionally"
  why: adverb before adjective in an adjective deck.

- **weitgehend** | `english` | severity=low | category=gloss
  current: "largely/extensive"
  correct: "largely, to a large extent; far-reaching"
  why: "extensive" is not what the adjective means.

- **bedingt** | `english` | severity=low | category=gloss
  current: "conditional/conditioned"
  correct: add "only to a limited extent" (nur bedingt geeignet)
  why: the most frequent everyday use is missing.

- **erhöht** | `english` | severity=low | category=gloss
  current: "raised"
  correct: "increased, elevated, higher"
  why: "raised" is unidiomatic for values/risks, the usual context.

- **einzig** | `english` | severity=low | category=gloss
  uncertain: yes
  current: "only/sole"
  correct: fine attributively; predicative use is rare — consider citing `einzige`
  why: uninflected `einzig` is mostly adverbial ("einzig und allein").

## Clean
610 entries had no issues worth reporting (90 entries flagged across 46 bullets; 700 reviewed in total).
