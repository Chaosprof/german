# nouns_022 (reviewed 700 entries, source rows 14701–15400)

## Errors
- **Forschungszweck** | `english` | severity=low | category=gloss
  current: "research purposes"
  correct: "research purpose"
  why: the German entry is singular, whereas the English gloss is plural.

- **Frauenbeauftragte** | `plural, flags` | severity=high | category=plural
  current: `Frauenbeauftragte` with no `adjectivalNoun` flag
  correct: store `Frauenbeauftragten` and mark the row as an adjectival noun
  why: this is a substantivised adjective; the UI must render the nominative plural as `die Frauenbeauftragten`, not `die Frauenbeauftragte`.

- **Fußsohle** | `cefrLevel` | severity=low | category=cefr
  current: C1
  correct: approximately A2–B1
  why: this ordinary body-part word is grossly overgraded at C1.

- **Geburtenzahl** | `english` | severity=medium | category=gloss
  current: "number of births/birth rate"
  correct: "number of births/birth figure"; use `Geburtenrate` for "birth rate"
  why: a number and a rate are different measures, and the second gloss teaches a false equivalence.

- **Geldschein** | `cefrLevel` | severity=low | category=cefr
  current: C1
  correct: approximately A2
  why: "banknote/note" is everyday cash vocabulary and is grossly overgraded at C1.

- **Geschlechtsorgan** | `english` | severity=medium | category=gloss
  current: "genitalia/sex organ/sexual organ"
  correct: "sex organ/genital organ"; reserve plural "genitalia" for `Geschlechtsorgane/Genitalien`
  why: English "genitalia" is plural, so presenting it first against a singular German noun obscures number and invites `a genitalia`.

- **Hauseingang** | `english` | severity=low | category=gloss
  current: "entrance/front door"
  correct: "entrance to a house/building entrance"; use `Haustür` for "front door"
  why: an entrance and the door fitted in it are not interchangeable.

- **Hilfsbedürftige** | `plural, english, flags` | severity=high | category=plural
  current: `die Hilfsbedürftige | Hilfsbedürftige | person in need of help`, with no adjectival-noun flag
  correct: `die Hilfsbedürftige | Hilfsbedürftigen | woman/female person in need of help`, with `adjectivalNoun`
  why: the UI would currently show the singular form as the plural; the feminine article also denotes a female person, not an unspecified person.

- **Hirnblutung** | `english` | severity=low | category=gloss
  current: "brain hemorrhage"
  correct: "brain haemorrhage/cerebral haemorrhage"
  why: the app targets British English, where `haemorrhage` is the standard spelling.

- **Hole** | `english` | severity=medium | category=gloss
  current: "hole"
  correct: "hole (in golf)"
  why: German `das Hole` is the golf term; an ordinary physical hole is `das Loch`.

- **Informationsbeschaffung** | `english` | severity=medium | category=gloss
  current: "information procurement/provision of information"
  correct: "information gathering/acquisition/procurement"
  why: `Beschaffung` is obtaining or gathering information, not providing it to someone else.

- **Interessenskonflikt** | `word, plural` | severity=medium | category=spelling
  current: `Interessenskonflikt | Interessenskonflikte`
  correct: prefer standard `Interessenkonflikt | Interessenkonflikte`
  why: the form with linking `-s-` is regional/nonstandard relative to the established standard learner headword `Interessenkonflikt`.
  uncertain: yes

- **Intro** | `english` | severity=medium | category=gloss
  current: "intro/introduction/launch"
  correct: "intro/introduction/opening sequence"
  why: `Intro` does not ordinarily mean a product or event launch.

- **Jobticket** | `english` | severity=high | category=gloss
  current: "job ticket"
  correct: "employer-subsidised public-transport pass/commuter pass provided through an employer"
  why: "job ticket" is not an explanatory English equivalent and conceals the specific German transport-pass meaning.

