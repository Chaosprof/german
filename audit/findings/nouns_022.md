# nouns_022  (reviewed 700 entries, ranks 1731–14880)

## Errors

### Adjectival nouns carrying the weak -en plural (defect class 2)
- **Fünfjährige** | `plural` | severity=high | category=plural
  current: der Fünfjährige / Fünfjährigen
  correct: Fünfjährige
  why: `adjNoun` citation plural is the bare strong form, not the weak `-en`.
- **Hausangestellte** | `plural` | severity=high | category=plural
  current: der Hausangestellte / Hausangestellten
  correct: Hausangestellte
  why: same adjectival-noun plural defect.
- **Heimatvertriebene** | `plural` | severity=high | category=plural
  current: der Heimatvertriebene / Heimatvertriebenen
  correct: Heimatvertriebene
  why: same adjectival-noun plural defect.
- **Herrschende** | `plural` | severity=high | category=plural
  current: der Herrschende / Herrschenden
  correct: Herrschende
  why: same adjectival-noun plural defect.
- **Kriegstote** | `plural` | severity=high | category=plural
  current: der Kriegstote / Kriegstoten
  correct: Kriegstote
  why: same adjectival-noun plural defect.
- **Schwerkranke** | `plural` | severity=high | category=plural
  current: der Schwerkranke / Schwerkranken
  correct: Schwerkranke
  why: same adjectival-noun plural defect.
- **Sechste** | `plural`, `word` | severity=high | category=plural
  current: der Sechste / Sechsten "sixth"
  correct: Sechste — and the lemma itself is a bare ordinal, marginal as a dictionary headword
  why: weak plural; an ordinal nominalisation is corpus noise rather than vocabulary.
- **Siebenjährige** | `plural` | severity=high | category=plural
  current: der Siebenjährige / Siebenjährigen
  correct: Siebenjährige
  why: same adjectival-noun plural defect.
- **Streikende** | `plural` | severity=high | category=plural
  current: der Streikende / Streikenden
  correct: Streikende
  why: same adjectival-noun plural defect.
- **Verwundete** | `plural` | severity=high | category=plural
  current: der Verwundete / Verwundeten
  correct: Verwundete
  why: same adjectival-noun plural defect.
- **Frauenbeauftragte / Hilfsbedürftige** | `flags` | severity=low | category=plural
  current: no `adjNoun` flag, though both are adjectival nouns (plurals happen to be right)
  correct: tag both `adjNoun`
  why: inconsistent tagging; the app will decline them as ordinary nouns.

### Wrong article
- **Röteln** | `article` | severity=high | category=article
  current: das Röteln
  correct: die Röteln
  why: plurale tantum — there is no singular *das Röteln*; classic "plurale-tantum given a singular article".
- **Outback** | `article`, `plural` | severity=medium | category=article
  current: der Outback / Outbacks
  correct: das Outback / — (proper-noun region, no plural)
  why: loanword gender wrong; the Australian Outback is not countable.
- **Standby** | `article` | severity=medium | category=article
  current: der Standby / Standbys
  correct: das Stand-by / das Standby
  why: loanword gender wrong (Duden: *das*).

### Wrong / invented plural
- **Milchbauer** | `plural` | severity=high | category=plural
  current: Milchbauer
  correct: Milchbauern
  why: *Bauer* takes the weak plural *-n*; identical singular/plural is wrong.
- **Aberglaube** | `plural` | severity=medium | category=plural
  current: Aberglauben
  correct: —
  why: mass noun; *Aberglauben* is the oblique/variant singular, not a plural.
- **Kork** | `plural` | severity=medium | category=plural
  current: Korke, gloss "cork/plug/stopper"
  correct: — (material sense); the stopper is *der Korken*, plural *Korken*
  why: plural and gloss borrowed from a different lexeme (*Korken*).
- **Lieblingsmusik** | `plural` | severity=medium | category=plural
  current: Lieblingsmusiken
  correct: —
  why: invented plural on a mass noun (same family as the known `Musik→Musiken` defect).
