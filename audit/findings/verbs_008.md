# verbs_008  (reviewed 683 entries, ranks 4901–5583)

## Errors

### Structural contamination (ranks ~5310–5569)

- **[GROUP] past participles listed as lemmas — 121 entries** | `word` | severity=high | category=junk
  current: the deck holds finite past participles as headwords, all typed `regular` with `-/-/UNSET`
  correct: replace with the infinitive lemma (e.g. `missverstehen`, `eingehen`, `kommen`) or delete as duplicates of entries that already exist elsewhere
  why: a participle is not a dictionary lemma; the app will drill "gekommen" as an infinitive and derive nonsense forms ("gekommen/hat gegekommen"). Affected ranks/words:
  5310 missverstanden, 5311 eingegangen, 5313 gekommen, 5315 weitergegangen, 5316 zerrissen, 5317 zusammengebunden, 5318 wahrgenommen, 5320 schwergefallen (dup of 5254 schwerfallen), 5321 umgegangen, 5326 dahergekommen, 5330 ausgegangen, 5332 eingestanden, 5333 nahegelegen, 5336 weitergegeben, 5338 ausgeschlafen, 5344 entgegengesehen, 5349 vorausgegangen, 5351 aufgeschwungen, 5356 aufgelegen (dup of 5355), 5357 hinausgetragen, 5358 vorangegangen, 5359 zurückgegangen, 5361 verwiesen, 5362 zurückgegeben, 5364 auseinandergerissen, 5366 beigetragen, 5367 zusammengetragen, 5369 abgeschrieben, 5370 geschmissen, 5376 zugekommen, 5377 vorgesprochen, 5378 wiedergetroffen, 5380 davongelaufen, 5383 vorgekommen, 5385 umschrieben, 5387 unterschieden, 5388 weggebrochen, 5389 umgangen, 5390 eingehalten, 5392 angesprochen, 5393 eingesehen, 5396 nachgekommen, 5397 aufgegossen, 5400 nachgelassen, 5401 zurückgerufen, 5402 ausgefallen, 5403 angegriffen, 5405 aufgegriffen, 5406 dagestanden, 5408 angeklungen, 5409 erschienen, 5411 hervorgehoben, 5412 aufgestiegen, 5413 aufgewachsen, 5414 aufgenommen, 5416 mitgerissen, 5419 abgeraten, 5420 geboten, 5421 gewonnen, 5423 vollzogen, 5424 gegangen, 5425 offengestanden, 5426 überwogen, 5427 vorgezogen, 5429 gewachsen, 5433 vorgegeben, 5435 durchgefallen, 5436 eingenommen, 5439 erklommen, 5440 angestiegen, 5441 ausgestanden, 5445 erwiesen, 5447 losgeworden, 5449 zugestanden, 5452 gutgeheißen, 5455 herangegangen, 5457 verblieben, 5460 vorangetrieben, 5463 abgenommen, 5464 aufgegeben, 5465 aufgehoben, 5467 aufgeschoben, 5468 geschwunden, 5469 gestoßen, 5474 hinaufgetragen, 5475 nachgewiesen, 5476 aufgeworfen, 5477 eingewiesen, 5478 entsprochen, 5481 vorbeigefahren, 5483 aufgezogen, 5485 zugebissen (dup of 5194 zubeißen), 5492 geschworen, 5494 festgehalten, 5495 mitgegeben (dup of 5240), 5499 bezwungen, 5503 zugewiesen, 5505 mitgehalten, 5510 verschlungen, 5512 ausgebrochen, 5513 mitgegessen, 5515 nachgegangen, 5522 durchgehalten, 5527 weggelassen, 5528 ausgerissen, 5530 ausgehalten, 5532 ausgelesen, 5533 dagesessen, 5536 verholfen (dup of 5535), 5543 eingetroffen, 5546 weitergefahren, 5557 erschlossen (dup of 5242), 5559 aufgesprungen (dup of 5507), 5564 weggegangen, 5567 überhandgenommen, 5568 weggezogen, 5569 anheimgefallen

