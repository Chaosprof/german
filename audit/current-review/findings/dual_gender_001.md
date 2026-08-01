# dual_gender_001 (reviewed 98 entries, source rows 1–98)

## Errors
- **Mensch** | `genders[1].english` | severity=high | category=gloss
  current: `wretch (archaic/dialectal, derogatory)`
  correct: `woman/female person (regional and dated, usually derogatory)`
  why: Neuter *das Mensch* specifically denotes a female person; “wretch” loses that defining sex-specific meaning. Article `das` and plural `Menscher` are correct, and keeping this rare sense out of drills is sound.

- **Teil** | `genders[1].english` | severity=low | category=gloss
  current: `part/piece/part (concrete: ein Ersatzteil)`
  correct: `piece/item or concrete component (e.g. ein Ersatzteil)`
  why: The duplicated “part” gives the learner no clear contrast with masculine abstract/constituent *der Teil*. Both articles and plurals are correct, and both common senses are suitable for drills.

- **Ort** | `genders[1].english` | severity=high | category=gloss
  current: `pointed tool/awl (archaic)`
  correct: `point/tip of a weapon or tool (archaic/technical)`
  why: Neuter *Ort* is the point or tip, not the pointed tool or an awl itself. Article `das`, plural `Örter`, and exclusion from drills are otherwise correct.

- **Alter** | `genders[0], genders[1].plural, genders[1].singularOnly` | severity=high | category=junk
  current: `der Alter` = `old man (colloquial)`, plural `Alten`; `das Alter`, plural `Alter`, `singularOnly=false`
  correct: Remove the masculine sense from the spelling `Alter` (or model the nominalised adjective separately as headword `Alte`: `der Alte`, plural `Alten`); for `das Alter` store plural `—` and `singularOnly=true`
  why: With a definite article the nominalised adjective is *der Alte*, never *der Alter*. The age noun is normally a singulare tantum, matching the primary noun-bank entry, which already stores `das Alter` with plural `—`.

- **Moment** | `genders[0].english` | severity=low | category=gloss
  current: `moment/moment (time)`
  correct: `moment (point or short period of time)`
  why: The duplicate wording is unhelpful. Both genders, plurals, and the distinction from neuter *Moment* “factor/element; moment (physics)” are correct and drill-worthy.

- **Mangel** | `bothInDrills` | severity=low | category=classification
  current: `true`
  correct: `false`
  why: Feminine *Mangel* is a now-uncommon laundry mangle, whereas the high-frequency learner sense is masculine “lack/defect”. The rare appliance homograph is valid but should not make both articles routine drill answers.

- **Mode** | `genders[1].english, bothInDrills` | severity=medium | category=gloss
  current: `der Mode` = `mode (technical)`; `bothInDrills=true`
  correct: `der Mode` = `wave mode/oscillation mode (electrical engineering/physics)`; `bothInDrills=false`
  why: Masculine *Mode* is not a generic technical “mode” but a specialist electromagnetic-wave term (plural `Moden`; feminine is also possible in that specialist sense). It should not compete in ordinary article drills with common *die Mode* “fashion”.

- **Model** | `genders[1].english, bothInDrills` | severity=low | category=classification
  current: `das Model` = `model/model (fashion)`; `bothInDrills=true`
  correct: `das Model` = `fashion model`; `bothInDrills=false`
  why: The gloss is duplicated, and masculine *Model* “mould/form” is a specialist craft term. The valid rare homograph can remain in reference data, but drilling both alongside the primary fashion-model sense gives it disproportionate weight.

- **Messer** | `bothInDrills` | severity=low | category=classification
  current: `true`
  correct: `false`
  why: Masculine *Messer* “measurer/measuring instrument” is a rare technical or agent noun; routine drills should target the overwhelmingly common neuter “knife”. Articles and invariant plurals are correct.

- **Militär** | `genders[0].english` | severity=medium | category=gloss
  current: `military officer`
  correct: `member of the military/military professional`
  why: *Ein Militär* is not necessarily a commissioned officer. The current gloss is too narrow; article `der`, plural `Militärs`, and exclusion from drills are correct.

