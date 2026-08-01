# nouns_010  (reviewed 700 entries, ranks 854–6848)

## Errors

### Articles

- **Masern** | `article`/`plural` | severity=high | category=article
  current: `das Masern` / pl `Masern` / "measles"
  correct: `die Masern` (plurale tantum, no singular)
  why: measles is a plural-only noun in German; `das Masern` is not a word.

- **Mosaik** | `article`/`plural` | severity=high | category=article
  current: `die Mosaik` / `Mosaiken`
  correct: `das Mosaik` / `Mosaike`
  why: neuter, and the plural is Mosaike; both fields are wrong.

- **Graffito** | `article` | severity=high | category=article
  current: `der Graffito` / `Graffiti`
  correct: `das Graffito` / `Graffiti` (or lemmatise as `das Graffiti`)
  why: Duden gives neuter; masculine is not attested.

- **Item** | `article` | severity=medium | category=article
  current: `der Item`
  correct: `das Item`
  why: the English loan is neuter in German (psychometrics/test item).

- **Jura** | `article`/`gloss` | severity=medium | category=article
  current: `der Jura` / `—` / "law"
  correct: `Jura` (no article; used article-less: *Jura studieren*) — `der Jura` means the Jura mountains/geological period
  why: as taught, the learner will say "der Jura" for the university subject, which is wrong.

- **Alien** | `article` | severity=low | category=article
  current: `der Alien`
  correct: `das Alien` (Duden main form; *der* only secondary)
  uncertain: yes

- **Review** | `article` | severity=low | category=article
  current: `der Review`
  correct: `das Review`
  uncertain: yes

### Plurals

- **Etikett** | `plural` | severity=high | category=plural
  current: `Etikette`
  correct: `Etiketten` (also `Etiketts`)
  why: *die Etikette* is a different word ("etiquette"); this teaches a false plural and a homograph clash.

- **Regenbogen** | `plural` | severity=high | category=plural
  current: `Regenbogen`
  correct: `Regenbögen`
  why: -bogen compounds umlaut in the plural.

- **Taxis** | `word`/`plural` | severity=high | category=junk
  current: `die Taxis` / `Taxien` / "taxis"
  correct: delete — the lemma is `das Taxi` / `Taxis`
  why: corpus artefact: the plural of *Taxi* has been lemmatised as a headword and then given the biology term's plural (*Taxien*).

- **Dinosaurus** | `word` | severity=high | category=junk
  current: `der Dinosaurus` / `Dinosaurier`
  correct: `der Dinosaurier` / `Dinosaurier`
  why: headword is a rare Latinism; the singular that matches the given plural is *Dinosaurier*.

- **Pech** | `plural` | severity=medium | category=plural
  current: `Peche`
  correct: `—`
  why: in the A1 sense "bad luck" it is uncountable; *Peche* only exists as a technical plural of the "pitch/tar" sense.

- **Invented plurals on mass/abstract nouns** | `plural` | severity=medium | category=plural
  current: `Wasserverbräuche`, `Güterverkehre`, `Stadtverkehre`, `Sportunterrichte`, `Verfälle`, `Unterwäschen`, `Klimapolitiken`, `Sozialismen`, `Freewares`, `Mobiliare`, `Fachpublika`, `Akustiken`, `Mauerwerke`, `Luftdrücke`, `Wohnungssuchen`, `Unkenntnisse`, `Bildungswesen`, `Kohleausstiege`, `Klassenerhalte`, `Willkommenskulturen`, `Einzigartigkeiten`, `Versorgungssicherheiten`, `Zeitgeschichten`, `Anwendbarkeiten`, `Fremdenfeindlichkeiten`, `Arbeitsaufwände`, `Aufzuchten`, `Foltern`
  correct: `—` for all
  why: these are mass or abstract nouns; the plurals are either non-occurring or so marginal that offering them misleads.

- **Wikipedia** | `word`/`plural` | severity=medium | category=junk
  current: `die Wikipedia` / `Wikipedien`
  correct: drop the entry (proper noun); plural does not exist
  why: brand name with a fabricated plural.

- **Alster** | `word`/`plural` | severity=medium | category=junk
  current: `die Alster` / `Alstern`
  correct: drop (proper noun — river/lake in Hamburg)
  why: place name with an invented plural; no learner value.

- **Folkwang** | `word` | severity=medium | category=junk
  current: `das Folkwang` / "Folkwang (university/museum name)"
  correct: drop
  why: proper noun, not a dictionary entry.

- **Ubuntu** | `word` | severity=medium | category=junk
  current: `das Ubuntu`
  correct: drop
  why: product/proper noun.

