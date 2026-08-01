# nouns_032  (reviewed 700 entries, ranks 922–21880)

## Errors

### Recurring classes (grouped)

- **adjNoun plurals carry the weak `-en` ending** | `plural` | severity=high | category=plural
  current: `Süchtigen`, `Vermögenden`, `Verrückten`, `Verwaltungsangestellten`, `Verwaltungsbeamten`, `Auserwählten`, `Allerwertesten`, `Bahnreisenden`
  correct: `Süchtige`, `Vermögende`, `Verrückte`, `Verwaltungsangestellte`, `Verwaltungsbeamte`, `Auserwählte`, `Allerwerteste`, `Bahnreisende`
  why: adjectival nouns take the bare citation plural, not the weak declension; all 8 `adjNoun` rows in this batch are wrong.

- **American spellings** | `english` | severity=medium | category=gloss
  current: Schwerstarbeit "hard **labor**"; Sympathisant "sympath**ize**r"; Unterzuckerung "hypoglyc**e**mia"; Achalasie "**e**sophageal achalasia"; Alterserscheinung "sign of **aging**"; Aufwachraum "post-**anes**thesia care unit"
  correct: labour, sympathiser, hypoglycaemia, oesophageal, ageing, anaesthesia
  why: app is British English.

- **American terms used, or ordered before the British equivalent** | `english` | severity=medium | category=gloss
  current: Serpentine "switchback"; Spülkasten "toilet tank"; Straßenbahnhaltestelle "**streetcar stop**/tram stop"; Terrassenwohnung "terrace **apartment**"; Unrat "**trash**/waste"; Abenteuerurlaub "adventure holiday/adventure **vacation**"; Autowerkstatt "**auto repair shop**/garage"; Bekleidungsgeschäft "clothing **store**"; Zugpferd "**draft** horse/draught horse"; Assistenzärztin "assistant doctor/**resident**"; Sechstklässler "**sixth-grader**/year-six pupil"; Tieflader "…/**lowboy**"
  correct: hairpin bend; cistern; tram stop; terrace flat; rubbish/refuse; drop "vacation"; garage; clothes shop; draught horse only; junior doctor/registrar; Year 6 pupil; drop "lowboy"
  why: British learner app; `Zugpferd` also breaks the "never both spellings in one gloss" rule.

- **Feminine agent nouns glossed with the bare masculine English** | `english` | severity=low | category=gloss
  current: Seglerin "sailor"; Standesbeamtin "registrar"; Teamleiterin "team leader"; Afrikanerin "African"
  correct: mark as female, as the batch does elsewhere ("forest owner (female)", "outsider (female)")
  why: inconsistent within the same batch; learner cannot tell the form is feminine.

- **Nominalised infinitives entered as headwords** | `word` | severity=medium | category=junk
  current: `das Stromsparen`, `das Verbreiten`, `das Zugfahren`, `das Zwitschern`, `das Abfließen`, `das Abseilen`, `das Wassern`
  correct: remove; the real lemmas are the verbs (`Strom sparen`, `verbreiten` → `die Verbreitung`, `abfließen`, `zwitschern`)
  why: corpus junk, not dictionary entries; `das Wassern` additionally glossed "splashdown", which is the spacecraft term (Wassern = ditching/alighting on water).

- **Invented plurals on mass/abstract nouns** | `plural` | severity=medium | category=plural
  current: Selbstbehauptungen, Sicherungsverwahrungen, Stammkundschaften, Stromgewinnungen, Sturheiten, Suffizienzen, Tagesbedarfe, Terrorismusbekämpfungen, Thronfolgen, Toxizitäten, Treffsicherheiten, Überheblichkeiten, Unerfahrenheiten, Unfallfluchten, Vergangenheitsbewältigungen, Wahrhaftigkeiten, Wochenmitten, Zahnerhaltungen, Zellulosen, Zerstörungskräfte, Zuströme, Adoleszenzen, Anarchien, Apathien, Astrofotografien, Allgemeinbevölkerungen, Abfallrechte, Abfalltrennungen, Abfallverbringungen, Aufnahmefähigkeiten, Beliebigkeiten, Berechenbarkeiten
  correct: `—` for all
  why: abstract/mass nouns with no attested plural (same class as `Beginn→Beginne`).

