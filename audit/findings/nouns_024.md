# nouns_024  (reviewed 700 entries, ranks 919–16280)

## Errors

### Adjectival nouns carrying the weak `-en` plural (defect class 2)
- **Transsexuelle** | `plural` | severity=high | category=plural
  current: der Transsexuelle / Transsexuellen
  correct: Transsexuelle
  why: `adjNoun` citation plural is the bare strong form, not the weak `-en` form.
- **Außerirdische** | `plural` | severity=high | category=plural
  current: der Außerirdische / Außerirdischen
  correct: Außerirdische
  why: same adjectival-noun plural error.
- **Eisheilige** | `plural` | severity=high | category=plural
  current: der Eisheilige / Eisheiligen
  correct: Eisheilige
  why: same adjectival-noun plural error.
- **Gejagte** | `plural` | severity=high | category=plural
  current: der Gejagte / Gejagten
  correct: Gejagte
  why: same adjectival-noun plural error.
- **Gerechte** | `plural` | severity=high | category=plural
  current: der Gerechte / Gerechten
  correct: Gerechte
  why: same adjectival-noun plural error.
- **Hungernde** | `plural` | severity=high | category=plural
  current: der Hungernde / Hungernden
  correct: Hungernde
  why: same adjectival-noun plural error.
- **Indigene** | `plural` | severity=high | category=plural
  current: der Indigene / Indigenen
  correct: Indigene
  why: same adjectival-noun plural error.
- **Zollbeamte** | `plural` | severity=high | category=plural
  current: der Zollbeamte / Zollbeamten
  correct: Zollbeamte
  why: same adjectival-noun plural error.

### Junk headwords and wrong articles
- **End** | `word` | severity=high | category=junk
  current: das End / Ends / "end (colloquial)"
  correct: delete — the German lemma is `das Ende` (pl. `Enden`)
  why: `End` is not a German noun; it is a bound compound element / corpus artefact.
- **Basics** | `word` | severity=high | category=junk
  current: das Basics / Basics / "basics"
  correct: delete
  why: English plural noun entered as a German singular with `das`; not a German lemma.
- **Forschungsstandort** | `article` | severity=high | category=article
  current: das Forschungsstandort
  correct: der Forschungsstandort
  why: head noun is `der Standort`; every other `-standort` compound is masculine.
- **Heimtextilien** | `article` | severity=high | category=article
  current: das Heimtextilien / Heimtextilien
  correct: die Heimtextilien (plurale tantum; singular `das Heimtextil` is not used)
  why: plural-only noun given a neuter singular article.
- **Fettpolster** | `article` | severity=medium | category=article
  current: der Fettpolster
  correct: das Fettpolster
  why: standard German is `das Polster`; `der Polster` is Austrian regional.
- **Ecstasy** | `article` | severity=medium | category=article
  current: die Ecstasy
  correct: das Ecstasy
  why: the drug is neuter in standard German.
- **Tapa** | `article` | severity=medium | category=article
  current: der Tapa / Tapas
  correct: die Tapa / Tapas
  why: Spanish loanword is feminine in German (usually cited as plural `die Tapas`).
- **Weitwinkel** | `article` | severity=medium | category=article
  current: das Weitwinkel
  correct: der Weitwinkel
  why: short form of `das Weitwinkelobjektiv` but lexicalised on `der Winkel` — Duden lists masculine.
  uncertain: yes
- **Hybrid** | `article` | severity=low | category=article
  current: das Hybrid / Hybride
  correct: der Hybrid (technical) / die Hybride (biological)
  why: neuter is not a listed gender for this loanword.
  uncertain: yes
- **Außenalster** | `word` | severity=medium | category=junk
  current: die Außenalster / "Outer Alster"
  correct: delete
  why: proper noun — a specific lake in Hamburg, not vocabulary.
- **Freiheitsstatue / Zauberflöte** | `word` | severity=low | category=junk
  current: entries for "Statue of Liberty" and "magic flute"
  correct: delete (or mark as proper nouns)
  why: proper nouns (a monument and a Mozart opera), no general-vocabulary value.
- **Nominalised infinitives** | `word` | severity=low | category=junk
  current: das Anhalten, das Busfahren, das Durchkommen, das Erschließen, das Erwärmen, das Erzeugen, das Vernehmen
  correct: delete — these are productive gerunds, not dictionary lemmas
  why: defect class 7; `das Vernehmen` is additionally glossed "hearing", but the only live use is `dem Vernehmen nach` = "by all accounts".
