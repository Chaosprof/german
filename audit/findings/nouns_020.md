# nouns_020  (reviewed 700 entries, ranks 904–13479)

## Errors

### Wrong article

- **Rollo** | `article` | severity=high | category=article
  current: `die Rollo` / Rollos / "roller blind"
  correct: `das Rollo`
  why: Standard German is *das Rollo* (Austrian *der*); *die* is not attested.

- **Urlaubsfoto** | `article` | severity=high | category=article
  current: `die Urlaubsfoto` / "vacation photo/holiday photo"
  correct: `das Urlaubsfoto`; gloss "holiday photo" only
  why: Head noun is *das Foto*; also US "vacation" placed before British "holiday".

- **Adoptiveltern** | `article` | severity=high | category=article
  current: `das Adoptiveltern` / Adoptiveltern
  correct: `die Adoptiveltern` (plurale tantum)
  why: Same defect as `das Gasteltern` — plural-only noun given a neuter singular article.

- **Emscher** | `article` | severity=high | category=junk
  current: `das Emscher` / — / "Emscher (river)"
  correct: remove (proper noun); if kept, `die Emscher`
  why: River name, not a dictionary word, and the gender is wrong as well.

- **Messi** | `article` | severity=high | category=junk
  current: `die Messi` / Messis / "hoarder (slang)/Messi"
  correct: `der Messie`, pl. `Messies`, "compulsive hoarder"
  why: Lemma misspelt, gender wrong, and the second "gloss" is the footballer's surname.

### Fabricated / junk headwords

- **Schotten** | `word` | severity=high | category=junk
  current: `der Schotten` / — / "Scots/the Scottish"
  correct: `der Schotte`, pl. `Schotten`, "Scot" (weak masc.)
  why: Plural entered as the lemma; the gloss even admits it is plural.

- **Kratzen / Polieren / Schmelzen / Schreien / Erhitzen / Aufwachen / Rodeln** | `word` | severity=medium | category=junk
  current: seven neuter nominalised infinitives entered as headwords (`das Kratzen`, `das Polieren`, `das Schmelzen`, `das Schreien`, `das Erhitzen`, `das Aufwachen`, `das Rodeln`)
  correct: drop; teach the verbs (*kratzen*, *polieren*, *schmelzen*, *schreien*, *erhitzen*, *aufwachen*, *rodeln*)
  why: Corpus artefacts, not vocabulary items. (`Rodeln` additionally glossed with US "sledding".)

- **Skale** | `word` | severity=medium | category=junk
  current: `die Skale` / Skalen / "scale"
  correct: `die Skala`, pl. `Skalen`
  why: Archaic/technical variant duplicating the live lemma *Skala*.

- **Xbox** | `word` | severity=medium | category=junk
  current: `die Xbox` / — / "Xbox"
  correct: remove
  why: Company product name, same class as `das Microsoft`.

- **Zehntausend** | `word`,`plural` | severity=medium | category=junk
  current: `die Zehntausend` / Zehntausenden / "ten thousand"
  correct: remove, or `Zehntausende` "tens of thousands"
  why: Numeral dressed as a noun; the plural given is the dative form.

- **Zigeuner** | `english` | severity=medium | category=gloss
  current: "Gypsy/Romani person (offensive term)"
  correct: remove from the deck, or gloss "Roma person (**Zigeuner** is a slur — avoid)"
  why: A slur taught with the slur itself leading the gloss; the warning trails it.

- **Werd** | `word` | severity=low | category=junk
  current: `das Werd` / Werde / "river island"
  correct: `der Werder`
  why: Obsolete variant; the live form is *Werder*. uncertain: yes

- **Neunzigerjahre / Sechzigerjahre** | `word` | severity=low | category=junk
  current: entered as singular lemmas with identical "plural"
  correct: mark as plurale tantum
  why: Plural-only nouns given a singular slot.

### Wrong or invented plural

- **Kursbeginn** | `plural` | severity=high | category=plural
  current: Kursbeginne
  correct: —
  why: *Beginn* has no plural — the exact `Beginn→Beginne` defect.

- **Verletzungsrisiko** | `plural` | severity=high | category=plural
  current: Verletzungsrisikos
  correct: Verletzungsrisiken
  why: *das Risiko* pluralises *Risiken*, never *Risikos*.

- **Schaulustige** | `plural` | severity=high | category=plural
  current: `der Schaulustige` / Schaulustigen (flag `adjNoun`)
  correct: Schaulustige
  why: Adjectival noun given the weak *-en* plural instead of the citation form.

- **Drogenabhängige** | `plural` | severity=high | category=plural
  current: `der Drogenabhängige` / Drogenabhängigen (flag `adjNoun`)
  correct: Drogenabhängige
  why: Same adjectival-noun defect.