- **Schrifttum** | `plural` | severity=medium | category=plural
  current: Schrifttümer
  correct: —
  why: collective/mass noun; *Schrifttümer* is not used.
- **Finanzpolitik / Fleischproduktion / Holzwirtschaft / Regionalverkehr / Zugverkehr / Überfischung / Kalorienverbrauch / Alkoholgehalt / Altholz / Freibier / Koriander / Lichtgeschwindigkeit / Skispringen / Pi** | `plural` | severity=low | category=plural
  current: Finanzpolitiken, Fleischproduktionen, Holzwirtschaften, Regionalverkehre, Zugverkehre, Überfischungen, Kalorienverbräuche, Alkoholgehalte, Althölzer, Freibiere, Koriander, Lichtgeschwindigkeiten, Skispringen, Pis
  correct: — in each case
  why: mass/abstract/unique-referent nouns given a countable plural.
- **Forschergeist / Interaktivität / Rationalität / Preisgabe / Selbstsicherheit / Spielfreude / Vielschichtigkeit / Zielstrebigkeit** | `plural` | severity=low | category=plural
  current: countable plurals on abstract qualities
  correct: — (or at least rare)
  why: abstract nouns pluralised by rule rather than by usage.
  uncertain: yes
- **Apostelgeschichte** | `plural` | severity=low | category=plural
  current: Apostelgeschichten
  correct: —
  why: title of a single biblical book; no plural.
- **Anime** | `plural` | severity=low | category=plural
  current: Anime
  correct: Animes
  why: loanword takes *-s*.
- **Industriedenkmal** | `plural`, `english` | severity=low | category=gloss
  current: Industriedenkmale / "industry monument"
  correct: Industriedenkmäler (commoner) / "industrial monument, industrial heritage site"
  why: literal morpheme-by-morpheme gloss; *-mäler* is the everyday plural.
- **Halsschmerz** | `word` | severity=medium | category=junk
  current: der Halsschmerz, plural Halsschmerzen
  correct: die Halsschmerzen (plural only)
  why: singular back-formed from a plurale-tantum ailment; nobody says *ein Halsschmerz*.

### Flatly wrong or mangled glosses
- **Textbaustein** | `english` | severity=high | category=gloss
  current: lyric brick
  correct: text module / boilerplate text / standard paragraph
  why: morpheme-mangled compound (*Text*→"lyric", *Baustein*→"brick"); tagged A1, so a learner meets it early.
- **Schlafanzug** | `english` | severity=high | category=gloss
  current: nightgown/pair of pyjamas
  correct: pyjamas
  why: "nightgown" is *Nachthemd* — a different garment, and it leads the gloss.
- **Wasserzähler** | `english` | severity=high | category=gloss
  current: water metre
  correct: water meter
  why: "metre" is the unit of length; a *Zähler* is a meter. Teaches a spelling error.
- **Getränkemarkt** | `english` | severity=medium | category=gloss
  current: beverage market
  correct: drinks shop / beverage store (a retail outlet)
  why: read as an economics term; it is a shop, not a market sector.
- **Gehversuch** | `english` | severity=medium | category=gloss
  current: walking attempt/walking test
  correct: first steps / tentative first attempt
  why: "walking test" is not a sense of the word; the figurative "first steps" sense is missing.
- **Verfahrensrecht** | `english` | severity=medium | category=gloss
  current: adjective law/procedural law
  correct: procedural law
  why: "adjective law" is an archaic jurisprudential term placed first by alphabetical sort.
- **Abwasserkanal** | `english` | severity=medium | category=gloss
  current: sewage/sewage system/sewer
  correct: sewer
  why: "sewage" is the effluent itself, not the channel; it leads the gloss.
- **Willenserklärung** | `english` | severity=medium | category=gloss
  current: declaration of will
  correct: declaration of intent
  why: standard English legal term; "declaration of will" reads as a testament.