- **Fixed-phrase fragments** | `word` | severity=low | category=junk
  current: der Fug ("right, in 'mit Fug und Recht'"), der Garaus / Garaus ("demise, in 'den Garaus machen'")
  correct: delete, or move to a phrase list; `Garaus` certainly has no plural
  why: neither noun exists outside one idiom; the plural on `Garaus` is fabricated.
- **Demonyms from place names** | `word` | severity=low | category=junk
  current: der Trierer, der Chemnitzer, der Dresdner, die Hamburgerin, die Kölnerin
  correct: drop from a learner bank
  why: mechanically derivable inhabitant names; no learner value and they crowd out real vocabulary.
- **Filmfestspiele** | `plural` | severity=low | category=junk
  current: die Filmfestspiele / Filmfestspiele
  correct: mark as plurale tantum
  why: plural-only noun presented as a singular headword.

### Wrong or invented plurals
- **Streu** | `plural` | severity=medium | category=plural
  current: Streuen
  correct: —
  why: mass noun (animal bedding/litter); the plural is invented.
- **Südpol** | `plural` | severity=medium | category=plural
  current: Südpole
  correct: —
  why: there is one South Pole; unique referent takes no plural.
- **Tanzmusik** | `plural` | severity=medium | category=plural
  current: Tanzmusiken
  correct: —
  why: `Musik→Musiken` is the confirmed invented-plural pattern.
- **Umtrunk** | `plural` | severity=medium | category=plural
  current: Umtrunke
  correct: Umtrünke
  why: missing umlaut on the standard plural.
- **Abendland** | `plural` | severity=medium | category=plural
  current: Abendländer
  correct: —
  why: singulare tantum; `Abendländer` is a different lexeme meaning "Westerners (people)".
- **Blutkrebs** | `plural` + `english` | severity=medium | category=plural
  current: Blutkrebse / "blood Cancer"
  correct: — / "leukaemia, blood cancer"
  why: disease name is a mass noun (and `Blutkrebse` reads as "blood crabs"); "Cancer" is wrongly capitalised.
- **Fernunterricht** | `plural` | severity=medium | category=plural
  current: Fernunterrichte
  correct: —
  why: `Unterricht` has no plural.
- **Glut** | `plural` + `english` | severity=medium | category=plural
  current: Gluten / "ardour/embers/glow"
  correct: — / "embers/glow/ardour"
  why: mass noun, and the invented plural spells the English word "gluten"; alphabetical sorting also puts the figurative sense first.
- **Wärmeenergie** | `plural` | severity=low | category=plural
  current: Wärmeenergien
  correct: —
  why: mass/abstract noun.
- **Dopamin** | `plural` | severity=low | category=plural
  current: Dopamine
  correct: —
  why: substance mass noun; the form given is also the English plural.
- **Glucose** | `plural` | severity=low | category=plural
  current: Glucosen
  correct: —
  why: substance mass noun.
- **Apfelessig** | `plural` | severity=low | category=plural
  current: Apfelessige
  correct: —
  why: mass noun.
- **Klassizismus** | `plural` | severity=low | category=plural
  current: Klassizismen
  correct: —
  why: name of a single art-historical period.
- **Aktiv** | `plural` | severity=low | category=plural
  current: Aktive
  correct: —
  why: grammatical voice; also collides with `die Aktiven` ("active members").
- **Vorstellungskraft** | `plural` | severity=low | category=plural
  current: Vorstellungskräfte
  correct: —
  why: abstract faculty, no plural in normal use.
- **Kulturaustausch** | `plural` | severity=low | category=plural
  current: Kulturaustausche
  correct: —
  why: `Austausch` is not normally pluralised.

### Wrong, misleading or displaced glosses
- **Widerstandskämpfer** | `english` | severity=high | category=gloss
  current: resistance fighter/resistor
  correct: resistance fighter
  why: "resistor" is an electronic component — flatly wrong.
- **Donner** | `english` | severity=high | category=gloss
  current: Thor/thunder
  correct: thunder
  why: the Norse god sorts first alphabetically and displaces the everyday A1/B1 sense.
- **Angina** | `english` | severity=medium | category=gloss
  current: angina/tonsillitis
  correct: tonsillitis (throat infection); note that it does *not* mean English "angina"
  why: classic false friend — German `Angina` is a throat infection, not `Angina pectoris`.
