# nouns_036  (reviewed 700 entries, ranks 932–24114)

## Errors

### Systematic generation bugs (highest impact)

- **Truncated umlaut plurals (18 entries)** | `plural` | severity=high | category=plural
  current: `Arbeitsvertäg`, `Handyverträg`, `Bildungsabschlüss`, `Lebensverläuf`, `Nachwuchskräft`, `Lebenskünst`, `Onlineeinkäuf`, `Rechnungsbeträg`, `Interneteinkäuf`, `Bestellvorgäng`, `Terminvorschläg`, `Palmenhäus`, `Textzusammenhäng`, `Glaseinsätz`, `Schuhabdrück`, `Umsteigebahnhöf`, `Forumsbeiträg`, `Gutenachtküss`
  correct: add the missing `-e`/`-er` ending — `Arbeitsverträge`, `Handyverträge`, `Bildungsabschlüsse`, `Lebensverläufe`, `Nachwuchskräfte`, `Onlineeinkäufe`, `Rechnungsbeträge`, `Interneteinkäufe`, `Bestellvorgänge`, `Terminvorschläge`, `Palmenhäuser`, `Textzusammenhänge`, `Glaseinsätze`, `Schuhabdrücke`, `Umsteigebahnhöfe`, `Forumsbeiträge`, `Gutenachtküsse` (`Lebenskunst` is a mass noun → `—`)
  why: plural field was umlauted but the suffix was dropped — every one is a non-word.

- **Doubled-stem plurals (7 entries)** | `plural` | severity=high | category=plural
  current: `Migrationsdramadramen`, `Teilthemathemen`, `Wissenschaftszentrumzentren`, `Versandrisikorisiken`, `Kundenkontokonten`, `Marktforschungsfirmafirmen`, `Sportpensumpensen`
  correct: `Migrationsdramen`, `Teilthemen`, `Wissenschaftszentren`, `Versandrisiken`, `Kundenkonten`, `Marktforschungsfirmen`, `Sportpensen`
  why: the plural rule was appended to the full singular instead of replacing the head's ending.

- **Hyphen-stripped duplicate headwords (4 entries)** | `word` | severity=high | category=junk
  current: `das AspergerSyndrom`, `das Preis-LeistungsVerhältnis` (pl. `Preis-LeistungsVerhältnisse`), `das Pro-KopfEinkommen`, `die Work-LifeBalance`
  correct: delete — correctly hyphenated entries already exist in this same batch (ranks 24100, 24109, 24113, 24114)
  why: mangled spellings of words that are duplicated verbatim; a learner would be taught an impossible orthography.

- **Adjectival nouns given the weak `-en` plural and no `adjNoun` flag (13 entries)** | `plural`/`flags` | severity=medium | category=plural
  current: `Einheimische→Einheimischen`, `Studierende→Studierenden`, `Konsumierende→Konsumierenden`, `Gleichgesinnte→Gleichgesinnten`, `Serviceangestellte→Serviceangestellten`, `Zugewanderte→Zugewanderten`, `Gebildete→Gebildeten`, `Gealterte→Gealterten`, `Pubertierende→Pubertierenden`, `Kritisierte→Kritisierten`, `Klassenbeste→Klassenbesten`; plus `das Außergewöhnliche` and `das Faschierte` with no flag
  correct: bare citation plural (`Einheimische`, `Studierende`, …) and `adjNoun` in `flags`
  why: `-en` is the weak/definite form, not the citation plural.

- **Plural forms entered as singular lemmas (11 entries)** | `word` | severity=medium | category=junk
  current: `die Werte`, `die Wohnungen`, `die Getränke`, `die Steuern`, `die Hinweise`, `die Senioren`, `die Erziehungsfragen`, `die Zutaten`, `die Papiere`, `die Zinsen`, `die Fachleute` — all tagged `pluraleTantum`
  correct: lemmatise as `der Wert`, `die Wohnung`, `das Getränk`, `die Steuer`, `der Hinweis`, `der Senior`, `die Erziehungsfrage`, `die Zutat`, `das Papier`, `der Zins`, `der Fachmann/die Fachfrau`
  why: none is a genuine plurale tantum; `die Wohnungen` and `die Werte` are especially plainly the plural of a live singular. (`Zutaten`, `Zinsen`, `Papiere`, `Fachleute` are idiomatically plural — lower priority.)

### Individual entries

- **Angestellter** | `word`/`plural` | severity=high | category=junk
  current: `der Angestellter / Angestellten`
  correct: `der Angestellte / Angestellte`
  why: `Angestellter` is the *indefinite* (strong) form and never follows `der`; citation form is wrong.

