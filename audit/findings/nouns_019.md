# nouns_019  (reviewed 700 entries, ranks 897–12777)

## Errors

### Junk headwords

- **Jemand** | `word` | severity=high | category=junk
  current: `der Jemand / Jemande / somebody`
  correct: delete
  why: indefinite pronoun entered as a noun, with a fabricated plural.

- **Kerle** | `word` | severity=high | category=junk
  current: `der Kerle / Kerle / blokes/guys`
  correct: lemma is `der Kerl / Kerle / bloke, guy`
  why: plural of *Kerl* entered as the headword; gloss is plural too.

- **Bosse** | `word` | severity=high | category=junk
  current: `die Bosse / Bossen / bosses/Bosse (surname)`
  correct: delete (lemma is `der Boss / Bosse`)
  why: plural of *Boss* entered as a feminine lemma, with a surname glued into the gloss.

- **Qualitativ** | `word` | severity=high | category=junk
  current: `das Qualitativ / Qualitative / qualitative aspect`
  correct: delete
  why: *qualitativ* is an adjective; there is no such noun.

- **Bellevue** | `word` | severity=high | category=junk
  current: `die Bellevue / Bellevuen / Bellevue (Berlin presidential palace)`
  correct: delete
  why: proper noun (Schloss Bellevue, so neuter anyway) with an invented plural.

- **Landen** | `word` | severity=high | category=junk
  current: `das Landen / — / landing`
  correct: delete (use `die Landung`)
  why: nominalised infinitive, not a dictionary lemma.

- **Morden** | `word` | severity=high | category=junk
  current: `das Morden / — / murdering/killing`
  correct: delete (use `der Mord`)
  why: nominalised infinitive.

- **Abbiegen** | `word` | severity=high | category=junk
  current: `das Abbiegen / — / turning`
  correct: delete
  why: nominalised infinitive.

- **Eiffelturm** | `word` | severity=medium | category=junk
  current: `der Eiffelturm / — / Eiffel tower`
  correct: delete
  why: proper noun (landmark name), not vocabulary.

- **Zugspitze** | `word` | severity=medium | category=junk
  current: `die Zugspitze / Zugspitzen / Zugspitze (mountain)`
  correct: delete
  why: proper noun; plural is meaningless.

- **Gif / GIF** | `word` | severity=low | category=junk
  current: two adjacent entries `das Gif / Gifs / gif` and `das GIF / GIFs / GIF`
  correct: keep one (`das GIF / GIFs`)
  why: same lexeme duplicated by capitalisation.

- **Eth** | `word` | severity=low | category=junk
  current: `das Eth / Eths / edh/eth`
  correct: delete
  why: name of an Old English/Icelandic letter; useless to a German learner, and the gloss lists two spellings.

- **Dornröschen** | `word` | severity=low | category=junk
  current: `das Dornröschen / — / Sleeping Beauty`
  correct: delete
  why: fairy-tale character name.

- **Gezeit** | `word` | severity=medium | category=junk
  current: `die Gezeit / Gezeiten / tide`
  correct: lemma `die Gezeiten` (plurale tantum)
  why: the singular *Gezeit* is effectively non-existent in modern German.

- **Schnarchen / Bedauern** | `word` | severity=low | category=junk | uncertain: yes
  current: `das Schnarchen`, `das Bedauern`
  correct: arguably delete
  why: nominalised infinitives; both are more lexicalised than *das Landen*, so lower confidence.

### Wrong article

- **Nutzungsart** | `article` | severity=high | category=article
  current: `der Nutzungsart`
  correct: `die Nutzungsart`
  why: head is *die Art*; all *-art* compounds are feminine.

- **Alu** | `article` | severity=medium | category=article
  current: `die Alu`
  correct: `das Alu`
  why: clipping of *das Aluminium*, keeps neuter.

