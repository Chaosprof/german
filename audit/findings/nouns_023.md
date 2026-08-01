# nouns_023  (reviewed 700 entries, ranks 1520–15579)

## Errors

### Articles / headword validity

- **Salami** | `article`,`plural` | severity=high | category=article
  current: `der Salami` / plural `Salami`
  correct: `die Salami` / plural `Salamis`
  why: Salami is feminine in standard German; an A1-tagged food word teaching the wrong gender.

- **Augentropfen** | `article` | severity=high | category=article
  current: `das Augentropfen`
  correct: `die Augentropfen` (plurale tantum; singular *der Augentropfen* = one drop)
  why: Neuter is impossible — *Tropfen* is masculine, and the eye-drops sense is plural-only.

- **Aw** | `word`,`english` | severity=high | category=junk
  current: `der Aw` / `—` / "Av"
  correct: delete
  why: Not a German word; gloss "Av" is not English either. Pure corpus junk.

- **Konsorte** | `english` | severity=high | category=gloss
  current: "consort"
  correct: "associate/crony (usually pl. *Konsorten* = and his ilk)"
  why: False friend — *Konsorte* never means royal consort (that is *Gemahl/Prinzgemahl*).

- **Korken** | `english` | severity=high | category=gloss
  current: "plug/stopper"
  correct: "cork"
  why: The everyday primary sense (bottle cork) is missing entirely.

- **Sättigung** | `english` | severity=high | category=gloss
  current: "satiety/saturación/saturation"
  correct: "saturation/satiety"
  why: "saturación" is Spanish — a non-English token inside the gloss.

- **Armutsrisiko** | `plural` | severity=high | category=plural
  current: `Armutsrisikos`
  correct: `Armutsrisiken`
  why: *Risiko* pluralises as *Risiken*; `-s` is a fabricated form.

- **Influenzavirus** | `article`,`english` | severity=low | category=article
  current: `der Influenzavirus` / "influenza virus/influenzavirus"
  correct: `das Influenzavirus` / "influenza virus"
  why: Standard gender for *Virus* is neuter; "influenzavirus" as one word is not English.

- **Formaldehyd** | `article` | severity=low | category=article
  current: `der Formaldehyd`
  correct: `das Formaldehyd`
  why: Duden gives *das* as standard, *der* only as technical variant — learner should get *das*.

- **Graffiti** | `word`,`plural` | severity=medium | category=junk
  current: `das Graffiti` / plural `Graffitis`
  correct: lemma `das Graffito`, plural `Graffiti`
  why: The plural has been entered as the headword and then re-pluralised.

- **Photograph** | `word` | severity=medium | category=junk
  current: `der Photograph`
  correct: `der Fotograf`
  why: Pre-1996 spelling duplicating the live lemma; teaches an outdated form.

- **Nickname** | `plural`,`flags` | severity=medium | category=plural
  current: plural `Nicknamen`, flagged `weak`
  correct: plural `Nicknames`, not a weak noun
  why: English loan takes `-s`; the weak declension is invented.

- **Auftauchen** | `word` | severity=medium | category=junk
  current: `das Auftauchen` / "appearance"
  correct: delete (nominalised infinitive); gloss would be "surfacing/emergence"
  why: Corpus junk headword, and "appearance" is the wrong noun anyway.

- **Ausatmen** | `word` | severity=medium | category=junk
  current: `das Ausatmen`
  correct: delete (nominalised infinitive)
  why: Not a dictionary lemma; *die Ausatmung* is the real noun.

- **Seilen** | `word` | severity=medium | category=junk
  current: `das Seilen` / "roping/use of ropes"
  correct: delete
  why: Nominalised infinitive, not a usable entry.

- **Gestern** | `word`,`english` | severity=medium | category=junk
  current: `das Gestern` / "yesterday"
  correct: delete, or gloss "the past/yesteryear"
  why: Nominalised adverb; glossing it "yesterday" invites `*das Gestern` for the adverb.

- **Niagarafälle** | `word` | severity=medium | category=junk
  current: `die Niagarafälle` / "Niagara Falls"
  correct: delete
  why: Proper noun, no learner value in a general word bank.

- **Mainzelmännchen** | `word` | severity=low | category=junk
  current: "Mainzelmaennchen (ZDF mascot)"
  correct: delete
  why: Trademarked TV mascot; the gloss is also an ASCII-mangled repeat of the German.