### Individual entries

- **Silberschmuck** | `plural` | severity=high | category=plural
  current: Silberschmucke
  correct: —
  why: `Schmuck` is a mass noun with no plural.

- **Sterberisiko** | `plural` | severity=high | category=plural
  current: Sterberisikos
  correct: Sterberisiken
  why: `Risiko` pluralises `Risiken` — the batch itself gets this right at `Ansteckungsrisiko`.

- **Verkehrspolizei** | `plural` | severity=high | category=plural
  current: Verkehrspolizeien
  correct: —
  why: `Polizei` has no plural.

- **Babykleidung** | `plural` | severity=high | category=plural
  current: Babykleidungen
  correct: —
  why: `Kleidung` is a mass noun; A2 word, so the error is highly visible.

- **Zimmermann** | `plural` | severity=high | category=plural
  current: Zimmermänner
  correct: Zimmerleute
  why: `-mann` occupational nouns take `-leute` (cf. Kaufleute).

- **Wirrwarr** | `plural` | severity=high | category=plural
  current: Wirrwarre
  correct: —
  why: singulare tantum; no plural exists.

- **Anziehsachen** | `article` | severity=high | category=article
  current: das Anziehsachen / plural Anziehsachen
  correct: die Anziehsachen (plurale tantum)
  why: a plural-only noun given a neuter singular article.

- **Tape** | `article` | severity=high | category=article
  current: der Tape
  correct: das Tape
  why: loanword gender wrong.

- **Wiesengrund** | `english` | severity=high | category=gloss
  current: meadow basis
  correct: meadowland / meadow valley
  why: morpheme-mangled compound — `Grund` here is "ground/valley bottom", not "basis".

- **Souterrain** | `article` + `english` | severity=medium | category=article
  current: der Souterrain / "souterrain"
  correct: das Souterrain / "basement flat, lower ground floor"
  why: wrong gender, and the gloss is the untranslated loanword (English "souterrain" means a prehistoric underground passage).

- **Tatar** | `article`/`plural` | severity=medium | category=junk
  current: der Tatar, pl. Tataren, "Tatar/steak tartare"
  correct: split — `der Tatar, -en` (Tatar person) vs `das Tatar, —` (steak tartare)
  why: two lexemes with different genders and plurals merged into one entry.

- **Skisport** | `plural` | severity=medium | category=plural
  current: Skisporte
  correct: —
  why: mass noun.

- **Staatsrecht** | `plural` | severity=medium | category=plural
  current: Staatsrechte
  correct: —
  why: mass noun (a field of law); `Staatsrechte` would mean "rights of the state".

- **Sondereigentum** | `plural` | severity=medium | category=plural
  current: Sondereigentume
  correct: —
  why: `Eigentum` in this legal sense is not counted.

- **Askese** | `plural` | severity=medium | category=plural
  current: Askesen
  correct: —
  why: mass noun.

- **Adware** | `plural` | severity=medium | category=plural
  current: Adwares
  correct: —
  why: same class as `Software→Softwares`.

- **Anis** | `plural` | severity=medium | category=plural
  current: Anise
  correct: —
  why: spice/mass noun; the form also coincides with the English plural, suggesting a machine artefact.

- **Zahnpaste** | `word` | severity=medium | category=junk
  current: die Zahnpaste
  correct: die Zahnpasta (pl. Zahnpasten)
  why: variant headword duplicating the live standard word.

- **Ziffernblatt** | `word` | severity=medium | category=junk
  current: das Ziffernblatt
  correct: das Zifferblatt
  why: misspelled headword (no linking `-n-`).

- **Veste** | `word` | severity=medium | category=junk
  current: die Veste "fortress (poetic)"
  correct: remove; live word is `die Feste`/`die Festung`
  why: archaic variant duplicating a live lemma.

- **Wasen** | `word` | severity=low | category=junk
  current: der Wasen "turf/sod"
  correct: remove or mark as regional (Swabian)
  why: dialect word presented as standard.