- **Loft** | `article` | severity=medium | category=article
  current: `der Loft` (also tagged A1 at rank 8637)
  correct: `das Loft`
  why: standard gender is neuter; *der* is a rare secondary variant. CEFR A1 is also wrong for a rank-8637 loanword.

- **Mikrometer** | `article` | severity=medium | category=article
  current: `der Mikrometer / micrometer/micrometre`
  correct: `das Mikrometer` for the unit (µm); `der Mikrometer` only for the measuring gauge
  why: the gloss leads with the unit sense but gives the tool's gender — and gives both US and British spellings.

- **Kit** | `article` | severity=low | category=article | uncertain: yes
  current: `der Kit`
  correct: `das Kit`
  why: neuter is the Duden form; *der Kit(t)* is the unrelated word for putty.

- **Aerobic** | `article` | severity=low | category=article | uncertain: yes
  current: `die Aerobic`
  correct: `das Aerobic`
  why: neuter is the standard gender.

### Wrong / invented plural

- **Herpes** | `plural` | severity=high | category=plural
  current: `Herpetes`
  correct: `—`
  why: fabricated pseudo-Greek plural; *Herpes* is a mass noun in German.

- **Genesis** | `plural` | severity=high | category=plural
  current: `Genesen`
  correct: `—`
  why: *Genesen* is the plural of *die Genese*; the biblical book has no plural.

- **Unfallrisiko** | `plural` | severity=high | category=plural
  current: `Unfallrisikos`
  correct: `Unfallrisiken`
  why: *-risiko* takes *-risiken*.

- **Strauß** | `plural` | severity=medium | category=plural
  current: `Sträuße` for gloss `bouquet/ostrich`
  correct: split — `Strauß/Sträuße` = bouquet; `Strauß/Strauße` = ostrich
  why: the given plural belongs to only one of the two senses packed into the entry.

- **Infizierte, Krankenversicherte, Liebende, Oppositionelle, Parteivorsitzende, Vereinsvorsitzende, Westdeutsche, Dunkle, Gesandte** | `plural` | severity=medium | category=plural
  current: weak `-en` plurals (`Infizierten`, `Krankenversicherten`, `Liebenden`, `Oppositionellen`, `Parteivorsitzenden`, `Vereinsvorsitzenden`, `Westdeutschen`, `Dunklen`, `Gesandten`)
  correct: bare citation plurals (`Infizierte`, `Krankenversicherte`, `Liebende`, …)
  why: every `adjNoun` in this batch carries the wrong plural form — the systemic defect again.

- **Harn, Humanismus, Kohlenmonoxid, Spyware, Orchestermusik, Darmflora, Proviant, Zahnschmelz, Schwerelosigkeit** | `plural` | severity=medium | category=plural
  current: `Harne`, `Humanismen`, `Kohlenmonoxide`, `Spywares`, `Orchestermusiken`, `Darmfloren`, `Proviante`, `Zahnschmelze`, `Schwerelosigkeiten`
  correct: `—` for all
  why: invented plurals on mass/abstract nouns (*Spywares* is the same defect as *Softwares*).

- **Geschäftsleben, Lebensmittelhandel, Süßwasser, Polizeiarbeit, Europapolitik, Massentierhaltung, Meeresforschung, Staatsverschuldung, Webentwicklung, Hartnäckigkeit, Finanzkraft, Abrieb, Autofokus, Warenverkehr, Geografie, Innenarchitektur, Invalidität, Schichtarbeit, Massenproduktion, Briefpapier** | `plural` | severity=low | category=plural
  current: plurals supplied (identical form or `-en`/`-e`)
  correct: `—` in normal usage
  why: abstract/mass nouns given plurals that are at best technical jargon; grouped as low because a few are defensible in specialist text.

- **Plazenta** | `plural` | severity=low | category=plural
  current: `Plazentas`
  correct: `Plazenten`
  why: Latinate plural is the standard form.

### Wrong or misleading gloss