- **Queen** | `word` | severity=low | category=junk
  current: `die Queen` / "Queen"
  correct: delete, or gloss "the British Queen"
  why: Untranslated proper noun used as headword.

- **Monsieur** | `word` | severity=low | category=junk
  current: `der Monsieur` / "Monsieur"
  correct: delete
  why: French form of address, gloss untranslated; not German vocabulary.

- **Landwehr** | `english` | severity=low | category=gloss
  current: "Landwehr"
  correct: "militia/territorial reserve"
  why: Gloss simply repeats the German lemma.

- **Beauty** | `word` | severity=low | category=junk | uncertain: yes
  current: `die Beauty` / `Beautys`
  correct: delete
  why: Only occurs in German as a compound element (*Beauty-Produkt*), not a free noun.

- **Landbeschäler** | `word` | severity=low | category=junk | uncertain: yes
  current: "state stud stallion"
  correct: delete
  why: Extremely rare administrative-veterinary term; no learner value.

### Plurals

- **Invented plurals on mass/abstract nouns** | `plural` | severity=medium | category=plural
  current: `Ausbildungsdauern`, `Barockzeiten`, `Bodenerosionen`, `Brüderlichkeiten`,
  `Cyberspaces`, `Diphtherien`, `Empfängnisverhütungen`, `Experimentierfreuden`,
  `Gedränge`, `Geschichtsschreibungen`, `Geschlossenheiten`, `Heiligkeiten`,
  `Heiserkeiten`, `Hirnforschungen`, `Klaviermusiken`, `Klärschlamme`, `Kurkumen`,
  `Meereslüfte`, `Mutterschaften`, `Nordpole`, `Praktikabilitäten`, `Schauspielkünste`
  correct: `—` for all of these
  why: Mass/abstract/unique-referent nouns; `Klaviermusiken` and `Nordpole` in particular are
  the confirmed `Musik→Musiken` pattern and a pluralised unique geographic point.

- **Adjectival nouns carrying the weak `-en` plural** — one entry each:
- **Begünstigte** | `plural` | severity=medium | category=plural
  current: `Begünstigten` — correct: `Begünstigte`
  why: `adjNoun` citation plural is the bare strong form.
- **Bürgerbeauftragte** | `plural` | severity=medium | category=plural
  current: `Bürgerbeauftragten` — correct: `Bürgerbeauftragte`
  why: same.
- **Erwerbslose** | `plural` | severity=medium | category=plural
  current: `Erwerbslosen` — correct: `Erwerbslose`
  why: same.
- **Getötete** | `plural` | severity=medium | category=plural
  current: `Getöteten` — correct: `Getötete`
  why: same.
- **Geübte** | `plural`,`english` | severity=medium | category=plural
  current: `Geübten` / "practiced person" — correct: `Geübte` / "practised person"
  why: weak plural, plus US spelling "practiced".
- **Inhaftierte** | `plural` | severity=medium | category=plural
  current: `Inhaftierten` — correct: `Inhaftierte`
  why: same.
- **Kriminalbeamte** | `plural` | severity=medium | category=plural
  current: `Kriminalbeamten` — correct: `Kriminalbeamte`
  why: same.
- **Kurzentschlossene** | `plural` | severity=medium | category=plural
  current: `Kurzentschlossenen` — correct: `Kurzentschlossene`
  why: same.
- **Landesdatenschutzbeauftragte** | `plural` | severity=medium | category=plural
  current: `Landesdatenschutzbeauftragten` — correct: `Landesdatenschutzbeauftragte`
  why: same.
- **Leidtragende** | `plural` | severity=medium | category=plural
  current: `Leidtragenden` — correct: `Leidtragende`
  why: same.
- **Neunjährige** | `plural` | severity=medium | category=plural
  current: `Neunjährigen` — correct: `Neunjährige`
  why: same.
- **Protestierende** | `plural` | severity=medium | category=plural
  current: `Protestierenden` — correct: `Protestierende`
  why: same.
- **Ratsvorsitzende** | `plural` | severity=medium | category=plural
  current: `Ratsvorsitzenden` — correct: `Ratsvorsitzende`
  why: same.