- **Feuerwehrmann** | `plural` | severity=low | category=plural
  current: `Feuerwehrmänner`
  correct: `Feuerwehrleute` (or list both)
  uncertain: yes — both are attested, but *Feuerwehrleute* is the usual modern plural and the one the learner should produce.

- **Komma** | `plural` | severity=low | category=plural
  current: `Kommata`
  correct: `Kommas` (Duden main form; *Kommata* is the rarer variant)

### Adjectival nouns — wrong citation plural

- **Landtagsabgeordnete, Liberale, Bundesvorsitzende, Suchende, Verbündete, Gehörlose, Prostituierte, Geliebte** | `plural` | severity=high | category=plural
  current: `Landtagsabgeordneten`, `Liberalen`, `Bundesvorsitzenden`, `Suchenden`, `Verbündeten`, `Gehörlosen`, `Prostituierten`, `Geliebten`
  correct: bare citation plural — `Landtagsabgeordnete`, `Liberale`, `Bundesvorsitzende`, `Suchende`, `Verbündete`, `Gehörlose`, `Prostituierte`, `Geliebte`
  why: every `adjNoun` in this batch carries the weak/definite-article form instead of the citation form; the learner will produce "*viele Verbündeten*".

- **Erneuerbare** | `word`/`flags` | severity=medium | category=junk
  current: `die Erneuerbare` / `Erneuerbare` / "renewable energy", no `adjNoun` flag
  correct: lemmatise as plural `die Erneuerbaren` ("renewables") and flag `adjNoun`
  why: the singular *die Erneuerbare* is not used; the term is a plural ellipsis of *erneuerbare Energien*.

### Glosses — primary sense lost or wrong

- **Marine** | `english` | severity=high | category=gloss
  current: `marine/navy`
  correct: `navy`
  why: *die Marine* is the navy; "marine" (a soldier) is a false friend and is listed first.

- **Scham** | `english` | severity=high | category=gloss
  current: `genitals/shame`
  correct: `shame/embarrassment`
  why: the everyday abstract sense is buried under the anatomical euphemism.

- **Kran** | `english` | severity=high | category=gloss
  current: `carrier/crane/faucet`
  correct: `crane`
  why: "carrier" is wrong, "faucet" is an American gloss of a regional tap sense; the core meaning is third.

- **Locke** | `english` | severity=high | category=gloss
  current: `attack piece/curl/lock`
  correct: `curl/lock (of hair)`
  why: "attack piece" is nonsense; the hair sense should lead.

- **Offenbarung** | `english` | severity=medium | category=gloss
  current: `Apocalypse/Revelation/Revelations`
  correct: `revelation/disclosure` (Bible book only as a secondary sense)
  why: the everyday sense "a revelation, a disclosure" is missing entirely.

- **Textur** | `english` | severity=medium | category=gloss
  current: `textualis/textura/texture`
  correct: `texture`
  why: two palaeography terms precede the only sense a learner needs.

- **Endung** | `english` | severity=medium | category=gloss
  current: `desinence/ending`
  correct: `ending (grammatical); suffix`
  why: A1-ranked word led by an obscure linguistics term.

- **Zehe** | `english` | severity=medium | category=gloss
  current: `clove of garlic/toe`
  correct: `toe; clove (of garlic)`
  why: body-part sense is the everyday one and comes second.

- **Klippe** | `english` | severity=medium | category=gloss
  current: `(coastal) rock/bar/cliff`
  correct: `cliff/crag; (figurative) hurdle`
  why: primary sense last, "bar" misleading.

- **Schwalbe** | `english` | severity=medium | category=gloss
  current: `dive/martin/swallow`
  correct: `swallow (bird); (football) dive`
  why: the bird is the primary sense; the football sense leads.

- **Sehne** | `english` | severity=medium | category=gloss
  current: `chord/sinew/tendon`
  correct: `tendon/sinew; (geometry) chord`
  why: geometry term first.