- **Klauen** | `whole row` | severity=medium | category=junk
  current: `das Klauen | — | stealing`
  correct: remove from the lexical noun bank; teach the verb `klauen` as colloquial "to steal" instead
  why: this is a freely formed nominalised infinitive rather than a useful lexical noun lemma and looks like corpus-derived part-of-speech contamination.
  uncertain: yes

- **Klingeln** | `whole row` | severity=medium | category=junk
  current: `das Klingeln | — | ringing/buzzing`
  correct: remove from the lexical noun bank or teach it only as a transparent nominalisation under the verb `klingeln`
  why: this is a productively formed nominalised infinitive, not an independently useful noun headword.
  uncertain: yes

- **Kompanie** | `english` | severity=medium | category=gloss
  current: "company"
  correct: "company (military unit); troupe/company (especially performers)"
  why: bare English "company" strongly suggests a business, which is not the ordinary meaning of German `Kompanie`.

- **Konsonant** | `cefrLevel` | severity=low | category=cefr
  current: A1
  correct: approximately A2–B1
  why: this grammatical/phonological term is implausibly early for a general A1 deck.

- **Koriander** | `cefrLevel` | severity=low | category=cefr
  current: C1
  correct: approximately A2–B1
  why: a common food and herb name is grossly overgraded at C1.

- **Krähe** | `english` | severity=medium | category=gloss
  current: "crow/rook"
  correct: "crow"; use `Saatkrähe` for "rook"
  why: a rook is a particular species and is not the general equivalent of `Krähe`.

- **Laborant** | `cefrLevel` | severity=low | category=cefr
  current: A1
  correct: approximately B1
  why: this specialised occupation is not realistic core A1 vocabulary.

- **Leichenschau** | `english` | severity=high | category=gloss
  current: "post-mortem examination"
  correct: "external examination of a body/death examination"
  why: `Leichenschau` is the external medical examination and certification of a corpse, not a post-mortem dissection or autopsy (`Obduktion`).

- **Liebespaar** | `english` | severity=low | category=gloss
  current: "couple"
  correct: "couple in love/lovers"
  why: generic "couple" loses the defining romantic sense and is much broader than `Liebespaar`.

- **Lügenpresse** | `english` | severity=medium | category=gloss
  current: "lying press"
  correct: "'lying press' (derogatory political slogan for allegedly dishonest/manipulative media)"
  why: the literal gloss omits that this is an accusatory, politically loaded and derogatory slogan, not a neutral term for the press.

- **Millionenmetropole** | `english` | severity=low | category=gloss
  current: "metropolis of millions/large metropolis"
  correct: "city/metropolis with millions of inhabitants"
  why: "metropolis of millions" is not idiomatic English and "large metropolis" loses the population component.

- **Moslem** | `word, plural` | severity=medium | category=spelling
  current: `Moslem | Moslems`
  correct: prefer modern `Muslim | Muslime` (also `Muslims`)
  why: `Moslem` is now marked as obsolescent; a learner bank should teach the neutral current form first.

- **Oberhaupt** | `english` | severity=low | category=gloss
  current: "head"
  correct: "head/leader (of a state, church or family)"
  why: without a domain note the gloss can be mistaken for the body part, whereas `Oberhaupt` denotes a person in authority.

- **Parkplatzsuche** | `english` | severity=medium | category=gloss
  current: "car park search"
  correct: "search for a parking space/looking for parking"
  why: "car park search" suggests looking for a whole car park and is not idiomatic British English for the normal German meaning.

- **Personalpronomen** | `cefrLevel` | severity=low | category=cefr
  current: A1
  correct: approximately A2–B1
  why: this metalinguistic term is too advanced for a general A1 noun deck even if some pronouns themselves are taught at A1.

- **Pflegerin** | `english` | severity=medium | category=gloss
  current: "caregiver/nurse/paediatric nurse"
  correct: "female carer/care worker; nurse"; use `Kinderkrankenpflegerin` for "paediatric nurse"
  why: `Pflegerin` alone is not specifically a paediatric nurse.