- **Schock** | `genders[0].plural` | severity=low | category=plural
  current: `Schocke`
  correct: `Schocks` (modern standard learner form; `Schocke` is an old variant)
  why: For masculine “shock”, *Schocks* is the normal modern plural. *Schocke* remains appropriate for the separately labelled archaic neuter counting unit.

- **Gift** | `genders[0].english, genders[1].english` | severity=medium | category=gloss
  current: `die Gift` = `gift (archaic/false friend)`; `der Gift` = `anger/wrath (archaic)`
  correct: `die Gift` = `gift/present (archaic)`; `der Gift` = `anger/grudge (regional, especially Bavarian/Austrian)`
  why: “False friend” is not a meaning, and masculine *Gift* is regional rather than simply archaic. The articles, feminine plural `Giften`, masculine no-plural treatment, and exclusion from drills are sound.

- **Hummel** | `genders[0].english` | severity=low | category=gloss
  current: `bumblebee/dumbledore/hommel`
  correct: `bumblebee`
  why: “Dumbledore” is archaic English and “hommel” is obscure; both impede a British learner. This dual entry also contradicts the already-clean primary noun-bank gloss `bumblebee`.

- **Quark** | `genders[0].english` | severity=medium | category=gloss
  current: `cottage cheese/curd cheese/fromage frais/quark (curd cheese)`
  correct: `quark (soft fresh curd cheese)`
  why: Cottage cheese and fromage frais are not exact equivalents of German *Quark*. The correction matches the clearer primary noun-bank sense; article `der`, no-plural flag, and the physics homograph are correct.

- **Mast** | `genders[1].plural` | severity=low | category=plural
  current: `Maste`
  correct: `Masten` (also valid but less common: `Maste`)
  why: Both plurals are standard, but *Masten* is the usual contemporary learner citation form for poles, pylons, and ship masts.

- **Bulle** | `genders[1].english, bothInDrills` | severity=low | category=classification
  current: `bull/cop/copper/cop (slang)`; `bothInDrills=true`
  correct: `bull; police officer (slang, usually derogatory)`; `bothInDrills=false`
  why: The police gloss is duplicated and needs its pragmatic warning. Feminine *Bulle* “papal bull” is valid but specialist and should not be promoted as an equal routine drill answer.

- **Ex** | `genders` | severity=medium | category=gloss
  current: Feminine `die Ex` is represented only as `pop quiz (Bavarian)`, plural `Exen`; masculine `der Ex` is `former partner`
  correct: Also represent the common feminine partner sense: `die Ex` = `ex/former partner (female)`, plural `Ex` (with `Exen` retained for the separate Bavarian pop-quiz sense)
  why: Standard colloquial German distinguishes *der Ex* and *die Ex* by the former partner’s sex. Omitting the everyday feminine sense while retaining only a regional school term materially misleads learners.

- **Hefe** | `genders[0].english` | severity=low | category=gloss
  current: `barm/dregs/driving force/yeast`
  correct: `yeast` (optional secondary senses after it: `sediment/dregs; driving force (figurative)`)
  why: The everyday meaning is buried after obscure senses and an archaic English word. The primary noun bank already has the learner-appropriate gloss `yeast`.

- **Tram** | `genders[1].english` | severity=low | category=gloss
  current: `beam`
  correct: `beam (southern German/Austrian/Swiss regional usage)`
  why: Masculine *Tram* for a structural beam is regional, unlike the unqualified gloss. The spelling, article, plural `Trame`, and decision not to drill both are correct.

- **Orange** | `genders[0].english, genders[1].plural, genders[1].singularOnly` | severity=high | category=plural
  current: fruit = `China orange/bitter orange/orange/orange (fruit)`; colour = plural `Orange`, `singularOnly=false`
  correct: fruit = `orange (fruit)`, plural `Orangen`; colour = `orange (colour)`, plural `—`, `singularOnly=true`
  why: Ordinary *Orange* does not mean specifically bitter orange, and the repeated fruit gloss contradicts the clean primary entry. The colour noun *das Orange* is normally uncountable; both common gender-distinguished senses remain suitable for drills.