- **Schwächste** | `plural`,`word` | severity=medium | category=plural
  current: `Schwächsten` — correct: `Schwächste`
  why: weak plural; the superlative-nominalisation headword is also marginal as a lemma.

- **Gecko** | `plural` | severity=low | category=plural
  current: `Geckonen`
  correct: `Geckos`
  why: `Geckonen` is a rare secondary variant; the everyday plural is `Geckos`.

### Glosses — wrong, displaced or mangled

- **Geiz** | `english`,`plural` | severity=medium | category=gloss
  current: "avarice/penury/stinginess", plural `Geize`
  correct: "meanness/stinginess", plural `—`
  why: "penury" means destitution, not miserliness; *Geiz* has no plural.

- **Hiobsbotschaft** | `english` | severity=medium | category=gloss
  current: "Job's news/bad tidings"
  correct: "bad news/terrible news"
  why: "Job's news" is a literal calque, not English.

- **Güterzug** | `english` | severity=medium | category=gloss
  current: "cargo train/freighttrain/wagon train"
  correct: "goods train/freight train"
  why: "freighttrain" is a misspelling and "wagon train" means a convoy of covered wagons.

- **Filmszene** | `english` | severity=medium | category=gloss
  current: "filmstrip/movie scene"
  correct: "film scene"
  why: "filmstrip" is a different thing (*Filmstreifen*) and leads; "movie" is US.

- **Fibel** | `english` | severity=medium | category=gloss
  current: "brooch/fibula/primer"
  correct: "primer (first reading book)/fibula (brooch)"
  why: The archaeological sense is placed first; the everyday sense is the schoolbook.

- **Bordell** | `english` | severity=medium | category=gloss
  current: "bawdy-house/brothel/house of ill fame"
  correct: "brothel"
  why: Two archaic euphemisms sort ahead of the plain word.

- **Belagerung** | `english` | severity=medium | category=gloss
  current: "beleaguerment/siege"
  correct: "siege"
  why: "beleaguerment" is vanishingly rare and leads.

- **Gewaltenteilung** | `english` | severity=medium | category=gloss
  current: "checks and balances/separation of powers"
  correct: "separation of powers"
  why: "Checks and balances" is a distinct concept (*Gewaltenverschränkung*) and leads.

- **Observation** | `english` | severity=medium | category=gloss
  current: "observation"
  correct: "surveillance (police)"
  why: False friend — general observation is *Beobachtung*; *Observation* is police tailing.

- **Reiseapotheke** | `english` | severity=medium | category=gloss
  current: "first-aid kit"
  correct: "travel medicine kit"
  why: A first-aid kit is a *Verbandskasten*; *Reiseapotheke* is medicines, not dressings.

- **Hauptamt** | `english` | severity=medium | category=gloss
  current: "main office"
  correct: "full-time post (as opposed to *Ehrenamt*)/head office"
  why: The dominant modern sense — salaried, full-time position — is missing.

- **Rednerin** | `english` | severity=medium | category=gloss
  current: "lecturer/orator/speaker"
  correct: "speaker/orator"
  why: "lecturer" (= *Dozentin*) is wrong and sorts first.

- **Schreibe** | `english`,`plural` | severity=medium | category=gloss
  current: "pen/way of writing/written language", plural `Schreiben`
  correct: "(one's) writing style" (colloquial), plural `—`
  why: "pen" is flatly wrong, and `Schreiben` collides with *das Schreiben* "letter".

- **Kommende** | `english` | severity=medium | category=gloss
  current: "commandery/coming one"
  correct: "commandery (of a knightly order)" — or delete as too obscure
  why: "coming one" is not English; the entry is near-unusable as it stands.

- **Schwefel** | `english` | severity=medium | category=gloss
  current: "brimstone/sulfur"
  correct: "sulphur"
  why: Archaic "brimstone" leads and "sulfur" is the US spelling.

- **Heiligkeit** | `english` | severity=medium | category=gloss
  current: "holiness/holyness"
  correct: "holiness/sanctity"
  why: "holyness" is a misspelling — a non-word in the gloss.

- **Feriengast** | `english` | severity=medium | category=gloss
  current: "vacationist"
  correct: "holidaymaker"
  why: "vacationist" is archaic US; British learners need "holidaymaker".

- **Fernsehfilm** | `english` | severity=medium | category=gloss
  current: "made‐for‐TV movie/telefilm/telepicture"
  correct: "television film/TV drama"
  why: All three are US trade jargon; the string also uses non-ASCII hyphens.