- **Bude** | `english` | severity=medium | category=gloss
  current: `shack`
  correct: `stall/booth/kiosk; (colloquial) digs/place`
  why: both live senses (market stall; someone's room/flat) are missing.

- **Schuppen** | `english` | severity=medium | category=gloss
  current: `joint/shack/shed`
  correct: `shed`
  why: slang sense leads the standard one.

- **Insider** | `english` | severity=medium | category=gloss
  current: `in-joke/inside joke/insider`
  correct: `insider`
  why: "in-joke" is not what German *Insider* means and is listed twice.

- **Karikatur** | `english` | severity=medium | category=gloss
  current: `burlesque/caricature/cartoon`
  correct: `caricature/cartoon`
  why: "burlesque" is wrong and leads.

- **Anzahlung** | `english` | severity=medium | category=gloss
  current: `binder/deposit/down payment`
  correct: `deposit/down payment`
  why: "binder" is US insurance jargon in first position.

- **Apothekerin** | `english` | severity=medium | category=gloss
  current: `druggist/pharmacist`
  correct: `pharmacist/chemist (female)`
  why: American and dated term first; British "chemist" absent.

- **Lektor** | `english` | severity=medium | category=gloss
  current: `lector/lecturer/literary editor`
  correct: `(publisher's) editor; language assistant/lecturer`
  why: "lector" is not current English; "lecturer" without qualification is misleading.

- **Synonym** | `english` | severity=medium | category=gloss
  current: `convertible terms/equivalent terms/synonym`
  correct: `synonym`
  why: two invented paraphrases precede the obvious cognate.

- **Delfin** | `english` | severity=medium | category=gloss
  current: `Delphinus/butterfly stroke/dolphin`
  correct: `dolphin; (swimming) butterfly`
  why: Latin genus name first, animal last.

- **Mist** | `english` | severity=medium | category=gloss
  current: `dung/manure/rubbish`
  correct: `rubbish/nonsense; (Mist!) damn!; (farming) dung/manure`
  why: A1-ranked word — the everyday exclamation/"rubbish" sense is buried behind the farmyard sense.

- **Endeffekt** | `english` | severity=medium | category=gloss
  current: `end effect`
  correct: `upshot/net result; (im Endeffekt) ultimately, in the end`
  why: "end effect" is a literal mistranslation; the word is almost only used in the fixed phrase.

- **Freisetzung** | `english` | severity=medium | category=gloss
  current: `layoff/liberation/release`
  correct: `release (of substances/energy); (euphemism) redundancy`
  why: American HR euphemism leads; the chemical/physical sense is the common one.

- **Polizistin** | `english` | severity=medium | category=gloss
  current: `bobby/constable/police constable`
  correct: `police officer (female)/policewoman`
  why: A1 word glossed with male-coded slang and a rank title.

- **Backware** | `english` | severity=medium | category=gloss
  current: `pastries`
  correct: `baked goods` (usually plural *Backwaren*)
  why: too narrow — bread and rolls are Backwaren but not pastries.

- **Zivilcourage** | `english` | severity=medium | category=gloss
  current: `civil courage`
  correct: `moral courage / courage of one's convictions`
  why: "civil courage" is a calque, not idiomatic English.

- **Elternabend** | `english` | severity=medium | category=gloss
  current: `parent-teacher conference`
  correct: `parents' evening`
  why: American term in a British-English bank; the British equivalent is absent.

- **Insolvenzverwalter** | `english` | severity=medium | category=gloss
  current: `liquidator/receiver/trustee in banktruptcy`
  correct: `insolvency administrator/trustee in bankruptcy`
  why: misspelling "banktruptcy".

- **Fruchtfleisch** | `english` | severity=low | category=gloss
  current: `flesh/pod/pulp`
  correct: `flesh/pulp (of fruit)`
  why: "pod" is wrong.

- **Geselle** | `english` | severity=low | category=gloss
  current: `companion/journeyman`
  correct: `journeyman; (dated) fellow`
  why: archaic sense first; the trade sense is the live one.

- **Schärfe** | `english` | severity=low | category=gloss
  current: `sharpness/strictness`
  correct: add `spiciness/heat (of food)`
  why: everyday food sense missing.

- **Winde** | `english` | severity=low | category=gloss
  current: `bindweed/winch`
  correct: `winch; (plant) bindweed`

- **Skala** | `english` | severity=low | category=gloss
  current: `gamut/scale`
  correct: `scale`

- **Loser** | `english` | severity=low | category=gloss
  current: `blockhead/idiot/loser`
  correct: `loser`

- **Schädel** | `english` | severity=low | category=gloss
  current: `cranium/skull`
  correct: `skull`

- **Comic** | `english` | severity=low | category=gloss
  current: `cartoon/comic`
  correct: `comic/comic strip`
  why: A1 word; "cartoon" (animation) is the wrong first sense.

- **Testspiel** | `english` | severity=low | category=gloss
  current: `friendly match/test match`
  correct: `friendly (match)`
  why: "test match" is cricket/rugby-specific and misleading.

- **Junk sub-glosses** | `english` | severity=low | category=gloss
  current: `Vene` "vena", `Trophäe` "tropæum", `Marmelade` "snarl-up", `Abenteurer` "carpetbagger", `Aktenzeichen` "record token", `Verminderung` "decreation", `Bauchschmerz` "abdominalgia", `Brennweite` "focal width", `Arbeitsfläche` "worksurface", `Festigkeit` "decidedness", `Epilepsie` "grand mal", `Fee` "fay/pixie", `Beitritt` "adhesion", `Ausfertigung` "engrossment", `Zink` "zinc/zinc (metal)", `Bulle` "cop/copper/cop (slang)"
  correct: delete these sub-senses
  why: non-words, Latin tags, duplicated entries or nonsense translations padding the gloss list.

### American spellings / US-before-British ordering

- **US term placed before the British one** | `english` | severity=medium | category=gloss
  current: `Windel` "diaper/nappy", `Einkaufswagen` "shopping cart/shopping trolley", `Mülleimer` "garbage can/rubbish bin/trash can", `Bahnstrecke` "railroad track/railway track", `Sommerzeit` "daylight saving time/summer time", `Bildungsministerium` "Department of Education/…", `Gesundheitsminister` "…/secretary of health", `Immobilienpreis` "real estate price", `Frauenhaus` "women's shelter"
  correct: British form first and alone — nappy; shopping trolley; rubbish bin; railway track; summer time; Ministry of Education; minister of health; property price; women's refuge
  why: brief requires one British form only.

- **US spellings and UK/US doublets in one gloss** | `english` | severity=low | category=gloss
  current: `Ratenkredit` "instalment/installment", `Urlaubsziel` "holiday/vacation destination", `Investitionsprogramm` "programme/program", `Schulprogramm` "programme/program", `Ausrufezeichen` "exclamation mark/exclamation point", `Sternsinger` "caroler/caroller", `Wendepunkt` "inflection/inflexion point", `Katalysator` "catalyzer", `Fachunterricht` "specialized", `Elan` "vigor", `Automobil` "auto/automobile/car", `Fünftklässler`/`Viertklässler` "fifth-/fourth-grader"
  correct: single British form (instalment, holiday destination, programme, exclamation mark, caroller, turning point, catalytic converter, specialised, vigour, car, Year 5/Year 6 pupil)
  why: one form only, British.

### Corpus junk / non-entries

- **Nominalised infinitives as headwords** | `word` | severity=low | category=junk
  current: `das Streben`, `das Verschwinden`, `das Sein`, `das Kriegen`, `das Vergessen`, `das Zeichnen`, `das Atmen`, `das Ausschalten`, `das Genießen`, `das Beten`, `das Entfernen`
  correct: drop, or keep only the fully lexicalised ones (`das Streben`, `das Sein`)
  why: mechanical nominalisations; `das Kriegen` ("getting") in particular is not a dictionary word.

- **Spass** | `word` | severity=medium | category=junk
  current: `der Spass` / `Spässe` / "fun (Swiss spelling of Spaß)"
  correct: drop — duplicate of `der Spaß` / `Späße`
  why: an orthographic variant lemma competing with the live headword.

- **Drehe** | `word` | severity=medium | category=junk
  current: `die Drehe` / `—` / "turn/spin (colloquial)"
  correct: drop
  why: not a standard lemma; dialectal at best.

- **Eigen** | `word` | severity=medium | category=junk
  current: `das Eigen` / `—` / "one's own/the self"
  correct: drop
  why: only occurs in the fossilised phrase *sein Eigen nennen*; unusable as a vocabulary item.

### CEFR

- **Gross CEFR mismatches** | `cefr` | severity=low | category=cefr
  current: `Mülleimer` C1, `Clown` C1, `Heu` C1, `Schluck` C1, `Bude` C1, `Bevölkerungszahl` C1
  correct: roughly A2–B1 for Mülleimer, Clown, Heu, Schluck
  why: everyday concrete nouns tagged at the top of the scale.

### Minor

- **Feminine agent nouns without a gender marker** | `english` | severity=low | category=gloss
  current: `Arbeiterin` "labourer/worker", `Arbeitgeberin` "employer", `Apothekerin` "druggist/pharmacist", `Umweltministerin` "environment minister", `Ingenieurin` "engineer", `Chefin` "boss/manager", `Vizepräsidentin` "vice president", `Senatorin` "senator (female)" [ok], `Stellvertreterin` "deputy"
  correct: add "(female)" consistently, as `Designerin`, `Mitschülerin` and `Trägerin` already do
  why: inconsistent within the batch; the -in forms are gender-specific.

- **Supervision** | `english` | severity=low | category=gloss
  current: `supervision`
  correct: `(professional/clinical) supervision`
  why: German *Supervision* is the coaching/case-review sense; general supervision is *Aufsicht*.

## Clean

612 entries had no issues worth reporting.

**Entries reviewed: 700 (all rows of nouns_010.tsv, ranks 854–6848).**
