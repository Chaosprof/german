# nouns_038  (reviewed 86 entries, ranks 8574–25995)

## Errors

- **Fanseite** | `plural` | severity=high | category=plural
  current: Fanseite
  correct: Fanseiten
  why: plural field just repeats the singular; die Seite → die Seiten.

- **Klettergurt** | `plural` | severity=high | category=plural
  current: Klettergurt
  correct: Klettergurte
  why: der Gurt → die Gurte; singular copied into the plural field.

- **Wortfamilie** | `plural` | severity=high | category=plural
  current: Wortfamilie
  correct: Wortfamilien
  why: -ie noun takes -n; singular copied into the plural field.

- **Kitesurfen** | `word` | severity=low | category=junk
  current: das Kitesurfen "kitesurfing"
  correct: keep only if nominalised infinitives are wanted; otherwise drop
  why: nominalised infinitive of a corpus-junk shape (cf. `das Reisen`), though this one is a genuine sport name.
  uncertain: yes

- **Wagenburg** | `english` / `cefr` | severity=medium | category=gloss
  current: wagon fort/wagon laager — A2
  correct: circle of wagons/wagon fort — not A2
  why: "laager" is an obscure South-Africanism, and a historical/rare term should not sit at A2.

- **Lampion** | `english` | severity=low | category=gloss
  current: lantern
  correct: paper lantern/Chinese lantern
  why: bare "lantern" is `Laterne`; Lampion is specifically the decorative paper one.

- **Positionsverb** | `plural` | severity=high | category=plural
  current: Positionsverb
  correct: Positionsverben
  why: das Verb → die Verben; singular copied into the plural field.

- **Richtungsverb** | `plural` | severity=high | category=plural
  current: Richtungsverb
  correct: Richtungsverben
  why: das Verb → die Verben; singular copied into the plural field.

- **Satzakzent** | `plural` | severity=high | category=plural
  current: Satzakzent
  correct: Satzakzente
  why: der Akzent → die Akzente; singular copied into the plural field.

- **Mausi** | `english` / `plural` | severity=medium | category=gloss
  current: mouse — plural Mausi
  correct: sweetie/darling (term of endearment) — plural Mausis
  why: Mausi is a pet name, not the animal; glossing it "mouse" teaches the wrong word for *Maus*.

- **Hasilein** | `word` | severity=low | category=junk
  current: das Hasilein "little bunny"
  correct: drop, or fold into Hase/Häschen
  why: nonce double-diminutive, not a dictionary lemma.
  uncertain: yes

- **Tiergeschichte** | `plural` | severity=high | category=plural
  current: Tiergeschichte
  correct: Tiergeschichten
  why: die Geschichte → die Geschichten; singular copied into the plural field.

- **Textanfang** | `plural` | severity=high | category=plural
  current: Textanfang
  correct: Textanfänge
  why: der Anfang → die Anfänge (umlaut + -e); singular copied into the plural field.

- **Satzhälfte** | `plural` | severity=high | category=plural
  current: Satzhälfte
  correct: Satzhälften
  why: die Hälfte → die Hälften; singular copied into the plural field.

- **Arme** | `flags` | severity=medium | category=junk
  current: der Arme / plural Arme / no flag
  correct: mark `adjNoun` (der Arme, ein Armer, die Armen)
  why: adjectival noun presented as an ordinary noun; without the flag the app will decline it wrongly, and "Arme" also collides with the plural of *der Arm*.

- **Märchenschloss** | `plural` | severity=high | category=plural
  current: Märchenschloss
  correct: Märchenschlösser
  why: das Schloss → die Schlösser; singular copied into the plural field.

- **Synchronsprecher / Synchronsprecherin** | `english` | severity=low | category=gloss
  current: dubbing artist (both, no m/f marker)
  correct: voice actor (dubbing) / dubbing actor — add (m)/(f) as done elsewhere in the batch
  why: "dubbing artist" is not the usual British term, and the pair loses the gender marking used for the Reisebüro entries.

- **Festivalbesuch** | `plural` | severity=high | category=plural
  current: Festivalbesuch
  correct: Festivalbesuche
  why: der Besuch → die Besuche; singular copied into the plural field.

- **AGB** | `flags` / `word` | severity=medium | category=junk
  current: die AGB, plural AGB, no flag
  correct: mark `pluraleTantum` (die AGB, occasionally AGBs); expand as Allgemeine Geschäftsbedingungen
  why: it is an initialism of a plural noun phrase, not a countable singular; presented here as a normal singular noun.