- **Alert** | `word` | severity=low | category=junk
  uncertain: yes
  current: der Alert "alert"
  correct: remove
  why: marginal English loan, not an established German headword; gender also doubtful.

- **Walker** | `english` | severity=medium | category=gloss
  current: walker
  correct: Nordic walker / (textile) fuller
  why: circular non-translation; the bare English word does not convey either German sense.

- **Alimentation** | `english` | severity=medium | category=gloss
  current: alimentation
  correct: maintenance payments / support (of civil servants)
  why: false friend — English "alimentation" means nourishment.

- **Suchauftrag** | `english` | severity=medium | category=gloss
  current: search application
  correct: search request / search query
  why: `Auftrag` mis-rendered as "application".

- **Spielaufbau** | `english` | severity=medium | category=gloss
  current: game structure
  correct: build-up play (football)
  why: the actual (sporting) sense is missing.

- **Urabstimmung** | `english` | severity=medium | category=gloss
  current: secret ballot/strike ballot
  correct: strike ballot (union membership vote)
  why: "secret ballot" (= geheime Abstimmung) is wrong and leads.

- **Ultra** | `english` | severity=medium | category=gloss
  current: extremist
  correct: ultra (hardcore football fan)
  why: the everyday German sense is the football one; "extremist" misleads.

- **Zivil** | `english` | severity=medium | category=gloss
  current: civil life/civil status/civilian
  correct: plain clothes / civilian clothes ("in Zivil")
  why: the actual noun sense is absent.

- **Backe** | `english` | severity=medium | category=gloss
  current: buttock/cheek/cheek piece
  correct: cheek (face) first
  why: alphabetical sorting has displaced the primary sense; C1-tagged but it is an everyday body-part word.

- **Barsch** | `english` | severity=medium | category=gloss
  current: bass/perch
  correct: perch
  why: `Barsch` is perch; bass is `Wolfsbarsch/Seebarsch`.

- **Bachforelle** | `english` | severity=medium | category=gloss
  current: brook trout/brown trout/river trout
  correct: brown trout
  why: "brook trout" is a different species (`Bachsaibling`).

- **Abenddämmerung** | `english` | severity=medium | category=gloss
  current: crepuscule/dusk/twilight
  correct: dusk/twilight
  why: obscure Latinate form sorted first.

- **Abgesang** | `english` | severity=medium | category=gloss
  current: Abgesang/end/swan song
  correct: swan song / final chapter
  why: gloss leaks the German lemma as its first item.

- **Ballermann** | `english` | severity=medium | category=gloss
  current: Ballermann/Mallorca party area
  correct: (place name) Mallorca party strip
  why: gloss leaks the German lemma; entry is essentially a proper noun.

- **Überraschungsei** | `english` | severity=medium | category=gloss
  current: Kinder Egg/Kinder Surprise
  correct: surprise egg (chocolate egg with a toy inside)
  why: brand names used as a translation.

- **Sommernachtstraum** | `english` | severity=medium | category=junk
  current: A Midsummer Night's Dream
  correct: midsummer night's dream (or remove — play title)
  why: glossed as a Shakespeare title; effectively a proper noun.

- **Telegramm** | `english` | severity=medium | category=gloss
  current: dispatch/telegram/telegramme
  correct: telegram
  why: "telegramme" is not an English word.

- **Auslöschung** | `english` | severity=medium | category=gloss
  current: erasement/extermination/extinction
  correct: erasure/annihilation/extinction
  why: "erasement" is a non-word and leads.

- **Wunschdenken** | `english` | severity=medium | category=gloss
  current: wish-thinking/wishful thinking/wishthinking
  correct: wishful thinking
  why: two of the three forms are non-words.

- **Unterleib** | `english` | severity=medium | category=gloss
  current: abdomen/alvus
  correct: abdomen / lower abdomen
  why: "alvus" is Latin, not English; plural `Unterleiber` is also dubious.

- **Totschlagargument** | `english` | severity=medium | category=gloss
  current: deathblow argument/killer phrase/knockdown argument
  correct: knock-down argument / conversation-stopper
  why: "deathblow argument" is a calque, not English.