- **Auszubildender** | `word`/`plural` | severity=high | category=junk
  current: `der Auszubildender / Auszubildenden`
  correct: `der Auszubildende / Auszubildende`
  why: same strong-form error after the definite article.

- **Road** | `word` | severity=high | category=junk
  current: `der Road / Road / "road"`
  correct: delete
  why: English lexeme scraped as a German headword (cf. `das Food`).

- **Arbeitsvertag** | `word` | severity=high | category=junk
  current: `der Arbeitsvertag`
  correct: `der Arbeitsvertrag`
  why: headword itself is misspelt (missing `r`), not just the plural.

- **Kindesbein** | `english` | severity=medium | category=gloss
  current: "child's leg"
  correct: "(only in *von Kindesbeinen an* = from an early age / since childhood)"
  why: literal morpheme gloss; the word does not exist outside the idiom.

- **Stadtpräsident** | `english` | severity=medium | category=gloss
  current: "city president (Switzerland)"
  correct: "mayor (Switzerland)"
  why: calque; "city president" is not an English office.

- **Ammann** | `english` | severity=medium | category=gloss
  current: "Ammann (Swiss official)"
  correct: "municipal magistrate / head of a Swiss commune"
  why: gloss leaks the German lemma and gives no translation.

- **EDV** | `english` | severity=medium | category=gloss
  current: "EDP"
  correct: "IT / electronic data processing"
  why: "EDP" is opaque and effectively obsolete in British usage.

- **Virenschutzprogramm** | `english` | severity=medium | category=gloss
  current: "virus protection programme"
  correct: "antivirus program"
  why: British English keeps the spelling *program* for computer software; *programme* is wrong here.

- **Kritisierte** | `english` | severity=medium | category=gloss
  current: "criticized person"
  correct: "criticised person" (better: "the person being criticised")
  why: American `-ize` spelling.

- **Präsentationssoftware** | `plural` | severity=medium | category=plural
  current: `Präsentationssoftwares`
  correct: `—`
  why: *Software* is a mass noun in German; `Softwares` is a known invented plural.

- **Teamarbeit** | `plural` | severity=medium | category=plural
  current: `Teamarbeiten`
  correct: `—`
  why: mass noun.

- **Öffentlichkeitsarbeit** | `plural` | severity=medium | category=plural
  current: `Öffentlichkeitsarbeiten`
  correct: `—`
  why: mass noun (PR work).

- **Selbstbeherrschung** | `plural` | severity=medium | category=plural
  current: `Selbstbeherrschungen`
  correct: `—`
  why: abstract mass noun.

- **Groll** | `plural` | severity=medium | category=plural
  current: `Grolle`
  correct: `—`
  why: abstract mass noun; `Grolle` is not a word.

- **Biobaumwolltasche** | `plural` | severity=medium | category=plural
  current: `Biobaumwolltasche`
  correct: `Biobaumwolltaschen`
  why: plural identical to singular for an `-e` feminine.

- **IT-Bereich** | `plural` | severity=medium | category=plural
  current: `IT-Bereich`
  correct: `IT-Bereiche`
  why: plural identical to singular.

- **Missfallen** | `cefr` | severity=medium | category=cefr
  current: `A1`
  correct: `B2`/`C1`
  why: abstract literary noun tagged as absolute-beginner vocabulary.

- **Forumsbeitrag** | `cefr` | severity=medium | category=cefr
  current: `A1` (with truncated plural, above)
  correct: `B1`/`B2`
  why: gross level mismatch against its rank (8141) and neighbours.

- **Nominalised infinitives as headwords (5 entries)** | `word` | severity=medium | category=junk
  current: `das Verstecken`, `das Pulsieren`, `das Achterbahnfahren`, `das Aussortieren`, `das Weggeben`, `das Türenknallen`
  correct: delete (or lemmatise the verb)
  why: productive nominalisations, not dictionary entries. (`Fallschirmspringen`, `Kickboxen`, `Kunstturnen`, `Freiklettern`, `Eisbaden`, `Tiefseetauchen`, `Rauchen` are lexicalised and fine.)

- **US term/spelling paired with or before the British one (6 entries)** | `english` | severity=low | category=gloss
  current: `Süßigkeiten` "sweets/candy"; `U-Bahn` "underground/subway"; `Gehsteig` "pavement/sidewalk"; `Briefträger` "mail carrier/postman"; `Fundsachen` "lost-and-found items"; `Zöpfchen` "braid"
  correct: "sweets"; "underground"; "pavement"; "postman"; "lost property"; "plait"
  why: British-English-only rule — one form, and never the US one first.