- **Datenschutzbestimmung** | `english` | severity=low | category=gloss
  current: privacy policy
  correct: data-protection provision/regulation (plural *Datenschutzbestimmungen* = privacy policy)
  why: the singular is one clause; "privacy policy" as a document is *Datenschutzerklärung*.
  uncertain: yes

- **Firmenkunde** | `plural` / `flags` | severity=high | category=plural
  current: Firmenkunde, no `weak` flag
  correct: Firmenkunden, flag `weak`
  why: n-declension noun (der Kunde, den Kunden); the plural field repeats the singular.

- **Sofort-Überweisung** | `word` | severity=low | category=junk
  current: die Sofort-Überweisung
  correct: die Sofortüberweisung
  why: written solid in German; also effectively a payment-provider brand name.

- **Versandart** | `plural` | severity=high | category=plural
  current: Versandart
  correct: Versandarten
  why: die Art → die Arten; singular copied into the plural field.

- **Zahlungsart** | `plural` | severity=high | category=plural
  current: Zahlungsart
  correct: Zahlungsarten
  why: die Art → die Arten; singular copied into the plural field.

- **Zwischensumme** | `plural` | severity=high | category=plural
  current: Zwischensumme
  correct: Zwischensummen
  why: die Summe → die Summen; singular copied into the plural field.

- **Kunstexperte** | `flags` | severity=low | category=plural
  current: no `weak` flag (plural Kunstexperten is right)
  correct: flag `weak`
  why: n-declension noun; the batch flags Ethnologe but not this one, so oblique singular forms will be generated wrongly.

- **Radiosprecher / Radiosprecherin** | `english` | severity=low | category=gloss
  current: radio announcer
  correct: radio presenter/announcer
  why: "announcer" is the US-leaning term; British usage is "presenter".
  uncertain: yes

- **Tierbild** | `plural` | severity=high | category=plural
  current: Tierbild
  correct: Tierbilder
  why: das Bild → die Bilder; singular copied into the plural field.

- **Tiermalerei** | `plural` | severity=medium | category=plural
  current: Tiermalerei
  correct: — (mass/genre noun; *Tiermalereien* only for individual works)
  why: plural field repeats the singular and the noun is essentially uncountable as glossed.

- **Urlaubsgruß** | `plural` | severity=high | category=plural
  current: Urlaubsgruße
  correct: Urlaubsgrüße
  why: missing umlaut — der Gruß → die Grüße.

- **Urlaubstyp** | `english` | severity=medium | category=gloss
  current: type of vacationer/holiday type
  correct: type of holidaymaker/holiday type
  why: "vacationer" is American; this bank is British English.

- **Reisebüro-Mitarbeiter / -Mitarbeiterin** | `word` | severity=low | category=junk
  current: hyphenated Reisebüro-Mitarbeiter(in)
  correct: Reisebüromitarbeiter(in)
  why: no hyphen in standard German compounding here.
  uncertain: yes

- **Solarpanel** | `plural` | severity=medium | category=plural
  current: Solarpanele
  correct: Solarpanels (or lemma *das Solarpaneel* → Solarpaneele)
  why: hybrid form — the English loan *Panel* pluralises with -s; only the germanised *Paneel* takes -e.

- **Kasus** | `plural` | severity=medium | category=plural
  current: —
  correct: Kasus (unchanged, long -u:)
  why: a real plural exists (die Kasus); "—" wrongly marks it as uncountable.

- **Ehegattin** | `english` | severity=low | category=gloss
  current: wife
  correct: spouse (f)/wife (formal, legal register)
  why: Ehegattin is legal/formal register; plain "wife" is *Frau/Ehefrau* and hides the register difference.

- **Wortstamm** | `english` | severity=low | category=gloss
  current: stem
  correct: word stem/root
  why: bare "stem" is ambiguous out of a linguistics context.

- **Chemikerin** | `english` | severity=low | category=gloss
  current: chemist
  correct: chemist (scientist)
  why: in British English "chemist" first reads as pharmacist/pharmacy; the scientist sense needs marking.
  uncertain: yes

- **Kitesurfen, Hasilein, Ticketwahl, Hardrock, Pop** | `plural` | severity=medium | category=plural
  current: literal string `None` in the plural field
  correct: `—`
  why: a Python `None` has leaked into the data instead of the no-plural marker; the app will display "None" as the plural.

## Clean
43 entries had no issues worth reporting (38 bullets above cover 43 flagged entries).

Total entries reviewed: 86 (ranks 8574–25995).