- **Trapez** | `english` | severity=medium | category=gloss
  current: trapeze/trapezium/trapezoid
  correct: trapeze (circus) / trapezium (geometry)
  why: "trapezoid" is the US term and means the opposite shape in BrE — both cannot stand together.

- **Trübung** | `english` | severity=medium | category=gloss
  current: clouding/straining/turbidity
  correct: clouding/turbidity/dimming
  why: "straining" is a wrong derivation.

- **Unlust** | `english` | severity=medium | category=gloss
  current: aversion
  correct: listlessness / reluctance / lack of enthusiasm
  why: "aversion" is `Abneigung`; the given gloss misses the core sense.

- **Spiritus** | `plural` + `english` | severity=medium | category=plural
  current: pl. Spiritus, "alcohol/spirit"
  correct: pl. Spiritusse (or —), "methylated spirits, surgical spirit"
  why: plural form wrong and the gloss is too vague to identify the substance.

- **Agrarminister** | `english` | severity=medium | category=gloss
  current: secretary of agriculture
  correct: agriculture minister
  why: US office title for a German ministerial post.

- **Strickjacke** | `english` | severity=medium | category=gloss
  current: cardigan/gilet
  correct: cardigan
  why: a gilet is sleeveless — wrong garment.

- **Volksgemeinschaft** | `english` | severity=low | category=gloss
  uncertain: yes
  current: national community
  correct: add register marker — "(Nazi-era) national/ethnic community"
  why: heavily NS-loaded term presented as neutral vocabulary.

- **Selbstkritik** | `english` | severity=low | category=gloss
  current: auto-critique/self-criticism
  correct: self-criticism
  why: "auto-critique" is a calque and sorts first.

- **Selbstüberschätzung** | `english` | severity=low | category=gloss
  current: hubris/hybris/overconfidence
  correct: overconfidence/hubris
  why: "hybris" is the German/Greek form, not English.

- **Sichel** | `english` | severity=low | category=gloss
  current: crescent/sickle
  correct: sickle/crescent
  why: the tool sense is primary.

- **Speiseöl** | `english` | severity=low | category=gloss
  current: cooking oil/edible oil/nutritional oil
  correct: cooking oil/edible oil
  why: "nutritional oil" is not English.

- **Spielerfahrung** | `english` | severity=low | category=gloss
  current: game experience
  correct: playing experience
  why: "game experience" reads as UX, not a player's experience.

- **Spitzel** | `english` | severity=low | category=gloss
  current: spy
  correct: informer / police informant
  why: a `Spitzel` informs, he is not a `Spion`.

- **Spüler** | `english` | severity=low | category=gloss
  current: dishwasher/flusher
  correct: dishwasher (machine) / kitchen porter
  why: "flusher" is not used this way in English.

- **Stehtisch** | `english` | severity=low | category=gloss
  current: cocktail table/stand/standing table
  correct: standing table / high table / poseur table
  why: "cocktail table" is US for a low coffee table.

- **Steiger** | `english` | severity=low | category=gloss
  current: deputy/foreman/pit foreman
  correct: pit foreman (mining)
  why: obscure sense sorted first.

- **Stoßdämpfer** | `english` | severity=low | category=gloss
  current: damper/shock absorber
  correct: shock absorber
  why: ordering.

- **Stichelei** | `english` | severity=low | category=gloss
  current: jab
  correct: dig / snide remark / taunt
  why: "jab" alone is ambiguous (injection/punch).

- **Teddybär** | `english` | severity=low | category=gloss
  current: teddy bear/teddy-bear/teddybear
  correct: teddy bear
  why: three spellings of one word.

- **Überschlag** | `english` | severity=low | category=gloss
  current: flashover/rough calculation/somersault
  correct: rough calculation/somersault/flashover
  why: technical sense sorted first.

- **Unternehmerschaft** | `english` | severity=low | category=gloss
  current: entrepreneurship/business community
  correct: business community / employers collectively
  why: "entrepreneurship" is `Unternehmertum`.

- **Ursprünglichkeit** | `english` | severity=low | category=gloss
  current: originality/authenticity
  correct: unspoiltness / naturalness / authenticity
  why: "originality" (= Originalität) misleads.