- **[GROUP] not verbs at all — 13 entries** | `word` | severity=high | category=junk
  current: adverbs, prepositions, adjectives and one noun sitting in the verb deck as `regular` verbs
  correct: delete from the verb deck (move to the adjective/adverb bank only where genuinely useful)
  why: nothing about these can be conjugated. 5314 inmitten (preposition), 5337 dermaßen (adverb), 5343 dran (adverbial particle), 5345 ungeschlagen (adjective), 5410 fortan (adverb), 5417 konservatorien (plural noun *Konservatorien*, lower-cased), 5454 zweckgebunden (adjective), 5461 firmeneigen (adjective), 5479 heran (directional particle), 5482 zulasten (preposition), 5488 ansonsten (adverb), 5506 aufgedunsen (adjective), 5509 überallhin (adverb), 5539 belesen (adjective "well-read", not the verb), 5563 wasserfarben (noun/adjective "watercolour")

- **verargumentieren** | `word` | severity=high | category=junk
  current: rank 5422, glossed "argue"
  correct: delete — the German verb is `argumentieren`
  why: not a German word; corpus artefact.

- **enhalten** | `word` | severity=high | category=junk
  current: rank 5443 "contain/include"
  correct: `enthalten` (irregular: enthielt, enthalten, haben)
  why: misspelt lemma; also wrongly typed `regular`.

- **dageboten** | `word` | severity=high | category=junk
  current: rank 5430 "offer/present"
  correct: delete — the participle of *darbieten* is `dargeboten`
  why: malformed non-word.

- **rotschämen** | `word` | severity=high | category=junk
  current: rank 5368 "blush with shame"
  correct: delete — no such lemma; use `sich schämen` / `rot werden`
  why: invented compound.

- **möchten** | `word` | severity=medium | category=junk
  current: rank 5577, `regular`, "to want", A1
  correct: lemma is `mögen` (mochte, gemocht); `möchten` is its Konjunktiv II
  why: drilling it as an infinitive with regular forms teaches a non-existent paradigm.

### Wrong regular/irregular classification (all also carry blank Präteritum/Perfekt)

- **schwellen** | `type` | severity=high | category=verbform
  current: rank 5046, `regular`, `-`/`-`, UNSET
  correct: irregular — schwoll / geschwollen / **sein**
  why: strong verb; the weak paradigm and "hat" are both wrong.

- **beschreiten** | `type` | severity=high | category=verbform
  current: rank 5244, `regular`
  correct: irregular — beschritt / beschritten / haben
  why: strong verb.

- **herumschlagen** | `type` | severity=high | category=verbform
  current: rank 5319, `regular`, "struggle around"
  correct: irregular — schlug herum / herumgeschlagen / haben; reflexive *sich mit etw. herumschlagen* = "struggle with"
  why: strong verb and the gloss misses the reflexive construction that is its only real use.

- **aufliegen** | `type` | severity=high | category=verbform
  current: rank 5355, `regular`
  correct: irregular — lag auf / aufgelegen / haben
  why: strong verb.

- **herausfließen** | `type` | severity=high | category=verbform
  current: rank 5415, `regular`, UNSET
  correct: irregular — floss heraus / herausgeflossen / **sein**
  why: strong verb of motion.

- **aufspringen** | `type` | severity=high | category=verbform
  current: rank 5507, `regular`, UNSET
  correct: irregular — sprang auf / aufgesprungen / **sein**
  why: strong verb of motion.

- **durchbeißen** | `type` | severity=high | category=verbform
  current: rank 5520, `regular`
  correct: irregular — biss durch / durchgebissen / haben
  why: strong verb.

- **freinehmen** | `type` | severity=high | category=verbform
  current: rank 5521, `regular`
  correct: irregular — nahm frei / freigenommen / haben
  why: strong verb.

- **hinauswachsen** | `type` | severity=high | category=verbform
  current: rank 5529, `regular`, UNSET
  correct: irregular — wuchs hinaus / hinausgewachsen / **sein**
  why: strong verb.

- **verhelfen** | `type` | severity=high | category=verbform
  current: rank 5535, `regular`, gloss "help"
  correct: irregular — verhalf / verholfen / haben; gloss "help sb. to get sth. (jdm. zu etw. verhelfen)"
  why: strong verb, and bare "help" is *helfen*, not *verhelfen*.

- **näherkommen** | `type` | severity=high | category=verbform
  current: rank 5540, `regular`, UNSET
  correct: irregular — kam näher / nähergekommen / **sein**
  why: strong verb of motion.

- **zurückdenken** | `type` | severity=high | category=verbform
  current: rank 5547, `regular`
  correct: irregular (mixed) — dachte zurück / zurückgedacht / haben
  why: *denken* is a mixed verb.