- **Pi** | `plural, english` | severity=high | category=plural
  current: `Pis` with "pi"
  correct: use `—` for the mathematical constant; retain `Pis` only if the separate countable Greek-letter sense is explicitly given
  why: mathematical pi is not countable, so the stored plural does not belong to the glossed sense.

- **Pol** | `cefrLevel` | severity=low | category=cefr
  current: C1
  correct: approximately B1–B2
  why: the everyday geographic/scientific word "pole" is substantially below C1.

- **Praxisraum** | `english` | severity=medium | category=gloss
  current: "practice room/consulting room"
  correct: "consulting room/treatment room (in a medical or professional practice)"
  why: English "practice room" normally means a room for rehearsing, which is not the German `Praxis` sense here.

- **Querdenker** | `english` | severity=low | category=gloss
  current: "contrarian"
  correct: "lateral/independent thinker; contrarian" with a note that the word can now evoke the German anti-establishment `Querdenken` movement
  why: the traditional positive sense is omitted, while the bare gloss gives learners no warning about the word's strong contemporary political associations.

- **Regionalverkehr** | `plural, english` | severity=medium | category=plural
  current: `Regionalverkehre` with "regional transport"
  correct: use `—` for general "regional transport"; retain technical plural `Regionalverkehre` only with an explicit countable sense such as regional transport flows/services
  why: ordinary transport as a system is a mass noun; the specialist plural should not be taught as its unrestricted everyday plural.

- **Relegation** | `english` | severity=high | category=gloss
  current: "relegation"
  correct: "promotion/relegation play-off"
  why: in German sport `Relegation` normally names the play-off deciding promotion or relegation, not relegation itself (`Abstieg`).

- **Rolltreppe** | `cefrLevel` | severity=low | category=cefr
  current: B2
  correct: approximately A1–A2
  why: "escalator" is ordinary public-place and travel vocabulary and is grossly overgraded at B2.

- **Sauerkraut** | `cefrLevel` | severity=low | category=cefr
  current: C1
  correct: approximately A1–A2
  why: this common, culturally salient food word is grossly overgraded at C1.

- **Schachspieler** | `cefrLevel` | severity=low | category=cefr
  current: C1
  correct: approximately A2
  why: the transparent compound "chess player" is far below C1 learner difficulty.

- **Schlendern** | `whole row` | severity=medium | category=junk
  current: `das Schlendern | — | strolling`
  correct: remove from the lexical noun bank; teach `schlendern` as a verb
  why: this is merely the productive nominalisation of the infinitive and is poor standalone noun-bank material.
  uncertain: yes

- **Schulbau** | `plural, english` | severity=low | category=gloss
  current: `Schulbauten` with "school construction"
  correct: "school construction; school building" and clarify that `Schulbauten` is the plural of the countable building sense
  why: the displayed mass/process gloss does not explain the stored countable plural.

- **Schwefeldioxid** | `english` | severity=low | category=gloss
  current: "sulfur dioxide"
  correct: "sulphur dioxide"
  why: the app targets British English, where `sulphur` is the standard spelling.

- **Selbstversorger** | `english` | severity=medium | category=gloss
  current: "self-caterer"
  correct: "self-sufficient person/producer; self-catering holidaymaker"
  why: `Selbstversorger` is not restricted to holiday accommodation and centrally denotes someone who supplies their own needs.

- **Skispringen** | `plural` | severity=high | category=plural
  current: `Skispringen`
  correct: `—`
  why: the sport noun `Skispringen` has no plural; repeating the singular as a stored plural falsely implies an invariant count noun.

- **Sportboot** | `english` | severity=medium | category=gloss
  current: "sports boat"
  correct: "recreational/pleasure craft"
  why: `Sportboot` is the standard broad term for privately used recreational craft, not necessarily a boat used in competitive sport.

- **Stabstelle** | `word, plural` | severity=high | category=spelling
  current: `Stabstelle | Stabstellen`
  correct: `Stabsstelle | Stabsstellen`
  why: the organisational term meaning "staff unit" requires the linking `-s-`; the stored headword and plural are misspelled.