- **Krebsforschung** | `plural`,`english` | severity=medium | category=plural
  current: Krebsforschungen / "Cancer research"
  correct: — / "cancer research"
  why: *Forschung* here is a mass noun; gloss also mid-sentence capitalised.

- **Obdachlosigkeit** | `plural` | severity=medium | category=plural
  current: Obdachlosigkeiten
  correct: —
  why: Abstract *-keit* noun; no plural exists.

- **Angemessenheit** | `plural` | severity=medium | category=plural
  current: Angemessenheiten
  correct: —
  why: Abstract *-keit*, invented plural.

- **Endlichkeit** | `plural` | severity=medium | category=plural
  current: Endlichkeiten
  correct: —
  why: Abstract; a plural only exists in specialist mathematics.

- **Aktionismus** | `plural` | severity=medium | category=plural
  current: Aktionismen
  correct: —
  why: *-ismus* abstract with no plural in this sense.

- **Wahn** | `plural` | severity=medium | category=plural
  current: Wahne
  correct: —
  why: *der Wahn* is uncountable.

- **Unterholz** | `plural` | severity=medium | category=plural
  current: Unterhölzer
  correct: —
  why: Mass noun ("undergrowth"); the umlauted plural is invented.

- **Vollbeschäftigung** | `plural` | severity=medium | category=plural
  current: Vollbeschäftigungen
  correct: —
  why: Economic abstract, no plural.

- **Gegenwartskunst** | `plural` | severity=medium | category=plural
  current: Gegenwartskünste
  correct: —
  why: *Kunst* as a mass noun here; *Künste* means "the arts/skills".

- **Chormusik** | `plural` | severity=medium | category=plural
  current: Chormusiken
  correct: —
  why: The known `Musik→Musiken` defect.

- **Cholesterin** | `plural` | severity=medium | category=plural
  current: Cholesterine
  correct: —
  why: Substance mass noun.

- **Bauchspeicheldrüsenkrebs** | `plural` | severity=medium | category=plural
  current: Bauchspeicheldrüsenkrebse
  correct: —
  why: Disease *Krebs* has no plural; *Krebse* is "crabs".

- **Büroalltag** | `plural` | severity=medium | category=plural
  current: Büroalltage
  correct: —
  why: *Alltag* is uncountable.

- **Mikrokosmos** | `plural` | severity=low | category=plural
  current: —
  correct: Mikrokosmen
  why: A real plural exists and is used.

- **Toilettenpapier** | `plural`,`english` | severity=low | category=plural
  current: Toilettenpapiere / "loo paper/toilet paper"
  correct: — / "toilet paper"
  why: Mass noun; colloquial "loo paper" should not lead.

- **Immergrün** | `plural` | severity=low | category=plural
  current: Immergrüne
  correct: Immergrün
  why: Duden gives the uninflected plural. uncertain: yes

- **Luftaustausch** | `plural` | severity=low | category=plural
  current: Luftaustausche
  correct: —
  why: Process noun, plural barely attested. uncertain: yes

- **Blumenkohl** | `plural` | severity=low | category=plural
  current: Blumenkohle
  correct: —
  why: Normally uncountable in German. uncertain: yes

### Wrong / displaced / mangled glosses

- **Streichholz** | `english` | severity=high | category=gloss
  current: "Congreve match/lighting stick/match"
  correct: "match"
  why: B1 everyday word buried behind a 19th-century term and the non-word "lighting stick".

- **Umweltzerstörung** | `english` | severity=high | category=gloss
  current: "ecocide"
  correct: "environmental destruction/environmental damage"
  why: B1 transparent compound glossed only with a rare legal-activist term; the plain sense is absent.

- **Dehnung** | `english` | severity=high | category=gloss
  current: "dilatation/dilation/distension"
  correct: "stretching/extension" (also vowel lengthening)
  why: Core everyday sense (stretching, as in warm-up) missing entirely; also two spellings of the same word.

- **Kotflügel** | `english` | severity=medium | category=gloss
  current: "fender/mud guard/mud wing"
  correct: "wing/mudguard"
  why: US "fender" leads and "mud wing" is not English.

- **Rohstoffpreis** | `english` | severity=medium | category=gloss
  current: "commodity price/price/raw materials"
  correct: "commodity price/raw-material price"
  why: Morpheme-mangled — the last two "senses" are fragments of the compound.

- **Physiotherapeutin** | `english` | severity=medium | category=gloss
  current: "therapist"
  correct: "physiotherapist (female)"
  why: A1 entry loses the *Physio-* element entirely.

- **Nebenfluss** | `english` | severity=medium | category=gloss
  current: "affluent/tributary"
  correct: "tributary"
  why: "affluent" as a noun is archaic and reads as the adjective.