- **mitsprechen** | `type` | severity=high | category=verbform
  current: rank 5571, `regular`, A1
  correct: irregular — sprach mit / mitgesprochen / haben
  why: strong verb.

- **mitlesen** | `type` | severity=high | category=verbform
  current: rank 5572, `regular`, A1
  correct: irregular — las mit / mitgelesen / haben
  why: strong verb.

- **nachsprechen** | `type` | severity=high | category=verbform
  current: rank 5573, `regular`, A1
  correct: irregular — sprach nach / nachgesprochen / haben
  why: strong verb.

- **drankommen** | `type` | severity=high | category=verbform
  current: rank 5576, `regular`, UNSET
  correct: irregular — kam dran / drangekommen / **sein**
  why: strong verb.

- **rausgehen** | `type` | severity=high | category=verbform
  current: rank 5579, `regular`, UNSET
  correct: irregular — ging raus / rausgegangen / **sein**
  why: strong verb.

- **zurückfahren** | `type` | severity=high | category=verbform
  current: rank 5582, `regular`, UNSET
  correct: irregular — fuhr zurück / zurückgefahren / **sein** (haben when transitive)
  why: strong verb of motion; A1 tag makes the wrong forms especially damaging.

- **zurückfinden** | `type` | severity=high | category=verbform
  current: rank 5583, `regular`, UNSET
  correct: irregular — fand zurück / zurückgefunden / haben
  why: strong verb.

- **freihaben / zuhaben / zusammenhaben** | `type` | severity=medium | category=verbform
  current: ranks 5574, 5581, 5458 all `regular`
  correct: irregular — hatte frei / freigehabt; hatte zu / zugehabt; hatte zusammen / zusammengehabt
  why: *haben* is irregular; "*freihabte" would be generated.

- **hinauswollen** | `type` | severity=medium | category=verbform
  current: rank 5446, `regular`, "want to go out"
  correct: irregular — wollte hinaus / hinausgewollt; add the core idiom "worauf willst du hinaus? = what are you getting at"
  why: modal *wollen* is irregular; the literal gloss misses the only frequent use.

- **einsenden** | `type` | severity=medium | category=verbform
  current: rank 5542, `regular`
  correct: mixed — sandte/sendete ein, eingesandt/eingesendet
  why: *senden* is a mixed verb; the strong form is the usual one here.

- **besehen** | `praeteritum`/`perfekt` | severity=high | category=verbform
  current: rank 5352, Präteritum "besah sich", Perfekt **"sich"**
  correct: besah / besehen / haben
  why: the Perfekt cell is corrupt (holds the reflexive pronoun, not a participle).

### Auxiliary given explicitly but wrong

- **zerbersten** | `auxiliary` | severity=high | category=aux
  current: rank 5181, haben
  correct: sein — "das Glas **ist** zerborsten"
  why: change of state.

- **zerrinnen** | `auxiliary` | severity=high | category=aux
  current: rank 5191, haben
  correct: sein — "die Zeit **ist** zerronnen"
  why: change of state.

- **vorausfliegen** | `auxiliary` | severity=high | category=aux
  current: rank 5160, haben
  correct: sein — "er **ist** vorausgeflogen"
  why: verb of motion.

- **vorbeischwimmen** | `auxiliary` | severity=high | category=aux
  current: rank 5161, haben
  correct: sein — "sie **ist** vorbeigeschwommen"
  why: directed motion.

- **vorliegen** | `auxiliary` | severity=high | category=aux
  current: rank 5493, sein; gloss "available"
  correct: haben — "es **hat** vorgelegen"; gloss "be available / be on hand / have been submitted"
  why: stative verb takes haben; the bare adjective "available" is not a verb gloss.

- **mineralisieren** | `auxiliary` | severity=low | category=aux | uncertain: yes
  current: rank 4954, sein
  correct: haben (transitive/chemical use)
  why: normally transitive; sein only in a rare intransitive reading.

### `UNSET` (rendered "hat") on verbs that take *sein*