- **Störfall** | `english` | severity=medium | category=gloss
  current: "incident"
  correct: "malfunction/operational incident (especially at an industrial or nuclear facility)"
  why: generic "incident" is far broader and omits the technical operational-safety sense.

- **Superintendentin** | `english` | severity=medium | category=gloss
  current: "superintendent"
  correct: "female Protestant regional church superintendent/church official"
  why: unqualified English "superintendent" usually denotes an administrative, police or school role and misses the specifically ecclesiastical German sense.

- **Tatkraft** | `english` | severity=low | category=gloss
  current: "energy/vigor"
  correct: "energy/drive/vigour"
  why: the app targets British English, which spells the word `vigour`; "drive" also makes the active, enterprising sense clearer.

- **Textbaustein** | `cefrLevel` | severity=low | category=cefr
  current: A1
  correct: approximately B2
  why: this abstract workplace/computing term is grossly too specialised for A1.

- **Textverarbeitung** | `plural, english` | severity=high | category=plural
  current: `Textverarbeitungen` with "word processing"
  correct: use `—` for the glossed field/activity "word processing"
  why: the ordinary glossed sense is uncountable; a highly contextual plural of processing operations should not be presented as its learner citation plural.

- **Transgender** | `article, english` | severity=medium | category=gloss
  current: `der Transgender | Transgender | trans person/trans-person/transgender`
  correct: "transgender person/trans person (male)" for the masculine entry, and do not use bare English "a transgender"
  why: the German masculine article makes this a male-person entry, while English `transgender` is normally an adjective and the current gloss is both grammatically and referentially unclear.

- **Trauzimmer** | `english` | severity=medium | category=gloss
  current: "marriage room/wedding room"
  correct: "wedding ceremony room/ceremony room (at a register office)"
  why: both current phrases are unnatural English and fail to explain the room's actual function.

- **Verfahrensrecht** | `plural, english` | severity=high | category=plural
  current: `Verfahrensrechte` with "procedural law"
  correct: use `—` for the body-of-law sense; add "procedural right" as a separate countable sense if retaining `Verfahrensrechte`
  why: procedural law as a legal system has no plural; `Verfahrensrechte` denotes individual procedural rights, a different sense absent from the gloss.

- **Verhütungsmethode** | `english` | severity=low | category=gloss
  current: "contraception method"
  correct: "contraceptive method/method of contraception"
  why: the current phrase is comprehensible but not idiomatic English.

- **Voting** | `english` | severity=medium | category=gloss
  current: `Votings` with "voting"
  correct: "vote/poll (especially a public or audience vote)"
  why: German `Voting` is a countable voting event or poll, as its plural shows; English "voting" is normally an uncountable activity.

- **Wasserbecken** | `english` | severity=medium | category=gloss
  current: "water basin"
  correct: "pool/reservoir/water tank or basin" according to context
  why: bare "water basin" is an unnatural and overly narrow translation for the several common kinds of `Wasserbecken`.

- **Weihnacht** | `english` | severity=medium | category=gloss
  current: "Christmas"
  correct: "Christmas (poetic, regional or in compounds/fixed expressions)"; teach ordinary `Weihnachten` first
  why: bare singular `Weihnacht` is not the neutral everyday learner form for Christmas.

- **Weltstar** | `english` | severity=medium | category=gloss
  current: "world star"
  correct: "international/global superstar"
  why: "world star" is an unidiomatic calque and does not give learners a usable English equivalent.

- **Wettbewerbsverzerrung** | `english` | severity=medium | category=gloss
  current: "distortion of competition/unfair competition"
  correct: "distortion of competition/anti-competitive distortion"
  why: "unfair competition" is the distinct concept `unlauterer Wettbewerb`, not a general interchangeable translation.

- **Wildunfall** | `english` | severity=medium | category=gloss
  current: "wildlife accident"
  correct: "road accident/collision involving a wild animal"
  why: "wildlife accident" is neither idiomatic nor specific enough to convey the established traffic sense.