- **Lehranstalt** | `english` | severity=high | category=gloss
  current: `apprenticeship asylum`
  correct: `educational institution / academy`
  why: morpheme-by-morpheme mistranslation producing a nonsense phrase.

- **Kopfzerbrechen** | `english` | severity=medium | category=gloss
  current: `headache`
  correct: `puzzling, racking one's brains; (figurative) headache`
  why: the literal *headache* is *Kopfschmerzen*; this word means mental effort/trouble.

- **Wermutstropfen** | `english` | severity=medium | category=gloss
  current: `disadvantage/downer/wormwood`
  correct: `fly in the ointment`
  why: "wormwood" is the literal morpheme, not the idiom's meaning.

- **Ausdrucksweise** | `english` | severity=medium | category=gloss
  current: `diction/enunciation`
  correct: `way of expressing oneself / phrasing / style of speech`
  why: "enunciation" is *Aussprache* — a false-friend slide into pronunciation.

- **Elektromobil** | `english` | severity=medium | category=gloss
  current: `electromobile`
  correct: `electric vehicle`
  why: "electromobile" is not current English.

- **Stromquelle** | `english` | severity=medium | category=gloss
  current: `current source`
  correct: `power source / electricity supply`
  why: *Strom* rendered with the wrong technical sense; "current source" is a specialised circuit-theory term.

- **Laudator** | `english` | severity=medium | category=gloss
  current: `laudator`
  correct: `speaker giving the tribute / eulogist`
  why: "laudator" is not an English word in ordinary use — a bare Latin passthrough.

- **Kinderlied** | `english` | severity=medium | category=gloss
  current: `nursery rhyme`
  correct: `children's song`
  why: nursery rhyme is *Kinderreim*; a *Kinderlied* is sung, not recited.

- **Gesandte** | `english` | severity=medium | category=gloss
  current: `ambassador`
  correct: `envoy / minister (diplomatic rank below ambassador)`
  why: ambassador is *Botschafter*; the ranks are distinct.

- **Genitalverstümmelung** | `english` | severity=medium | category=gloss
  current: `MGM/genital mutilation`
  correct: `genital mutilation (FGM)`
  why: the obscure acronym "MGM" sorts first and will be unreadable to a learner.

- **Abschwung** | `english` | severity=medium | category=gloss
  current: `dismount/downhill turn/downturn`
  correct: `downturn / decline` first
  why: gymnastics and skiing senses displace the everyday economic sense (alphabetical-sort artefact).

- **Joch** | `english` | severity=medium | category=gloss
  current: `acre/ridge/yoke`
  correct: `yoke` first
  why: an obsolete land measure leads instead of the core meaning.

- **Halteverbot** | `english` | severity=medium | category=gloss
  current: `clearway/no standing at any time/stopping restriction`
  correct: `no-stopping zone / no stopping (sign)`
  why: "no standing at any time" is US signage wording; "clearway" is a different UK road category.

- **Metal** | `english` | severity=medium | category=gloss
  current: `der Metal / — / metal`
  correct: `metal (music genre)`
  why: bare "metal" collides with *das Metall*; the learner will map it to the wrong word.

- **Liquid** | `english` | severity=medium | category=gloss
  current: `der Liquid / Liquide / liquid/liquid consonant`
  correct: restrict to `liquid consonant (phonetics)` or `e-liquid`
  why: the everyday "liquid" is *die Flüssigkeit*; as written the entry teaches a false equivalence.

- **Stuten** | `english` | severity=medium | category=gloss
  current: `der Stuten / Stuten / sweet bread`
  correct: `sweet white loaf (regional)` — or drop
  why: obscure regional word whose form is identical to the plural of *die Stute* (listed directly above), and "sweet bread" reads as *sweetbread* (offal).

- **Halm** | `english` | severity=low | category=gloss
  current: `culm/stalk`
  correct: `stalk / blade (of grass)` first
  why: "culm" is botanical jargon placed first.