- **losmarschieren** | `auxiliary` | severity=medium | category=aux — correct: sein ("wir sind losmarschiert"); departure/motion.
- **mitsegeln** | `auxiliary` | severity=medium | category=aux — correct: sein; motion.
- **rosten** | `auxiliary` + `english` | severity=medium | category=aux — correct: sein ("das Eisen ist gerostet"); also reorder gloss to "rust/corrode" first, "degenerate" is figurative.
- **spurten** | `auxiliary` | severity=medium | category=aux — correct: sein; directed motion.
- **taumeln** | `auxiliary` | severity=medium | category=aux — correct: sein for the usual directional use ("er ist zur Tür getaumelt").
- **tippeln** | `auxiliary` | severity=medium | category=aux — correct: sein; motion.
- **trippeln** | `auxiliary` | severity=medium | category=aux — correct: sein; motion.
- **waten** | `auxiliary` | severity=medium | category=aux — correct: sein ("er ist durch den Fluss gewatet").
- **überschäumen** | `auxiliary` | severity=medium | category=aux — correct: sein ("die Milch ist übergeschäumt").
- **überschwappen** | `auxiliary` | severity=medium | category=aux — correct: sein.
- **übersprudeln** | `auxiliary` | severity=medium | category=aux — correct: sein.
- **überwallen** | `auxiliary` | severity=low | category=aux — correct: sein; rare/literary.
- **verfilzen** | `auxiliary` | severity=medium | category=aux — correct: sein (intransitive "become matted").
- **verflachen** | `auxiliary` | severity=medium | category=aux — correct: sein (intransitive "become shallow/superficial").
- **verholzen** | `auxiliary` | severity=low | category=aux — correct: sein; change of state.
- **vernarben** | `auxiliary` | severity=medium | category=aux — correct: sein ("die Wunde ist vernarbt").
- **verrecken** | `auxiliary` | severity=medium | category=aux — correct: sein ("das Tier ist verreckt").
- **versacken** | `auxiliary` | severity=medium | category=aux — correct: sein.
- **verschimmeln** | `auxiliary` | severity=medium | category=aux — correct: sein ("das Brot ist verschimmelt").
- **verwahrlosen** | `auxiliary` | severity=medium | category=aux — correct: sein.
- **zurückzucken** | `auxiliary` | severity=low | category=aux — correct: sein.
- **zusammenkrachen** | `auxiliary` | severity=medium | category=aux — correct: sein.
- **ausströmen** | `auxiliary` | severity=medium | category=aux — correct: sein for the intransitive "escape (of gas)" sense that the gloss gives.
- **aufpoppen** | `auxiliary` | severity=low | category=aux — correct: sein ("das Fenster ist aufgepoppt").
- **erfolgen** | `auxiliary` | severity=high | category=aux — correct: sein ("die Zahlung **ist** erfolgt"); a frequent B2 verb, so "hat erfolgt" is a costly error.
- **ausreisen** | `auxiliary` | severity=medium | category=aux — correct: sein.
- **einstürmen** | `auxiliary` | severity=low | category=aux — correct: sein.
- **hindurchgelangen** | `auxiliary` | severity=low | category=aux — correct: sein (all *gelangen* compounds).
- **herumirren** | `auxiliary` | severity=low | category=aux — correct: sein.
- **verpuffen** | `auxiliary` | severity=medium | category=aux — correct: sein ("der Effekt ist verpufft").
- **missglücken** | `auxiliary` | severity=medium | category=aux — correct: sein ("der Versuch ist missglückt").
- **erschauern** | `auxiliary` | severity=low | category=aux — correct: sein.
- **herumreisen** | `auxiliary` | severity=low | category=aux — correct: sein.
- **vorbeirasen** | `auxiliary` | severity=medium | category=aux — correct: sein.
- **hinausschießen** | `auxiliary` | severity=low | category=aux
  current: rank 5281, haben
  correct: sein in the idiom "über das Ziel hinausschießen" — "er **ist** über das Ziel hinausgeschossen"

### Two verbs hidden in one entry / wrong or missing core sense

- **umlaufen** | `praeteritum`/`english` | severity=high | category=verbform
  current: rank 5090, lief um / umgelaufen / sein, "circulate/knock over"
  correct: two verbs — separable *úmlaufen* (lief um, umgelaufen, sein/haben) = "knock over by running into"; inseparable *umláufen* (umlief, umláufen, haben) = "circulate/orbit"
  why: the forms are the separable verb's but the first gloss belongs to the inseparable one.