- **Resignation** | `english` | severity=medium | category=gloss
  current: "resignation"
  correct: "resignation (despondency)/giving up"
  why: False friend — German *Resignation* never means quitting a job (*Kündigung/Rücktritt*).

- **Schwachsinn** | `english` | severity=medium | category=gloss
  current: "folly/mental deficiency/nonsense"
  correct: "nonsense/rubbish"
  why: "mental deficiency" is an offensive obsolete clinical term; the everyday sense is last.

- **Waisenhaus** | `english` | severity=medium | category=gloss
  current: "orphanage/orphanry"
  correct: "orphanage"
  why: "orphanry" is not an English word.

- **Gießkanne** | `english` | severity=medium | category=gloss
  current: "ewer/watering can/watering pot"
  correct: "watering can"
  why: "ewer" is a jug, a different object, and it leads.

- **Druckwerk** | `english` | severity=medium | category=gloss
  current: "printing unit"
  correct: "printed work/publication"
  why: The common sense (a printed publication) is missing; only the press-machine sense given.

- **Bücherbus** | `english` | severity=medium | category=gloss
  current: "bookmobile"
  correct: "mobile library"
  why: US-only term with no British form offered.

- **Landesdurchschnitt** | `english` | severity=medium | category=gloss
  current: "national average"
  correct: "state average (average for the Land)"
  why: *Land* is a federal state; "national" is *Bundes-*. uncertain: yes

- **Hochebene** | `english` | severity=low | category=gloss
  current: "mesa/plateau/tableland"
  correct: "plateau"
  why: A specific American landform leads.

- **Lieferschein** | `english` | severity=low | category=gloss
  current: "bordereau/delivery note/docket"
  correct: "delivery note"
  why: Obscure French commercial term first.

- **Konfitüre** | `english` | severity=low | category=gloss
  current: "confiture/jam"
  correct: "jam"
  why: "confiture" is not ordinary English and leads.

- **Belletristik** | `english` | severity=low | category=gloss
  current: "belletristic literature/fiction"
  correct: "fiction/literary fiction"
  why: "belletristic" is obscure and leads.

- **Kämmerer** | `english` | severity=low | category=gloss
  current: "chamberlain/treasurer"
  correct: "treasurer (local authority)"
  why: Historical sense leads; the modern municipal sense is what learners meet.

- **Pudding** | `english`,`plural` | severity=low | category=gloss
  current: Puddinge / "blancmange/pudding"
  correct: Puddings / "blancmange-style dessert, pudding"
  why: "blancmange" leads at B1; *Puddings* is the usual plural.

- **Demut** | `english` | severity=low | category=gloss
  current: "humbleness/humility/lowliness"
  correct: "humility"
  why: The natural English word is second.

- **Pfütze** | `english` | severity=low | category=gloss
  current: "pool/puddle"
  correct: "puddle"
  why: "pool" misleads.

- **Ortung** | `english` | severity=low | category=gloss
  current: "localisation"
  correct: "locating/positioning/detection"
  why: "localisation" in English means adapting for a locale.

- **Stellwand** | `english` | severity=low | category=gloss
  current: "folding screen"
  correct: "partition/display panel"
  why: A folding screen is a *Wandschirm/Paravent*. uncertain: yes

- **Springer** | `english` | severity=low | category=gloss
  current: "jumper/knight/spare"
  correct: "knight (chess)/stand-in, floater (worker)"
  why: British "jumper" reads as a pullover; "spare" is unclear.

- **Nordlicht** | `english` | severity=low | category=gloss
  current: "northern light"
  correct: "northern lights/aurora borealis"
  why: The phenomenon is plural in English.

- **Mordserie** | `english` | severity=low | category=gloss
  current: "murder series"
  correct: "series of murders/killing spree"
  why: Literal calque.

- **Jahresrückblick** | `english` | severity=low | category=gloss
  current: "review of the year's event/year in review"
  correct: "review of the year's events/year in review"
  why: Typo — singular "event".

- **Jalousie** | `english` | severity=low | category=gloss
  current: "Venetian blinds/jalousie/window blind"
  correct: "Venetian blind"
  why: Plural head for a singular lemma; "jalousie" is not current English.

- **Kaltmiete** | `english` | severity=low | category=gloss
  current: "bare rent/base rent/basic rent"
  correct: "rent excluding bills/basic rent"
  why: Three near-identical non-idiomatic renderings, none explanatory.

- **Länderebene** | `english` | severity=low | category=gloss
  current: "state level/country level"
  correct: "state level (Bundesland level)"
  why: "country level" contradicts the first sense.

- **Religionspädagogik** | `english` | severity=low | category=gloss
  current: "religious pedagogics/religious pedagogy"
  correct: "religious education (as a discipline)"
  why: "pedagogics" is not idiomatic and leads.