- **Kobold** | `english` | severity=low | category=gloss
  current: `kobold/sprite`
  correct: `goblin / imp`
  why: "kobold" is an untranslated German loan, not an English gloss.

- **Kleinbuchstabe** | `english` | severity=low | category=gloss
  current: `minuscule/small letter`
  correct: `lower-case letter`
  why: palaeographic term first; the everyday English term is missing.

- **Meeresschildkröte** | `english` | severity=low | category=gloss
  current: `sea turtle/tortoise`
  correct: `sea turtle`
  why: a tortoise is a land animal — factually wrong second sense.

- **Lawine** | `english` | severity=low | category=gloss
  current: `avalanche/landslide`
  correct: `avalanche`
  why: landslide is *Erdrutsch*.

- **Muskelkater** | `english` | severity=low | category=gloss
  current: `aching, sore muscles/muscle ache/muscle fever`
  correct: `sore muscles / DOMS`
  why: "muscle fever" is a calque, not English.

- **Süßwasser** | `english` | severity=low | category=gloss
  current: `fresh water/freshwater/soft water`
  correct: `fresh water`
  why: "soft water" is *weiches Wasser*; also lists two spellings of the same word.

- **Tierseuche** | `english` | severity=low | category=gloss
  current: `epizootic/epizootic disease`
  correct: `animal disease outbreak / livestock epidemic`
  why: veterinary jargon only.

- **Austrocknung** | `english` | severity=low | category=gloss
  current: `desiccation/exsiccation`
  correct: `drying out / dehydration`
  why: "exsiccation" is effectively a non-word for learners.

- **Bedürftigkeit** | `english` | severity=low | category=gloss
  current: `indigence`
  correct: `neediness / need`
  why: archaic register.

- **Auskunftei** | `english` | severity=low | category=gloss
  current: `enquiry agency/information bureau`
  correct: `credit reference agency`
  why: in practice this is a credit bureau, not a general enquiry office.

- **Pneumologie** | `english` | severity=low | category=gloss
  current: `pneumology`
  correct: `respiratory medicine / pulmonology`
  why: "pneumology" is not used in British medical English.

- **Flurbereinigung** | `english` | severity=low | category=gloss
  current: `enclosure/land consolidation`
  correct: `land consolidation` first
  why: "enclosure" evokes a different (English historical) process.

- **Gebrauchsgegenstand** | `english` | severity=low | category=gloss
  current: `implement/utensil`
  correct: `everyday object / article of daily use`
  why: gloss is narrower than the German.

- **Öse / Flirt / Gelenkschmerz / Abberufung / Auflauf / Dispokredit / Fettleibigkeit / Fernweh / Riemen / Schenkel** | `english` | severity=low | category=gloss
  current: obscure or secondary sense sorted first — `cringle/eye/eyelet`, `coquetry/flirt/flirtation`, `arthralgia/joint pain`, `calling home/dismissal/recalling`, `baked pudding/casserole/crowd`, `drawing credit/overdraft`, `adiposity/obesity`, `itchy feet/wanderlust`, `oar/strap`, `drumsticks/thigh`
  correct: lead with `eyelet`, `flirtation`, `joint pain`, `dismissal`, `bake/gratin`, `overdraft`, `obesity`, `wanderlust`, `strap`, `thigh`
  why: alphabetical sorting pushed the learner-relevant sense out of first place.

- **Abwandlung** | `english` | severity=low | category=gloss
  current: `adaption/modification/variation`
  correct: `adaptation/modification/variation`
  why: "adaption" is a non-standard form.

- **Fachwerk** | `english` | severity=low | category=gloss
  current: `frame-work/framework/half-timber construction`
  correct: `half-timbered construction`
  why: "frame-work" is a mis-hyphenation duplicating the next item.