- **gebärden** | `english` | severity=medium | category=gloss
  current: rank 5215, "use sign language/gesticulate"
  correct: "(sich gebärden) behave/carry on (in a certain way)"
  why: *sich gebärden* means to conduct oneself, not to sign; "use sign language" is *gebärden* only as a technical back-formation and is not the learner sense.

- **mauscheln** | `english` | severity=medium | category=gloss
  current: rank 4951, "Yiddish/cheat/fiddle"
  correct: "wheel and deal/do shady deals/fiddle"
  why: "Yiddish" is not a translation; it is a stray etymological note placed as the first sense.

- **prozessieren** | `english` | severity=medium | category=gloss
  current: rank 5001, "litigate/process/sue"
  correct: "litigate/go to law/sue"
  why: *prozessieren* never means "process (data/material)" — that is *verarbeiten*; a false friend left unguarded.

- **verselbstständigen** | `english` | severity=medium | category=gloss
  current: rank 5146, "hive off"
  correct: "(sich verselbstständigen) become independent / take on a life of its own"
  why: reflexive-only, and "hive off" is an obscure business-jargon rendering of a secondary sense.

- **trollen** | `english` | severity=medium | category=gloss
  current: rank 5073, "troll"
  correct: "(sich trollen) push off/clear off"; internet "troll" only as a secondary loan sense
  why: the established German verb is reflexive with a quite different meaning.

- **stammeln** | `english` | severity=medium | category=gloss
  current: rank 5055, "maffle/stammer"
  correct: "stammer/stutter out"
  why: "maffle" is an archaic dialect word no British learner will know, placed first.

- **kiebitzen** | `english` | severity=medium | category=gloss
  current: rank 4905, "kibitz"
  correct: "look on/watch over someone's shoulder (esp. at cards)"
  why: "kibitz" is American-Yiddish slang, opaque in British English.

- **nörgeln** | `english` | severity=medium | category=gloss
  current: rank 4969, "beef/carp/cavil"
  correct: "grumble/moan/nag"
  why: first sense is US slang; none of the three is the everyday equivalent.

- **rechten** | `cefr` + `english` | severity=medium | category=cefr
  current: rank 5013, "argue/claim/defend", B1
  correct: rare/literary "mit jdm. rechten" = "quarrel/remonstrate with sb."; CEFR C1+ or untagged
  why: an archaic verb tagged as intermediate core vocabulary, with two glosses that do not apply.

- **zutreten** | `english` | severity=medium | category=gloss
  current: rank 5209, "step (towards)", sein
  correct: add the commoner sense "kick (out at sb.)" — that sense takes **haben**
  why: one entry hides two argument structures with different auxiliaries.

- **erschließen** | `cefr` | severity=medium | category=cefr
  current: rank 5242, A1
  correct: C1
  why: an abstract, formal verb tagged as absolute-beginner vocabulary.

- **vorspielen** | `cefr` | severity=medium | category=cefr
  current: rank 5241, A1
  correct: B1–B2
  why: "perform for/pretend to sb." is not beginner vocabulary.

- **strukturieren** | `cefr` | severity=low | category=cefr
  current: rank 5437, A2
  correct: B2
  why: abstract academic verb.

- **[GROUP] reflexive-only verbs not marked as reflexive** | `english` | severity=low | category=gloss
  current: glossed as if they were plain transitives/intransitives
  correct: prefix "(sich …)" as entries 5213/5305/5290 already do
  why: learners will produce "*ich schäme" etc. Affected: 4937 leichttun ("sich leichttun"), 5226 verirren, 5239 schämen, 5255 sehnen, 5258 bedanken, 5375 sträuben (also regloss "resist/balk at", not "bristle"), 5391 gesellen, 5404 wehren (regloss "defend oneself/resist"), 5438 verzetteln, 5444 entpuppen.

### Gloss / register / spelling

- **[GROUP] American spellings and mixed BrE/AmE forms** | `english` | severity=low | category=gloss
  current: 4976 paralysieren "paralyse/**paralyze**" (both forms in one gloss), 5000 protegieren "patroni**z**e", 5019 rubrizieren "categori**z**e", 5162 vorglühen "pre-drink/predrink/**pregame**"
  correct: one British form only — "paralyse", "patronise", "categorise", "pre-drink/have a few before going out"
  why: house style is British English.