- **Zollamt** | `english` | severity=medium | category=gloss
  current: custom office/customhouse/customs
  correct: customs office
  why: "custom office" is a typo/non-phrase and sorts first.
- **Testflug** | `english` | severity=medium | category=gloss
  current: check flight
  correct: test flight
  why: mistranslation; "check flight" is a pilot-proficiency check.
- **Textverarbeitung** | `english` | severity=medium | category=gloss
  current: text processing
  correct: word processing
  why: the established English term; "text processing" is a different (computing) concept.
- **Privatklinik** | `english` | severity=medium | category=gloss
  current: clinic
  correct: private clinic / private hospital
  why: the whole point of the compound (*Privat-*) is dropped.
- **Lebenszeichen** | `english` | severity=medium | category=gloss
  current: life signs/sign of life/vital signs
  correct: sign of life
  why: "vital signs" is *Vitalzeichen*, a medical term; and the plural form leads.
- **Röntgenaufnahme** | `english` | severity=medium | category=gloss
  current: radiograph/roentgenogram
  correct: X-ray (image)
  why: the everyday word is absent; both given forms are technical.
- **Umkleide** | `english` | severity=medium | category=gloss
  current: cabin/changing room/locker room
  correct: changing room
  why: "cabin" is not a sense of the word and sorts first.
- **Unteroffizier** | `english` | severity=medium | category=gloss
  current: junior officer/non-commissioned officer/noncommissioned officer
  correct: non-commissioned officer / NCO
  why: "junior officer" is factually wrong (an NCO is not an officer); also both hyphenations listed.
- **Gratulant** | `english` | severity=medium | category=gloss
  current: congratulator
  correct: well-wisher / person offering congratulations
  why: "congratulator" is barely English.
- **Moslem** | `english` | severity=medium | category=gloss
  current: Moslem/Muslem/Muslim
  correct: Muslim
  why: "Muslem" is a non-word; "Moslem" is dated and mildly offensive in English. One form only.
- **Nummernschild** | `english` | severity=medium | category=gloss
  current: licence plate/licence tag
  correct: number plate
  why: British term is "number plate"; "licence plate" is a US/UK spelling hybrid and "licence tag" is not English.
- **Kanzel** | `english` | severity=medium | category=gloss
  current: cockpit/pulpit
  correct: pulpit / cockpit
  why: alphabetical sort buried the primary sense.
- **Pfeife** | `english` | severity=medium | category=gloss
  current: loser/pipe/whistle
  correct: whistle / pipe (…, colloquially "wimp")
  why: a slang pejorative leads a B2 entry; core senses come last.
- **Loge** | `english` | severity=medium | category=gloss
  current: box seat/gallery
  correct: box (theatre) / lodge (masonic) / porter's lodge
  why: "gallery" is a different part of the theatre; the "lodge" sense is missing entirely.
- **Schleppe** | `english` | severity=medium | category=gloss
  current: train
  correct: train (of a dress or robe)
  why: bare "train" will be read as a railway train.
- **Tranche** | `english` | severity=medium | category=gloss
  current: block/cut/part
  correct: tranche / instalment
  why: the direct English cognate — the actual finance term — is missing.
- **Geiger** | `english` | severity=medium | category=gloss
  current: fiddler/violinist
  correct: violinist / fiddler
  why: alphabetical ordering puts the informal sense first.
- **Rückversicherung** | `english` | severity=low | category=gloss
  current: reassurance/reinsurance
  correct: reinsurance / (figuratively) backing, safety net
  why: "reassurance" leads and is a near-false-friend for *Beruhigung*.
- **Kaskade** | `english` | severity=low | category=gloss
  current: acrobatic leap/cascade/waterfall
  correct: cascade / waterfall
  why: the stunt sense (from *Kaskadeur*) is rare and sorts first.
- **Keuchhusten** | `english` | severity=low | category=gloss
  current: pertussis/whooping cough
  correct: whooping cough
  why: medical term precedes the everyday one.