- **Verzeihung** | `english` | severity=low | category=gloss
  current: excuse me/pardon
  correct: forgiveness, pardon (also as interjection "excuse me")
  why: only the interjection use is given for a noun entry.

- **Völkerbund** | `word` | severity=low | category=junk
  current: der Völkerbund "League of Nations"
  correct: —
  why: proper noun (historical institution).

- **Andreaskirche** | `word` | severity=low | category=junk
  current: die Andreaskirche "St Andrew's Church"
  correct: —
  why: proper noun.

- **Aschenbrödel** | `word` | severity=low | category=junk
  uncertain: yes
  current: das Aschenbrödel "Cinderella"
  correct: keep only if the generic "drudge/skivvy" sense is added
  why: otherwise a fairy-tale proper noun.

- **Vorbereitungsspiel** | `english` | severity=low | category=gloss
  current: preparation game
  correct: warm-up match / friendly
  why: literal calque.

- **Vorleben** | `english` | severity=low | category=gloss
  current: previous life
  correct: past / previous history / background
  why: "previous life" suggests reincarnation.

- **Wachdienst** | `english` | severity=low | category=gloss
  current: guard service/security firm/sentry
  correct: guard duty / security firm
  why: "sentry" is a person (`Wachposten`), not a service.

- **Wachmann** | `plural` | severity=low | category=plural
  uncertain: yes
  current: Wachmänner
  correct: Wachleute (Wachmänner regional/Austrian)
  why: `-leute` is the standard plural for this occupational noun.

- **Waliser** | `english` | severity=low | category=gloss
  current: Welsh/Welshman
  correct: Welshman
  why: adjective leads a noun entry (cf. the `Engländer` defect).

- **Weißwurst** | `english` | severity=low | category=gloss
  current: weisswurst
  correct: white sausage (Bavarian veal sausage)
  why: untranslated German word as gloss.

- **Weltrang** | `english` | severity=low | category=gloss
  current: world ranking
  correct: world class / international standing
  why: "world ranking" is `Weltrangliste`.

- **Zisterzienser** | `english` | severity=low | category=gloss
  current: Cistercians
  correct: Cistercian (monk)
  why: plural gloss on a singular headword.

- **Zungenschlag** | `english` | severity=low | category=gloss
  current: tongue click/accent
  correct: tone/undertone; slip of the tongue
  why: "tongue click" is `Schnalzlaut`.

- **Zwangsstörung** | `english` | severity=low | category=gloss
  current: OCD/obsessive-compulsive disorder
  correct: obsessive-compulsive disorder (OCD)
  why: abbreviation sorted before the full term.

- **Zeitlimit** | `plural` | severity=low | category=plural
  current: Zeitlimite
  correct: Zeitlimits
  why: `Limite` is the Swiss form; standard plural of `Limit` is `Limits`.

- **Alleinerbe** | `english` | severity=low | category=gloss
  current: residuary legatee/sole heir/universal successor
  correct: sole heir
  why: obscure legal terms sorted first.

- **Anlasser** | `english` | severity=low | category=gloss
  current: cranking motor/starter/starting motor
  correct: starter motor
  why: obscure form leads.

- **Arrest** | `english` | severity=low | category=gloss
  current: attachment/confinement/detention
  correct: detention (also legal attachment)
  why: rare legal sense sorted first.

- **Aussichtslosigkeit** | `english` | severity=low | category=gloss
  current: desperation/hopelessness
  correct: hopelessness / futility
  why: "desperation" is `Verzweiflung`.

- **Balz** | `english` | severity=low | category=gloss
  current: mating/mating foreplay/mating season
  correct: courtship display (of birds) / mating season
  why: "mating foreplay" is not English usage.

- **Befreiungsschlag** | `english` | severity=low | category=gloss
  current: liberating blow
  correct: clearance (football); decisive move to break free
  why: calque; neither real sense is given.

- **Bekennerschreiben** | `english` | severity=low | category=gloss
  current: avowal letter/claim of responsibility/letter claiming responsibility
  correct: letter claiming responsibility
  why: "avowal letter" is not English and leads.

## Clean

546 entries had no issues worth reporting.

Entries reviewed: **700** (all rows of `nouns_032.tsv`, header excluded).