- **[GROUP] glosses carrying the English infinitive marker "to"** | `english` | severity=low | category=gloss
  current: 5049 snowboarden "to snowboard", 5572 "to read along", 5573 "to repeat", 5575 "to fit together", 5576 "to have one's turn", 5577 "to want", 5579 "to go outside", 5581 "to be closed", 5582 "to drive back"
  correct: drop "to" — the rest of the bank uses bare verb glosses
  why: inconsistent presentation in the A1 block where consistency matters most.

- **mikroskopieren** | `english` | severity=low | category=gloss
  current: rank 4953, "examine/microscope"
  correct: "examine under a microscope"
  why: "microscope" is not an English verb.

- **polemisieren** | `english` | severity=low | category=gloss
  current: rank 4993, "polemise"
  correct: "engage in polemics/attack polemically"
  why: "polemise" is not current English.

- **mampfen** | `english` | severity=low | category=gloss
  current: rank 4947, "munch/nosh/scrump"
  correct: "munch/scoff"
  why: "scrump" means to steal apples, unrelated.

- **lärmen** | `english` | severity=low | category=gloss
  current: rank 4933, "be noisy/brawl/fuss"
  correct: "make a noise/be noisy"
  why: "brawl" is *raufen*.

- **schwelen** | `english` | severity=low | category=gloss
  current: rank 5045, "smother/smoulder"
  correct: "smoulder"
  why: "smother" is the wrong direction of the metaphor and is listed first.

- **plauschen** | `english` | severity=low | category=gloss
  current: rank 4992, "chat/chat away/exaggerate"
  correct: "chat/have a natter"
  why: "exaggerate" is not a sense of *plauschen*.

- **marodieren** | `english` | severity=low | category=gloss
  current: rank 4948, "maraud/rage"
  correct: "maraud/pillage"
  why: "rage" is wrong.

- **kerben** | `english` | severity=low | category=gloss
  current: rank 4904, "carve"
  correct: "notch/score"
  why: "carve" is *schnitzen*; *kerben* is cutting a notch.

- **lohen** | `english` | severity=low | category=gloss | uncertain: yes
  current: rank 4940, "tan (leather)"
  correct: "blaze/flare up" first; "tan with tanbark" as the rare secondary sense
  why: the tanning verb is a homonym and by far the rarer one.

- **knutschen** | `english` | severity=low | category=gloss
  current: rank 4915, "canoodle/mack/smooch"
  correct: "snog/canoodle"
  why: "mack" is US slang and not a translation a British learner can use.

- **pfuschen** | `english` | severity=low | category=gloss
  current: rank 4983, "botch/scamp"
  correct: "botch/do a shoddy job"
  why: "scamp" is archaic in this use.

- **spoilern** | `english` | severity=low | category=gloss
  current: rank 5051, "spoil"
  correct: "give away spoilers/spoil (a plot)"
  why: bare "spoil" reads as *verderben*.

- **vermöbeln** | `english` | severity=low | category=gloss
  current: rank 5130, "batter sb./beat up sb."
  correct: "beat sb. up/thrash"
  why: the "sb." placeholders leak dictionary metalanguage into the learner-facing gloss.

- **leerräumen** | `english` | severity=low | category=gloss
  current: rank 4936, "clean out"
  correct: "clear out/empty"
  why: *leer*, not *sauber*.

- **kegeln** | `english` | severity=low | category=gloss
  current: rank 4902, "bowl"
  correct: "play skittles/play ninepins"
  why: German *Kegeln* is the nine-pin game, not ten-pin bowling (*Bowling*).

- **kondolieren** | `english` | severity=low | category=gloss
  current: rank 4920, "condole"
  correct: "offer one's condolences"
  why: "condole" is not used intransitively in modern British English.

- **anfallen** | `english` | severity=low | category=gloss
  current: rank 5222, "arise/accrue (of work, costs)", sein
  correct: add "attack/set upon sb." — that sense takes **haben**
  why: a second argument structure with a different auxiliary is hidden.

- **unterlaufen** | `english` | severity=low | category=gloss
  current: rank 5237, "slip past/occur", sein
  correct: add transitive "undermine/circumvent (Vorschriften unterlaufen)" — takes haben
  why: missing the sense most common in written German.

- **rüberkommen** | `english` | severity=low | category=gloss
  current: rank 5216, "come across (as)"
  correct: "come over (here)" first, then "come across (as)"
  why: literal sense is the frequent one.

## Clean

487 entries had no issues worth reporting.

Total reviewed: 683 entries (ranks 4901–5583).