- **Capitalised English glosses (9 entries)** | `english` | severity=low | category=gloss
  current: `Persönlichkeitstraining` "Personality training", `Familiengründung` "Starting a family", `Kindergartenalter` "Kindergarten age", `Pazifismus` "Pacifism", `Pessimismus` "Pessimism", `Liberalität` "Liberality", `Kreditkartenbetrug` "Credit card fraud", `Kundenkontakt` "Customer contact", `Internetmanagement` "Internet management"
  correct: lower-case initial
  why: German capitalisation carried into the English side.

- **Invented plurals on abstract/mass nouns (14 entries)** | `plural` | severity=low | category=plural
  current: `Urteilsfindungen`, `Vereinsamungen`, `Selbstoptimierungen`, `Eigeninitiativen`, `Diversitätsmanagements`, `Elternurlaube`, `Polarforschungen`, `Erwerbsarbeiten`, `Sozialforschungen`, `Lagerhaltungen`, `Teambildungen`, `Angebotserstellungen`, `Messecaterings`, `Kritikfähigkeiten`, `Tränenflüssigkeiten`, `Weltbanken`, `Kunstraube`, `Gemälderaube`, `Textaufbauten`, `Meerrettiche`
  correct: `—` in each case
  why: none of these forms is used; `Weltbank` is additionally a proper noun and `Aufbauten` belongs to a different sense (superstructure).

- **Schwammerl** | `plural` | severity=low | category=plural
  current: `Schwammerl`
  correct: `Schwammerln`
  why: Austrian/Bavarian `-erl` diminutives take `-n` in the plural.

- **Kfz** | `plural` | severity=low | category=plural
  current: `Kfzs`
  correct: `Kfz`
  why: the abbreviation is invariant.

- **Country and place names as headwords (11 entries)** | `word` | severity=low | category=junk
  current: `das Deutschland`, `das Österreich`, `das Luxemburg`, `das Europa`, `das Griechenland`, `das Finnland`, `das Mexiko`, `die Türkei`, `die Ukraine`, `die Schweiz`, `die Antarktis`, `die Donau`
  correct: keep only the article-taking ones (`die Türkei`, `die Ukraine`, `die Schweiz`, `die Antarktis`, `die Donau`), where the article is genuine information; drop the `das` on the others or mark them article-less
  why: neuter country names are normally used without an article, so `das Deutschland` teaches a pattern the learner will never produce.
  uncertain: yes

- **Feuilletonist** | `english` | severity=low | category=gloss
  current: "feuilletonist"
  correct: "arts-and-culture columnist"
  why: the English word is vanishingly rare; the gloss explains nothing.

- **Meisterschüler** | `english` | severity=low | category=gloss
  current: "master student"
  correct: "star pupil of a master (artist/musician)"
  why: reads as "Master's student", which it is not.

- **Impulsvortrag** | `english` | severity=low | category=gloss
  current: "keynote/impulse talk"
  correct: "short keynote / opening input talk"
  why: "impulse talk" is not English.

- **Langschläfer / Langschläferin** | `english` | severity=low | category=gloss
  current: "late sleeper"
  correct: "late riser"
  why: idiomatic English counterpart to *Frühaufsteher* "early riser".

- **Melange** | `english` | severity=low | category=gloss
  current: "mélange/mixture; Viennese coffee"
  correct: put the Viennese-coffee sense first
  why: in current German (esp. Austrian) usage the coffee is the everyday sense.

- **Bancomat** | `english` | severity=low | category=gloss
  current: "ATM (Swiss usage)"
  correct: "cash machine / cashpoint (Swiss)"
  why: ATM is the US term.

- **Automobilhersteller** | `english` | severity=low | category=gloss
  current: "automobile manufacturer"
  correct: "car manufacturer"
  why: "automobile" is US register.

- **Phantasie** | `word` | severity=low | category=junk
  current: `die Phantasie` glossed "(older spelling of Fantasie)"
  correct: drop in favour of `die Fantasie`
  why: archaic variant duplicating a live headword; the label mitigates but does not justify it.

- **Soziale Arbeit** | `word` | severity=low | category=junk
  current: `die Soziale Arbeit`
  correct: single-word lemma or move to a phrase list
  why: multi-word headword with an internal capital breaks the noun-card format.
  uncertain: yes

- **Missing `weak` flag (2 entries)** | `flags` | severity=low | category=junk
  current: `der Musiktherapeut / Musiktherapeuten`, `der Anti-Held / Anti-Helden` carry `-` while comparable weak nouns in the batch (`Telefonist`, `Ökologe`, `Essayist`) carry `weak`
  correct: add `weak`
  why: inconsistent declension marking.

## Clean

583 entries had no issues worth reporting.

**Entries reviewed: 700** (all rows of `batches/nouns_036.tsv`, ranks 932–24114).