- **Korpus** | `genders[0].english` | severity=high | category=gloss
  current: `die Korpus` = `corpus`
  correct: `10-point type size (printing, historical/technical)`
  why: Feminine *Korpus* is a printing size, not a corpus. Neuter *Korpus* correctly denotes a text/evidence corpus with plural `Korpora`, while masculine *Korpus* denotes a body/base with plural `Korpusse`.

- **Rentier** | `bothInDrills` | severity=low | category=classification
  current: `true`
  correct: `false`
  why: Masculine *Rentier* “person of independent means” is dated and rare; the ordinary learner sense is neuter “reindeer”. The distinct articles and plurals are linguistically correct but should not receive equal drill weight.

- **Mahd** | `genders[1].english` | severity=low | category=gloss
  current: `alpine meadow`
  correct: `alpine meadow/hay meadow (Austrian and regional)`
  why: Neuter *Mahd* in this sense is regional, information a learner needs before trying to use it. Article `das`, plural `Mähder`, and exclusion from drills are correct.

- **Graph** | `genders[1].english` | severity=high | category=gloss
  current: `grapheme`
  correct: `graph/concrete written character (linguistics)`
  why: A *Graph* is a concrete written realization; a *Graphem* is the abstract contrastive unit. The current gloss wrongly collapses that technical distinction. Article `das` and plural `Graphe` are correct.

- **Franchise** | `genders[0].english` | severity=low | category=gloss
  current: `deductible/excess (insurance)`
  correct: `insurance excess/deductible (Swiss usage)`
  why: Feminine *Franchise* is the Swiss insurance term; standard British English should lead with “excess”. Article `die`, plural `Franchisen`, and exclusion from drills are correct.

- **Page** | `genders[0].english` | severity=high | category=gloss
  current: `page (web/book)`
  correct: `web page (computing)`
  why: German feminine *Page* is an anglicism for a web page; an ordinary book page is *die Seite*. Masculine *Page* “page/bellboy” and both stored plurals are correct.

- **Type** | `genders[1].english` | severity=medium | category=gloss
  current: `type`
  correct: `type (linguistics: abstract unit opposed to a token)`
  why: Masculine English-pronounced *Type* is a specialist type–token term, not the everyday German word for a kind/type (*Typ*). Article `der`, plural `Types`, and exclusion from drills are correct.

- **Mandarin** | `genders[0].english` | severity=low | category=gloss
  current: `mandarin`
  correct: `mandarin/high official in imperial China`
  why: The bare gloss is ambiguous for learners and can be confused with the language or with *Mandarine* “mandarin orange”. The primary noun-bank gloss already supplies the necessary “Chinese official” clarification.

- **Gemahl** | `genders[0].english, genders[1].english` | severity=medium | category=gloss
  current: masculine = `husband/spouse/husband (formal)`; neuter = `spouse (archaic)`
  correct: masculine = `husband/consort (formal, dated; especially of a high-status person)`; neuter = `wife (archaic/poetic)`
  why: The masculine gloss is duplicated, while neuter *Gemahl* specifically denotes a wife, not an arbitrary spouse. Articles and plurals `Gemahle` are correct; the primary noun-bank masculine gloss is already clearer.

- **As** | `genders[0].english` | severity=high | category=gloss
  current: `as/ace`
  correct: `as (ancient Roman coin/unit)`
  why: Masculine single-s *As* is the Roman coin/unit. The playing-card “ace” is modern *das Ass* with double `s`. Neuter *As* “A-flat” is correctly represented separately.

- **Kurkuma** | `genders[0].plural, genders[1].singularOnly` | severity=high | category=plural
  current: both gender records store plural `—` and `singularOnly=false`
  correct: `die Kurkuma` = `turmeric plant/spice`, plural `Kurkumen`, `singularOnly=false`; `das Kurkuma` = `turmeric (spice)`, plural `—`, `singularOnly=true`
  why: Feminine *Kurkuma* has the standard plural *Kurkumen* when plants are counted, matching the primary noun bank. The neuter variant denotes the uncountable spice and needs the singular-only flag; the current no-plural value and false flag contradict each other.

## Clean
67 entries had no issues worth reporting.

## Coverage attestation
I manually evaluated all 98 rows in order, including the final row `Kurkuma`.