- **Landarzt** | `english` | severity=medium | category=gloss
  current: "country doc"
  correct: "country doctor/rural GP"
  why: "doc" is informal US register in a neutral dictionary entry.

- **Digitalfunk** | `english` | severity=medium | category=gloss
  current: "digital broadcasting"
  correct: "digital radio communications (emergency-services network)"
  why: Broadcasting is *Digitalradio/DAB*; *Digitalfunk* is two-way radio.

- **Krake** | `english` | severity=medium | category=gloss
  current: "kraken/octopus"
  correct: "octopus"
  why: The mythical sea monster leads; the real animal is the everyday sense.

- **Kurkuma** | `english`,`plural` | severity=medium | category=gloss
  current: "Indian saffron/curcuma/turmeric", plural `Kurkumen`
  correct: "turmeric", plural `—`
  why: The usable English word is last; the two leading terms are obscure, plural invented.

- **Paroli** | `english` | severity=medium | category=gloss
  current: "raise"
  correct: "*Paroli bieten* — to stand up to / match someone"
  why: Only the obsolete card-game sense is given; the idiom is the only living use.

- **Kittel** | `english` | severity=low | category=gloss
  current: "coat"
  correct: "overall/smock/lab coat"
  why: "coat" alone suggests outerwear.

- **Sprachstörung** | `english` | severity=low | category=gloss
  current: "language disorder"
  correct: "speech disorder/speech impediment"
  why: Everyday sense is speech, not linguistic-competence disorder.

- **Sprachprüfung** | `english` | severity=low | category=gloss
  current: "language certificate/language exam"
  correct: "language exam"
  why: A certificate is a *Sprachzertifikat*; wrong sense leads.

- **Polizeikraft** | `english` | severity=low | category=gloss
  current: "police force"
  correct: "police officer (usually pl. *Polizeikräfte* = police personnel)"
  why: The institution is *die Polizei*; this word counts individuals.

- **Aufklärer** | `english` | severity=low | category=gloss
  current: "enlightener"
  correct: "Enlightenment thinker/educator/reconnaissance aircraft"
  why: "enlightener" is barely English and omits both live senses.

- **Bademeister** | `english` | severity=low | category=gloss
  current: "pool attendant/swimming-master"
  correct: "pool attendant/lifeguard"
  why: "swimming-master" is not current English.

- **Eingabegerät** | `english` | severity=low | category=gloss
  current: "control input/input device/input unit"
  correct: "input device"
  why: "control input" is not a device and leads.

- **Eigenwert** | `english` | severity=low | category=gloss
  current: "eigenvalue"
  correct: "intrinsic value/eigenvalue"
  why: The maths term leads; general German usage is "intrinsic value".

- **Freibauer** | `english` | severity=low | category=gloss
  current: "passed pawn"
  correct: "freeholder/free peasant; (chess) passed pawn"
  why: Only the chess sense is given.

- **Demoskopie** | `english` | severity=low | category=gloss
  current: "opinion poll/opinion research/opinion survey"
  correct: "opinion research (the discipline)"
  why: An individual poll is *Meinungsumfrage*.

- **Girlande** | `english` | severity=low | category=gloss
  current: "festoon/garland/swag"
  correct: "garland"
  why: Alphabetical sort puts the rarer word first.

- **Peitsche** | `english` | severity=low | category=gloss
  current: "scourge/whip"
  correct: "whip"
  why: "scourge" leads and is figurative/archaic.

- **Pose** | `english` | severity=low | category=gloss
  current: "float/pose"
  correct: "pose"
  why: The angling "float" sense leads.

- **Innerei** | `english` | severity=low | category=gloss
  current: "innards"
  correct: "offal (usually pl. *Innereien*)"
  why: Culinary British term missing; the lemma is effectively plural-only.

- **Kohlrabi** | `english` | severity=low | category=gloss
  current: "German turnip/kohlrabi"
  correct: "kohlrabi"
  why: Obscure calque leads.

- **Lügner** | `english` | severity=low | category=gloss
  current: "liar/lying so-and-so/storyteller"
  correct: "liar"
  why: "storyteller" is misleading; the middle item is odd register.