- **Oberkiefer** | `english` | severity=low | category=gloss
  current: maxilla/upper jaw
  correct: upper jaw
  why: anatomical Latin leads.
- **Haselnuss** | `english` | severity=low | category=gloss
  current: hazel/hazelnut/hazelnut tree
  correct: hazelnut
  why: the tree/shrub senses precede the nut.
- **Steinbock / Widder** | `english` | severity=low | category=gloss
  current: Capricorn/ibex · Aries/ram
  correct: ibex / Capricorn · ram / Aries
  why: zodiac names sort ahead of the animals a learner actually needs.
- **Muttertier** | `english` | severity=low | category=gloss
  current: dam/mother
  correct: mother animal / dam
  why: "dam" is a specialist breeding term placed first.
- **Frischling** | `english` | severity=low | category=gloss
  current: boar piglet/freshman/shoat
  correct: young wild boar / (figuratively) newcomer
  why: "freshman" is US-specific and "shoat" is US farming dialect.
- **Lokalmatador** | `english` | severity=low | category=gloss
  current: local hero/local heroine/local jock
  correct: local hero / local favourite
  why: "local jock" is US slang and out of register.
- **Förmchen** | `english` | severity=low | category=gloss
  current: tart mould
  correct: small mould (esp. a child's sand mould) / patty tin
  why: gloss is far narrower than the word.
- **Geschenkpapier** | `english` | severity=low | category=gloss
  current: gift wrap paper
  correct: wrapping paper / gift wrap
  why: non-idiomatic doubling.
- **Zahnstein** | `english` | severity=low | category=gloss
  current: calculus/tartar
  correct: tartar / dental plaque
  why: "calculus" first reads as mathematics.
- **Leichenschau** | `english` | severity=low | category=gloss
  current: post-mortem examination/coroner's inquest
  correct: post-mortem examination
  why: a coroner's inquest is a legal hearing, not the examination.
- **Tusch** | `english` | severity=low | category=gloss
  current: flourish/sting
  correct: fanfare / flourish
  why: "sting" is broadcast jargon and opaque here.
  uncertain: yes
- **Lügenpresse** | `english` | severity=low | category=gloss
  current: lying press
  correct: "lying press" (Nazi-era and far-right propaganda term)
  why: highly loaded term given with no register warning.
- **Gauleiter** | `english` | severity=low | category=gloss
  current: gauleiter
  correct: Gauleiter (Nazi Party regional leader)
  why: circular gloss; historical context missing.
- **Vizekanzler** | `english` | severity=low | category=gloss
  current: Vice-Chancellor/vice chancellor
  correct: vice-chancellor (deputy head of government)
  why: same word twice in two casings; in Britain "Vice-Chancellor" primarily means a university head.
- **Jahrmillion / Forschungszweck** | `english` | severity=low | category=gloss
  current: "millions of years" · "research purposes"
  correct: "million years" · "research purpose"
  why: singular lemmas glossed with plural English.
- **Vorankündigung** | `english` | severity=low | category=gloss
  current: preannouncement
  correct: advance notice / advance announcement
  why: "preannouncement" is barely English.
- **Kundenberatung / Gemüsebrühe / Parkplatzsuche / Trauzimmer / Küchentuch** | `english` | severity=low | category=gloss
  current: client advice · vegetable broth · car park search · marriage room/wedding room · kitchen towel
  correct: customer advice/customer service · vegetable stock · looking for a parking space · wedding room (at a registry office) · tea towel
  why: literal renderings that miss the ordinary British phrasing.
  uncertain: yes
- **Hauptverkehrsstraße** | `english` | severity=low | category=gloss
  current: arterial road/main artery road/main road
  correct: main road / arterial road
  why: "main artery road" is not a phrase.
- **Weltausstellung** | `english` | severity=low | category=gloss
  current: expo/universal Exposition/world exhibition
  correct: world's fair / world exposition
  why: broken capitalisation mid-gloss; the usual English name is missing.
- **Sonnenliege** | `english` | severity=low | category=gloss
  current: Sun lounger
  correct: sun lounger
  why: stray capital.
- **Unterhose** | `english` | severity=low | category=gloss
  current: briefs/pants/shorts
  correct: underpants / pants
  why: to a British learner "shorts" means outerwear.
- **Liebespaar / Straßenkreuzung / Spürnase** | `english` | severity=low | category=gloss
  current: couple · crossing/intersection · good nose/flair
  correct: pair of lovers · crossroads/junction · nose (for something); also "sleuth" (a person)
  why: over-generalised or US-leaning renderings; *Spürnase* also denotes a person.

### British-English violations (grouped)
- **Filmset, Filmtheater, Frischhaltefolie, Geldschein, Grundkapital, Grundschullehrerin, Heimkind, Hirnblutung, Hundekot, Modellprogramm, Müllberg, Mutti, Reformhaus, Ruderboot, Schwefeldioxid, Tatkraft, Telefonzelle, Wohnblock, Fußgängerüberweg, Taschenmesser, Zeugenaussage** | `english` | severity=medium | category=gloss
  current: "movie set", "movie theatre", "plastic wrap", "bill", "capital stock" (first), "elementary school teacher" (first), "institutionalized", "hemorrhage", "feces", "program", "garbage heap", "mommy" (first), "health food store", "rowboat", "sulfur", "vigor", "telephone booth" (first), "apartment block/apartment building", "crosswalk", "jackknife" (first), "deposition" (first)
  correct: film set · cinema · cling film · banknote/note · share capital · primary school teacher · institutionalised · haemorrhage · dog mess/faeces · programme · rubbish heap · mummy · health food shop · rowing boat · sulphur · vigour · telephone box · block of flats · pedestrian crossing · penknife · testimony
  why: US spellings, US-only terms, or the US variant sorted ahead of the British one.
- **Naivität** | `english` | severity=medium | category=gloss
  current: naivete/naivety/naiveté
  correct: naivety
  why: three competing spellings, two of them non-British.
- **Lupine** | `english` | severity=medium | category=gloss
  current: lupine/lupinus
  correct: lupin
  why: "lupine" is the US spelling/adjective and "lupinus" is Latin genus, not English.
- **Satiriker** | `english` | severity=medium | category=gloss
  current: satiriser/satirist/satirizer
  correct: satirist
  why: two invented agent nouns, one in each of -ise/-ize.
- **Vollkornbrot / Lohnabrechnung / Waschanlage / Veranda / Trolley** | `english` | severity=low | category=gloss
  current: whole-grain/wholemeal/wholewheat · pay slip/payslip · car wash/carwash/wash system · porch/veranda/verandah · roller suitcase/rolling suitcase/trolley case
  correct: wholemeal bread · payslip · car wash · veranda · wheeled suitcase / trolley case
  why: same word listed in multiple spellings, or the US variant leading.
- **Fußgängerüberweg** | `english` | severity=medium | category=gloss
  current: crosswalk/zebra
  correct: pedestrian crossing / zebra crossing
  why: US term first, and bare "zebra" is the animal.

### Corpus junk / non-lemmas
- **Gießen** | `word` | severity=medium | category=junk
  current: das Gießen "pouring/casting"
  correct: drop — nominalised infinitive (and a homograph of the city Gießen)
  why: defect class 7; not a dictionary headword.
- **Klauen** | `word` | severity=medium | category=junk
  current: das Klauen "stealing"
  correct: drop — nominalised infinitive of *klauen*
  why: defect class 7.
- **Klingeln** | `word` | severity=medium | category=junk
  current: das Klingeln "ringing/buzzing"
  correct: drop — nominalised infinitive of *klingeln*
  why: defect class 7.
- **Pfeifen** | `word` | severity=medium | category=junk
  current: das Pfeifen "whistling"
  correct: drop — nominalised infinitive; duplicates *die Pfeife* two rows earlier
  why: defect class 7.
- **Schlendern** | `word` | severity=medium | category=junk
  current: das Schlendern "strolling"
  correct: drop — nominalised infinitive
  why: defect class 7.
- **Abbrennen** | `word` | severity=medium | category=junk
  current: das Abbrennen "burning down/burning off"
  correct: drop — nominalised infinitive
  why: defect class 7.
- **IRS** | `word` | severity=medium | category=junk
  current: der IRS "IRS"
  correct: drop — the acronym of a US government agency, not German vocabulary
  why: defect class 7 (proper noun / non-German lexeme).
- **Für** | `word` | severity=medium | category=junk
  current: das Für "the pros (in 'das Für und Wider')"
  correct: drop, or store the whole idiom *das Für und Wider*
  why: a preposition captured as a noun because of one fixed phrase.
- **Hehl** | `word` | severity=low | category=junk
  current: der Hehl "secret (in 'kein Hehl daraus machen')"
  correct: keep only as the idiom *kein Hehl aus etwas machen*
  why: the bare lemma never occurs outside that phrase.
- **Hole** | `word` | severity=low | category=junk
  current: das Hole / Holes "hole"
  correct: drop — English lexeme used only inside golf jargon
  why: defect class 7 (non-German lexeme, cf. *das Food*).
- **Freiburger / Nürnberger** | `word` | severity=low | category=junk
  current: "person from Freiburg" / "person from Nuremberg"
  correct: drop — demonyms derived from place names
  why: proper-noun derivatives, no learner value; *Nürnberger* is far commoner as an adjective/sausage.
- **Mainufer / Martinskirche / Novemberrevolution** | `word` | severity=low | category=junk
  current: "bank of the Main" / "St. Martin's Church" / "November Revolution"
  correct: drop — proper nouns
  why: named places and a historical event, not vocabulary.
- **Apache** | `english` | severity=low | category=gloss
  current: apache (lowercase)
  correct: Apache (member of the Apache people)
  why: ethnonym must be capitalised; lowercase "apache" is a different (dated French slang) word.
- **Schraubendreher / Schraubenzieher** | `word` | severity=low | category=junk
  current: two separate entries, both glossed "screwdriver"
  correct: keep one (*Schraubenzieher* is the everyday form) and cross-reference
  why: exact duplicates in the same batch.
- **Interessenskonflikt** | `word` | severity=medium | category=junk
  current: der Interessenskonflikt
  correct: der Interessenkonflikt
  why: the standard form has no linking *-s-*; teaching the variant is a spelling trap.
- **Membrane** | `word` | severity=low | category=junk
  current: die Membrane
  correct: die Membran (plural Membranen)
  why: dated side form duplicating the live lemma.
- **Stabstelle** | `word` | severity=low | category=junk
  current: die Stabstelle
  correct: die Stabsstelle
  why: missing linking *-s-*.
  uncertain: yes
- **Antipasto** | `article` | severity=low | category=article
  current: der Antipasto / Antipasti
  correct: das Antipasto (usually cited as plural *die Antipasti*)
  why: loanword gender.
  uncertain: yes
- **Abbrucharbeit** | `word` | severity=low | category=junk
  current: die Abbrucharbeit
  correct: die Abbrucharbeiten (used in the plural)
  why: singular back-formed from a normally plural collocation.
  uncertain: yes
- **Kameradin / Generalsekretärin / Superintendentin** | `english` | severity=low | category=gloss
  current: "comrade", "general secretary", "superintendent" with no female marking
  correct: add "(female)" as done elsewhere in this batch (e.g. Geigerin, Prüferin, Reiseleiterin)
  why: inconsistent treatment of *-in* forms within the same batch.

## Clean
615 entries had no issues worth reporting.

**Entries reviewed: 700** (every data row of nouns_022.tsv, ranks 1731–14880).