- **Hexenwerk** | `english` | severity=medium | category=gloss
  current: rocket science
  correct: witchcraft/sorcery (idiom: `kein Hexenwerk` = "not rocket science")
  why: the idiomatic English rendering has been substituted for the actual meaning.
- **Grundfunktion** | `english` | severity=medium | category=gloss
  current: basis function
  correct: basic function
  why: "basis function" is a specific mathematical term; morpheme-mangled compound.
- **Grundierung** | `english` | severity=medium | category=gloss
  current: foundation
  correct: primer/undercoat (paint); also make-up foundation
  why: primary DIY/painting sense is missing entirely.
- **Flieder** | `english` | severity=medium | category=gloss
  current: elder/lilac
  correct: lilac
  why: "elder" (= Holunder) sorts first and displaces the only current sense.
- **Vorspiel** | `english` | severity=medium | category=gloss
  current: foreplay/prelude/prologue
  correct: prelude/overture/prologue (also: foreplay)
  why: alphabetical sorting puts the sexual sense first for a learner-facing entry.
- **Sucher** | `english` | severity=medium | category=gloss
  current: finder/seeker
  correct: viewfinder (camera); also seeker
  why: the concrete everyday sense (camera viewfinder) is absent.
- **Spross** | `english` | severity=medium | category=gloss
  current: cion/offspring/scion
  correct: shoot/sprout (plant); offspring, scion
  why: "cion" is an archaic misspelling of "scion", and the botanical primary sense is missing.
- **Vita** | `english` | severity=medium | category=gloss
  current: vita
  correct: CV/curriculum vitae; life story
  why: gloss just repeats the Latin word and translates nothing.
- **Kehre** | `english` | severity=medium | category=gloss
  current: U-turn
  correct: hairpin bend/switchback
  why: a `Kehre` is a road bend, not a manoeuvre; `Kehrtwende` (next entry) is the U-turn.
- **Stellwerk** | `english` | severity=medium | category=gloss
  current: interlocking station/signal box/switch tower
  correct: signal box
  why: British term is buried between an obscure technical term and a US one.
- **Streifenwagen** | `english` | severity=medium | category=gloss
  current: panda car/patrol car/prowl car
  correct: patrol car/police car
  why: dated British slang leads, US "prowl car" trails; the neutral term is second.
- **Badeanzug** | `english` | severity=medium | category=gloss
  current: bathers/bathing costume/bathing suit
  correct: swimming costume/swimsuit
  why: A1 entry led by an Australian regionalism.
- **Eisenbahner** | `english` | severity=medium | category=gloss
  current: railroader
  correct: railway worker/railwayman
  why: US-only term with no British form given.
- **Autobahnkreuz** | `english` | severity=medium | category=gloss
  current: freeway junction/highway junction/interchange
  correct: motorway interchange/motorway junction
  why: two US terms lead; no British form present.
- **"metre" for a measuring device** | `english` | severity=medium | category=gloss
  current: Blutdruckmessgerät = "blood pressure metre"; Gaszähler = "gas metre"
  correct: "blood pressure meter/monitor"; "gas meter"
  why: over-Britishisation — `metre` is the unit of length; an instrument is a `meter` in British English too.
- **Erdgeschoß** | `word` | severity=medium | category=junk
  current: das Erdgeschoß / Erdgeschoße
  correct: das Erdgeschoss / Erdgeschosse
  why: pre-reform/Austrian spelling; the reformed standard form is what a learner needs.
- **Ingenieurswissenschaft** | `word` | severity=low | category=junk
  current: die Ingenieurswissenschaft
  correct: die Ingenieurwissenschaft
  why: intrusive linking -s-; the standard form has none.
- **Verehrer** | `english` | severity=low | category=gloss
  current: admirer/lover
  correct: admirer/suitor
  why: "lover" overstates the relationship.
- **Volksgruppe** | `english` | severity=low | category=gloss
  current: ethnic group/ethnical group
  correct: ethnic group
  why: "ethnical" is not current English.
- **Volksverhetzung** | `english` | severity=low | category=gloss
  current: incitement of the people/sedition
  correct: incitement to hatred (German criminal-law offence)
  why: literal calque leads; "sedition" is a different offence.
- **Wohlwollen** | `english` | severity=low | category=gloss
  current: benevolence/good will/positivity
  correct: goodwill/benevolence
  why: "positivity" is not a translation of `Wohlwollen`.