- **Maschinenfabrik** | `english` | severity=low | category=gloss
  current: "machine factory"
  correct: "engineering works/machinery manufacturer"
  why: Morpheme-by-morpheme rendering.

- **Kinderzulage** | `english` | severity=low | category=gloss
  current: "child bonus"
  correct: "child allowance/child benefit"
  why: "bonus" is not the term used for this payment.

- **Organisationskomitee** | `english` | severity=low | category=gloss
  current: "organisation committee"
  correct: "organising committee"
  why: Fixed English collocation.

- **Herzdruckmassage** | `english` | severity=low | category=gloss
  current: "cardiac massage"
  correct: "chest compressions"
  why: Current first-aid terminology.

- **Fußballweltmeisterschaft** | `english` | severity=low | category=gloss
  current: "football world championship"
  correct: "football World Cup"
  why: The event's English name.

- **Profifußball** | `english` | severity=low | category=gloss
  current: "pro football"
  correct: "professional football"
  why: "pro football" reads as American football to a British learner.

- **Funkloch** | `english` | severity=low | category=gloss
  current: "dead spot/skip zone"
  correct: "mobile blackspot/no-signal area"
  why: "skip zone" is radio-propagation jargon, not the everyday sense.

- **Spanplatte** | `english` | severity=low | category=gloss
  current: "particle board"
  correct: "chipboard"
  why: British trade term.

- **Landschaftsgärtner** | `english` | severity=low | category=gloss
  current: "landscaper"
  correct: "landscape gardener"
  why: British usage.

- **Heroin** | `english` | severity=low | category=gloss
  current: "heroin/heroin (drug)"
  correct: "heroin"
  why: Duplicated sense.

- **Klärschlamm** | `english`,`plural` | severity=low | category=gloss
  current: "effluent sludge/sewage sludge/sludge", plural `Klärschlamme`
  correct: "sewage sludge", plural `—`
  why: Standard term is third; mass noun given a plural.

- **Autozulieferer** | `english` | severity=low | category=gloss
  current: "auto supplier"
  correct: "automotive supplier/car-parts supplier"
  why: "auto" as a noun modifier is US.

- **Double** | `cefr`,`english` | severity=low | category=cefr
  current: A1, gloss "double"
  correct: not A1; gloss "stand-in/body double (film)"
  why: A specialist film/sport term tagged as beginner vocabulary with a vague gloss.

### British-English violations (grouped)

- **US spellings and US-first ordering across the batch** | `english` | severity=low | category=gloss
  current → correct:
  `Beruhigungsmittel` "tranquilizer" → "tranquilliser";
  `Bahndamm` "railroad embankment" → "railway embankment";
  `Eisenbahnbrücke` "railroad bridge/railway bridge" → "railway bridge" only;
  `Führerscheinprüfung` "driver's license test" → "driving test" only;
  `Kinderärztin` "pediatrician" → "paediatrician";
  `Ferientag` "holiday/vacation day" → "day of the holidays";
  `Innenstadtbereich` "downtown area" → "city-centre area";
  `Lebensmittelgeschäft` "grocery/grocery store" → "food shop/grocer's";
  `Restmülltonne` "dustbin/garbage can/…" → drop "garbage can";
  `Schneebesen` "egg whisk/eggbeater/wire whisk" → "whisk";
  `Rodelbahn` "sledding track" → "sledge run";
  `Rodler` "luger/sledder" → "tobogganer";
  `Sammelsurium` "hodgepodge" → "hotchpotch";
  `Rechtshänder` "right-hander/righty" → "right-hander";
  `Fotokopie` "photocopy/xerox" → "photocopy";
  `Planschbecken` "kiddie pool/paddling pool/pool" → "paddling pool" first;
  `Shoppingcenter` "mall/shopping centre" → "shopping centre" first;
  `Disk` "disc/disk" → "disc" only;
  `Hardliner` "hard-liner/hardliner" → one form;
  `Nachwirkung` "after-effect/aftereffect/aftermath" → "after-effect" only;
  `Mähdrescher` "combine/combine harvester" → "combine harvester" only.
  why: App is British English; US-only terms, US spellings, and mixed BE/US pairs in one gloss
  are all forbidden by the style rule.

## Clean

608 entries had no issues worth reporting.

---
Entries reviewed: **700** (every row of `batches/nouns_023.tsv`, ranks 1520–15579).