- **Zahnstein** | `english` | severity=high | category=gloss
  current: "tartar / dental plaque"
  correct: "tartar/dental calculus"; use `Zahnbelag` for "dental plaque"
  why: plaque is the soft biofilm that can harden into tartar, so the two terms are not synonyms.

- **Zielvorstellung** | `english` | severity=medium | category=gloss
  current: "objective/goal"
  correct: "idea/conception of the desired goal or outcome"
  why: `Zielvorstellung` is a mental conception of what the goal should be, not simply the goal itself.

- **Zugverkehr** | `plural, english` | severity=medium | category=plural
  current: `Zugverkehre` with "rail traffic"
  correct: use `—` for general "rail/train traffic"; retain technical plural only with an explicit sense such as train services/traffic flows
  why: everyday rail traffic is uncountable, while `Verkehre` is a specialist transport-planning plural.

- **Abbrennen** | `whole row` | severity=medium | category=junk
  current: `das Abbrennen | — | burning down/burning off`
  correct: remove from the lexical noun bank and teach the separable verb `abbrennen`
  why: this is a freely generated nominalised infinitive rather than an independent learner noun lemma.
  uncertain: yes

- **Abschleppdienst** | `english` | severity=medium | category=gloss
  current: "breakdown service/towing service"
  correct: "towing/recovery service"; use `Pannendienst` for a general breakdown service
  why: a breakdown service may repair a vehicle at the roadside, whereas `Abschleppdienst` specifically tows or recovers it.

- **Apostelgeschichte** | `plural, english` | severity=high | category=plural
  current: `Apostelgeschichten` with "Acts of the Apostles/Book of Acts"
  correct: use `—` for the biblical book title; retain `Apostelgeschichten` only with the separate literal sense "stories about apostles"
  why: the proper-title sense in the gloss has no plural; the stored plural belongs to a different compositional sense.

- **Aufholjagd** | `english` | severity=medium | category=gloss
  current: "catch-up/catching up/catching-up process"
  correct: "comeback/rally/fightback; chase to catch up"
  why: the current calques are unnatural English and miss the vivid sporting/competitive sense of the German noun.

- **Auftauchen** | `whole row` | severity=medium | category=junk
  current: `das Auftauchen | — | appearance`
  correct: remove from the lexical noun bank and teach `auftauchen` as "to appear/emerge"
  why: this is a transparent productive nominalisation, not an independent noun lemma worth memorising.
  uncertain: yes

- **Augentropfen** | `article, word, plural` | severity=high | category=article
  current: `das Augentropfen | Augentropfen | eye drops`
  correct: `die Augentropfen | Augentropfen | eye drops` as a plural-only entry
  why: medicine meaning "eye drops" is plural-only and takes `die`; `das Augentropfen` would instead be a nominalised action of dripping into the eyes.

- **Ausatmen** | `whole row` | severity=medium | category=junk
  current: `das Ausatmen | — | exhalation/breathing out`
  correct: remove from the lexical noun bank and teach `ausatmen` as a verb; use lexical noun `Ausatmung` if a noun is required
  why: this is simply the productive nominalisation of the infinitive and is poor standalone noun-bank material.
  uncertain: yes

- **Ausflugslokal** | `english` | severity=medium | category=gloss
  current: "excursion restaurant"
  correct: "country/destination restaurant popular with day-trippers"
  why: "excursion restaurant" is an unidiomatic calque and does not explain the cultural sense.

- **Bademeister** | `english` | severity=low | category=gloss
  current: "pool attendant/lifeguard"
  correct: "pool supervisor/attendant"; use `Rettungsschwimmer` for a lifeguard
  why: a `Bademeister` manages or supervises a bathing facility and is not automatically equivalent to a lifeguard.

- **Bahndamm** | `english` | severity=low | category=gloss
  current: "railroad embankment"
  correct: "railway/rail embankment"
  why: the app targets British English, where `railway` rather than `railroad` is standard.

## Clean
626 entries had no issues worth reporting.

## Coverage attestation
I manually evaluated all 700 rows in order, including the final row `Bahnverbindung`.