- **Radwanderweg** | `english` | severity=low | category=gloss
  current: "bicycle trail"
  correct: "cycle route/cycle path"
  why: US register; British learners say cycle route.

- **Fernwanderweg** | `english` | severity=low | category=gloss
  current: "distance hiking trail"
  correct: "long-distance footpath/long-distance hiking trail"
  why: "long-" dropped, leaving a non-phrase.

- **Elternsprechtag** | `english` | severity=low | category=gloss
  current: "parent-teacher conference day"
  correct: "parents' evening/parent-teacher meeting"
  why: US school register.

- **Einzelspieler** | `english` | severity=low | category=gloss
  current: "singleplayer"
  correct: "single player/solo player"
  why: Not an English noun as one word.

- **Absteiger** | `english` | severity=low | category=gloss
  current: "demoted man/relegated athlete/relegated team"
  correct: "relegated team/relegated player"
  why: "demoted man" is not English usage and leads.

- **Bauherrin** | `english` | severity=low | category=gloss
  current: "client/constructor/owner"
  correct: "client, property developer (female)"
  why: "constructor" is the builder, i.e. the opposite party.

- **Baugrund** | `english` | severity=low | category=gloss
  current: "building ground"
  correct: "building land/subsoil"
  why: Calque.

- **Kormoran** | `english` | severity=low | category=gloss
  current: "Great Cormorant/cormorant"
  correct: "cormorant"
  why: Capitalised species name duplicates the plain word.

- **Uhu** | `english` | severity=low | category=gloss
  current: "eagle-owl/glue"
  correct: "eagle owl"
  why: "glue" is the trademark *UHU*, not the common noun.

- **Wasserspiegel** | `english` | severity=low | category=gloss
  current: "water surface"
  correct: "water level"
  why: The usual sense is the level, not the surface.

- **Selbstmedikation** | `english` | severity=low | category=gloss
  current: "self medication"
  correct: "self-medication"
  why: Missing hyphen.

- **Arzttermin** | `english` | severity=low | category=gloss
  current: "doctor’s appointment" (curly apostrophe U+2019)
  correct: "doctor's appointment"
  why: Only entry in the batch using a typographic apostrophe; inconsistent with the rest of the data.

- **Influencerin / Lektorin / Projektmanagerin / Finanzministerin / Sopranistin** | `english` | severity=low | category=gloss
  current: glossed with no "(female)" marker
  correct: add "(female)", as `Herausgeberin`, `Kunsthistorikerin`, `Asylbewerberin`, `Zeitzeugin` and `Fußgängerin` do
  why: Inconsistent treatment of feminine agent nouns within the same batch.

### British-English violations (grouped)

- **US spelling / US term, grouped** | `english` | severity=low | category=gloss
  current: `Kinobesucher` "moviegoer"; `Marienkäfer` "ladybug"; `Scheibenwischer` "windshield wiper"; `Frontscheibe` "windshield" first; `Prolog` "prolog"; `Tagesprogramm` "daily program"; `Textverarbeitungsprogramm` "word processing program"; `Verfallsdatum` "expiration date" first; `Erholungsurlaub` "vacation leave"; `Frontalunterricht` "teacher-centered"; `Grauton` "gray tone" first; `Fettstoffwechselstörung` "dyslipidemia"; `Bettler` "panhandler"; `Glätteisen` "flat iron"; `Unkostenbeitrag` "toward"; `Trockenbau` "drywall"; `Reiserücktrittsversicherung` "trip cancellation"
  correct: single British form only — filmgoer, ladybird, windscreen wiper, windscreen, prologue, programme, expiry date, annual leave, teacher-centred, grey, dyslipidaemia, beggar, hair straightener, towards, plasterboard/dry-lining, travel cancellation
  why: British-English app; US spellings and US-first ordering throughout.

- **Both spellings in one gloss, grouped** | `english` | severity=low | category=gloss
  current: `Kichererbse` "chick-pea/chickpea"; `Tipi` "teepee/tepee/tipi"; `Vlies` "non-woven fabric/nonwoven"; `Vollpension` "full board/full-board"; `Fladenbrot` "flat bread/flatbread"; `Klavierkonzert` "piano concert/piano concerto"
  correct: one form each — chickpea, tepee, non-woven fabric, full board, flatbread, piano concerto
  why: House rule forbids listing two spellings of the same word.

## Clean

586 entries had no issues worth reporting. (114 entries flagged across 82 bullets — five bullets
group multiple entries: nominalised infinitives ×7, feminine markers ×5, US spellings ×17,
dual-spelling glosses ×6, decade nouns ×2.)

---
Entries reviewed: **700** (all rows, ranks 12779–13479 in file order, including the interleaved low-rank rows 904–8774).