- **Alphabetisierung / Privatvermögen / Violett / Schachspiel / Aktenordner / Trainerteam / Stresstest / Vorwarnung / Alterungsprozess / Betäubungsmittelgesetz** | `english` | severity=low | category=gloss
  current: `literacy`, `assets`, `purple/violet`, `chess`, `folder`, `coach team`, `stress testing`, `warning`, `ageing`, `narcotic act`
  correct: `literacy education`, `private assets`, `violet` first (purple = *Lila*), `chess set / game of chess`, `ring binder / lever-arch file`, `coaching staff`, `stress test`, `advance warning`, `ageing process`, `Narcotics Act`
  why: each gloss is a shade off the German or drops the head noun.

- **Geschwisterkind** | `english` | severity=low | category=gloss | uncertain: yes
  current: `sibling`
  correct: `sibling; (regional) cousin, nephew/niece`
  why: the word is regionally ambiguous and "sibling" alone is *Geschwister*.

- **Perfekt** | `english` | severity=low | category=gloss
  current: `das Perfekt / Perfekte / perfect`
  correct: `perfect tense`; plural `—`
  why: bare "perfect" reads as the adjective; the plural is not used.

### British-English violations

- **Telefonseelsorge, Tumorgewebe, Berufsberater, Wanderurlaub, Müllsack, Zebrastreifen, Schnuller, Fertiggericht, Tischkicker, Fußballmannschaft, Schmalspurbahn, Neubauwohnung, Banknote, Blinker, Auffahrunfall, Bungalow, Bestattungsunternehmen** | `english` | severity=medium | category=gloss
  current: US spelling or US term, in several cases sorted ahead of the British one — `telephone counseling`, `tumor tissue`, `career counselor/careers adviser`, `hiking vacation`, `garbage bag`, `crosswalk/marked crosswalk/zebra`, `pacifier/dummy/soother`, `TV dinner/convenience food`, `foosball/table football`, `football team/soccer team`, `narrow gauge railroad/…railway`, `new-build apartment`, `banknote/bill/note`, `blinker/indicator`, `rear ender/rear-end collision`, `bungalow/ranch house`, `funeral home`
  correct: `counselling`, `tumour tissue`, `careers adviser`, `hiking holiday`, `bin bag / rubbish bag`, `zebra crossing`, `dummy`, `ready meal`, `table football`, `football team`, `narrow-gauge railway`, `new-build flat`, `banknote/note`, `indicator`, `rear-end collision`, `bungalow`, `funeral director's`
  why: this is a British-English app; US forms must not appear, and must never sort first.

- **Mikrometer, Savanne, Pointe, Fensterbank, Buchladen, Checkpoint, Eistee, Ukulele, Milchzahn, Altersheim, Raute, Routineuntersuchung** | `english` | severity=low | category=gloss
  current: two or three spellings/variants of the same English word in one gloss — `micrometer/micrometre`, `savanna/savannah`, `punch line/punchline`, `window sill/windowsill`, `bookshop/bookstore`, `check point/check-point/checkpoint`, `ice tea/iced tea`, `uke/ukelele/ukulele`, `baby tooth/deciduous tooth/milk tooth`, `old folk's home/old people's home`, `lozenge/rhomb/rhombus`, `routine check/routine check-up/routine examination`
  correct: one British form each — `micrometre`, `savannah`, `punchline`, `windowsill`, `bookshop`, `checkpoint`, `iced tea`, `ukulele`, `milk tooth`, `old people's home`, `rhombus`, `routine check-up`
  why: the one-form-only rule; "ice tea", "ukelele" and "old folk's" are also simply wrong.

### CEFR

- **Loft** | `cefr` | severity=low | category=cefr
  current: `A1` at rank 8637
  correct: B2/C1
  why: rare loanword tagged as beginner vocabulary. (Also see article above.)

## Clean

554 entries had no issues worth reporting (146 distinct entries are flagged above, some inside grouped bullets).

Reviewed 700 entries (all rows of nouns_019.tsv, ranks 897–12777).