- **Dramatiker** | `english` | severity=low | category=gloss
  current: dramatist/dramaturg/dramaturge
  correct: dramatist/playwright
  why: a `Dramaturg` is a different profession (literary manager), wrongly folded in.
- **Stecknadel** | `english` | severity=low | category=gloss
  current: ballhead pin/pin/sewing pin
  correct: pin
  why: invented compound sorts ahead of the plain word.
- **Besenreis** | `english` | severity=low | category=gloss
  current: idiopathic telangiectases/spider veins
  correct: spider veins/thread veins
  why: Latin medical term placed first.
- **Achsel** | `english` | severity=low | category=gloss
  current: armpit/axilla/oxter
  correct: armpit
  why: "oxter" is Scots/Irish dialect, "axilla" is anatomical Latin.
- **Ganove** | `english` | severity=low | category=gloss
  current: criminal/crook/ganef
  correct: crook/criminal
  why: "ganef" is obscure Yiddish-English.
- **Bratkartoffel** | `english` | severity=low | category=gloss
  current: German fried potatoes/German fries/fried potatoes
  correct: fried potatoes/sauté potatoes
  why: "German fries" is not an English dish name.
- **Couchtisch** | `english` | severity=low | category=gloss
  current: coffee table/end table/occasional table
  correct: coffee table
  why: an "end table" is a `Beistelltisch`, not a `Couchtisch`.
- **Gänseblümchen** | `english` | severity=low | category=gloss
  current: common daisy/daisy/english daisy
  correct: daisy
  why: "english" is uncapitalised and the entry is triple-redundant.
- **Kaffeehaus** | `english` | severity=low | category=gloss
  current: coffee shop
  correct: coffee house/café (Viennese-style)
  why: "coffee shop" reads as a chain outlet and loses the cultural sense.
- **Katarakt** | `article`/`english` | severity=low | category=gloss
  current: der Katarakt / "cataract"
  correct: der Katarakt = rapids/waterfall; die Katarakt = cataract (eye)
  why: gender selects the sense, and the gloss given belongs to the feminine entry.
  uncertain: yes
- **Whiskey** | `word` | severity=low | category=gloss
  current: der Whiskey / "whiskey"
  correct: der Whisky / "whisky"
  why: `Whisky` is the standard German headword, and British English uses "whisky".
- **Doc** | `word` | severity=low | category=junk
  current: der Doc / Docs / "doc"
  correct: drop
  why: colloquial English clipping, not a teachable German lemma.

### British-English violations (grouped)
- **US terms/spellings with no British form, or ordered before it** | `english` | severity=medium | category=gloss
  current: Zeltplatz "campground" · Immobilienverkauf "real estate sale" · Bundesbahn "federal railroad/…" · Hosenbein "pant leg/trouser leg" · Taxifahrt "cab ride/taxi ride" · Ferienunterkunft "…/vacation rental" · Grundimmunisierung "basic immunization/…" · Immatrikulationsbescheinigung "certificate of enrollment" · Duschkabine "…/shower stall" · Durchlauferhitzer "…/tankless water heater" · Trinkbrunnen "…/water bubbler/…" · Joghurtbecher "yogurt cup/yogurt pot" · Antiquariat "…/antiquarian bookstore"
  correct: campsite · property sale · federal railway · trouser leg · taxi ride · holiday rental · basic immunisation · certificate of enrolment · shower cubicle · instantaneous water heater · drinking fountain · yoghurt pot · antiquarian bookshop
  why: British-English app — US spellings/terms must not appear, and must never precede the British form.
- **Both British and American spellings in one gloss** | `english` | severity=low | category=gloss
  current: Kaliber "caliber/calibre" · Donut "donut/doughnut" · Zugluft "draft/draught" · Waschsalon "launderette/laundrette/laundromat" · Erzfeind "arch enemy/archenemy" · Diakonat "deaconate/diaconate"
  correct: calibre · doughnut · draught · launderette · archenemy · diaconate
  why: one form only, British — `Waschsalon` even lists two spellings of the same British word plus the US one.

### CEFR
- **Statist** | `cefr` | severity=low | category=cefr
  current: A1
  correct: B2/C1
  why: "film extra / supernumerary" is not beginner vocabulary.

## Clean
612 entries had no issues worth reporting.

Total reviewed: 700 entries (all rows of nouns_024.tsv).
