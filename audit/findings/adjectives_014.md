# adjectives_014  (reviewed 659 entries, ranks 9101–9759)

This batch is not an adjective deck. Roughly four fifths of it is function words,
adverbs, inflected verb forms, numerals, greetings and proper nouns. Because the
contamination is systematic, the non-adjective entries are reported as grouped bullets
**by part of speech** with every affected lemma named; every entry that has an *additional*
defect (wrong gloss, corrupted gloss, non-word) gets its own bullet and is excluded from
the group lists, so each entry is counted exactly once.

## Errors

### Grouped contamination (wrong part of speech)

- **prepositions / postpositions** | `word` | severity=high | category=notadj
  current: listed as adjectives — binnen, während, anstatt, zuliebe, zwecks, hinsichtlich,
  zugunsten, wegen, neben, zwischen, gegen, plus, minus, samt, an, infolge, namens, über,
  von, mithilfe, aufgrund, im, um, per, anstelle, anhand, bis, aus, ab, mitsamt, auf, durch,
  längs, nach, zu, mit, bei, pro, vor, seit, hinter, ohne, gegenüber, außerhalb, unter,
  außer, zuzüglich
  correct: remove from the adjective deck (a preposition deck if one is wanted)
  why: none of these can attribute to a noun or stand predicatively; `im` is additionally a
  preposition+article contraction and not a lemma at all.

- **conjunctions / subjunctions** | `word` | severity=high | category=notadj
  current: soweit, insofern, sofern, ehe, sooft, woraufhin, sondern, obgleich, und, oder,
  aber, denn, als, ob, damit
  correct: remove
  why: sentence connectives, never attributive or predicative adjectives.

- **articles, pronouns, determiners, quantifiers** | `word` | severity=high | category=notadj
  current: irgendwas, keinerlei, bisschen, jeglich, jegliche, nen, nicht, etliche, was, andere,
  dir, du, wer, mein, welche, den, er, sie, dein, man, wir, ihr, jede, mehrere, weitere, viel,
  kein, diese, alles, mehr, nichts, wenig, euer, wen, dich, euch, ihn, mich, wem, genug,
  jemand, beide, etwas, paar
  correct: remove
  why: closed-class items; `nen` is a spoken-language contraction of *einen* and not a lemma;
  `jeglich`/`jegliche` are the same determiner entered twice, and the bare stem `jeglich`
  never occurs uninflected.

- **adverbs and modal particles only** | `word` | severity=medium | category=notadj
  current: üblicherweise, irgendwie, vielmehr, inwiefern, beispielsweise, bislang, hingegen,
  dagegen, währenddessen, stattdessen, heutzutage, äußerst, hellauf, durchaus, dazu, dafür,
  dadurch, vorzugsweise, ohnehin, allerdings, überhaupt, normalerweise, jeweils, voraus,
  anfangs, seitdem, schließlich, miteinander, mittlerweile, füreinander, ziemlich, extra,
  zwar, tagsüber, höchstens, hierfür, wozu, zweifelsohne, immerhin, seither, gleichermaßen,
  draußen, drinnen, drüben, daneben, gestern, heute, morgen, übermorgen, vorgestern, oben,
  unten, vorne, hinten, innen, außen, links, rechts, geradeaus, zusammen, gern, mitten,
  deswegen, meinetwegen, inzwischen, morgens, vormittags, mittags, nachmittags, abends,
  nachts, montags, dienstags, mittwochs, donnerstags, freitags, samstags, sonntags,
  sonnabends, wochentags, werktags, netterweise, fälschlicherweise, jedoch, allzu, zugleich,
  drauf, darüber, hierzulande, folglich, insbesondere, zudem, übereinander, schlimmstenfalls,
  übrigens, aufeinander, zumeist, zumindest, großteils, ausgerechnet, vorüber, auswendig,
  neulich, andernfalls, sowieso, zustande, überaus, zueinander, zeitweise, demnach, zurück,
  kurzerhand, anderswo, zuvor, so, vorwärts, gegebenenfalls, derart, hinaus, insgeheim,
  nebeneinander, überdies, vorab, womöglich, heraus, wieder, einst, größtenteils, vielerorts,
  weitaus, mitunter, immer, lediglich, vergebens, möglicherweise, wiederum, dummerweise,
  auseinander, hinunter, woanders, untereinander, auch, wo, woher, dann, zuerst, wann, leider,
  hier, meistens, da, schon, jetzt, vielleicht, dort, sonst, gerne, gleichfalls, manchmal, nur,
  lange, vorher, hoffentlich, überall, warum, doch, wohin, mindestens, sofort, bald, nie,
  zurzeit, mal, vorbei, ebenso, kaum, also, unterwegs, danach, wohl, weg, hin, wofür
  correct: remove from the adjective deck
  why: none of these inflect for gender/case or occur attributively; several are pure
  particles (zwar, doch, halt-type) with no adjectival use whatsoever. `gern`/`gerne` and
  `seitdem`/`seither` are also duplicated pairs.

- **verb infinitives** | `word` | severity=high | category=junk
  current: zusammenbinden, vorausgehen, aufschwingen, auseinanderreißen, zusammentragen,
  vorausdenken, vorsprechen, wiedertreffen, überrennen, anbringen, mitentscheiden, dastehen,
  anklingen, offenstehen, darbieten, weiterbringen, vorwärtsgehen, miteinbeziehen,
  zurückerhalten, aufeinandertreffen, entlanggehen, rausbringen, weiterkommen, näherkommen,
  herausbekommen, hinauftragen, heranwachsen, mitdenken, auslesen, überspringen, weiterfahren,
  aufspringen, hinunterspringen, hervorstoßen, anheimfallen
  correct: move to the verb deck
  why: bare infinitives in an adjective deck; `wiedertreffen` is also not standard as a single
  word (*wiedersehen*).

- **finite verb forms (Präteritum / 3sg present)** | `word` | severity=high | category=junk
  current: hat, sprach, unterscheidet, entschied, ist, floss, kam, stand, bekam, überwand,
  sah, kennt, wuchs, verschrieb, dachte
  correct: delete — these are inflected forms, not lemmas
  why: corpus scrape artefacts; a learner shown "ist = is" in an adjective deck learns nothing.

- **bare past participles with no adjectival life** | `word` | severity=high | category=junk
  current: vorausgedacht, beigebracht, überrannt, rausgebracht, mitgedacht, gebracht,
  umgebracht, gelebt
  correct: delete (or keep only under their verbs)
  why: unlike *entspannt*, *bedroht* etc. these never function as attributive adjectives.

- **numerals** | `word` | severity=medium | category=notadj
  current: erste–zwölfte (ordinals), erstens–viertens, eins, zwei, vier, fünf, sechs, sieben,
  neun, zehn, elf, zwölf, dreizehn … tausend, einundzwanzig, einmal, zweimal, dreimal, viermal,
  zweifach, eineinhalb, null, einhundert, eintausend
  correct: move to a numbers deck
  why: numerals, not lexical adjectives; note also that **drei** and **acht** are missing from
  the cardinal run (9275→9276, 9279→9280), so the list is not even internally complete.

- **interjections / greetings** | `word` | severity=high | category=notadj
  current: ciao, danke, hallo, tschüs, bitte, ja, nein, grüezi, grüß, moin, prost, hey, hi, hurra
  correct: move to a phrases deck
  why: interjections and formulae; `grüß` is a bare imperative fragment of *Grüß Gott*, not a
  word in its own right. `prost` also duplicates `prosit`.

- **proper nouns (countries / regions)** | `word` | severity=high | category=junk
  current: Algerien, Japan, Frankreich, Italien, Portugal, Thailand, Polen, Russland, Spanien,
  Südamerika
  correct: move to a place-names deck
  why: proper nouns, not adjectives (the adjectives would be *französisch*, *polnisch* …).

- **inflected / comparative forms as lemmas** | `word` | severity=medium | category=junk
  current: länger, früher, nächste, letzte, besondere
  correct: cite as *lang*, *früh*, *nächst-* (only inflected), *letzt-* (only inflected), *besonder-*
  why: comparatives entered as their own lemmas, and inflected-only stems entered in one
  arbitrary inflected form.

- **stray capitalisation inside glosses** | `english` | severity=low | category=gloss
  current: "Goal-orientated" (zielorientiert), "Time-consuming" (zeitintensiv), "Underlying"
  (zugrunde), "Palate-friendly" (gaumenfreundlich), "Assertive" (durchsetzungsstark),
  "Recognisable" (anerkennenswert), "Stress-reducing" (spannungsmindernd), "Mixed ages"
  (altersgemischt), "Read out" (auslesen)
  correct: lower-case initial letters
  why: cross-cutting style defect; these entries are also reported individually where they
  have substantive problems.

### Individual entries

- **darauflos** | `word` | severity=high | category=junk
  current: darauflos — "straight ahead/without further ado"
  correct: delete; the particle is *drauflos* (drauflosreden)
  why: `darauflos` is not a German word.

- **drauflos** | `word` | severity=high | category=notadj
  current: drauflos — "go for it"
  correct: delete; verbal particle only
  why: a particle, and the gloss is an English exhortation rather than a translation.

- **müdegearbeitet** | `word` | severity=high | category=junk
  current: müdegearbeitet — "tired"
  correct: delete; the construction is *sich müde arbeiten*
  why: not an established lemma, and "tired" is not what it would mean.

- **unpräsent** | `word` | severity=high | category=junk
  current: unpräsent — "unpresentable"
  correct: delete
  why: not a German word; "unpresentable" would be *nicht präsentabel* — the gloss is wrong too.

- **erlaubterweise** | `word` | severity=medium | category=junk
  current: erlaubterweise — "permissibly"
  correct: delete
  why: not an established German adverb.

- **schlummerlos** | `word` | severity=medium | category=junk
  current: schlummerlos — "slumberless"
  correct: delete; "sleepless" = *schlaflos*
  why: poetic nonce-word; "slumberless" is not usable English either.

- **talentvoll** | `word` | severity=medium | category=junk
  current: talentvoll — "talented"
  correct: *talentiert* / *begabt*
  why: `talentvoll` is not standard German.

- **prosopagnostisch** | `word` | severity=medium | category=junk
  current: prosopagnostisch — "prosopagnostic"
  correct: delete
  why: clinical coinage, not an established German adjective; no learner value at any level.

- **kiefergerecht** | `english` | severity=medium | category=gloss
  current: "orthodontic"
  correct: "shaped to fit the jaw" — *orthodontic* = *kieferorthopädisch*
  why: ad-hoc marketing compound with an outright wrong gloss.

- **bang** | `english` | severity=high | category=gloss
  current: bang — "bang"
  correct: "anxious/fearful" (mir ist bang)
  why: the English lookalike was copied through instead of translated.

- **hundeelend** | `english` | severity=high | category=gloss
  current: "dog suffering"
  correct: "utterly wretched/dreadful" (mir ist hundeelend)
  why: word-by-word calque; "dog suffering" is not English.

- **schloss** | `word` | severity=high | category=junk
  current: schloss — "lock"
  correct: delete; it is the Präteritum of *schließen* ("closed")
  why: doubly wrong — an inflected verb form glossed as the noun *das Schloss*.

- **angerannt** | `word` | severity=high | category=junk
  current: angerannt — "ran"
  correct: delete
  why: past participle of *anrennen* glossed with an English past tense.

- **zusammengehangen** | `word` | severity=high | category=junk
  current: zusammengehangen — "related"
  correct: delete (verb *zusammenhängen*)
  why: participle presented as an adjective with an adjectival gloss.

- **eigens** | `english` | severity=high | category=gloss
  current: eigens — "own"
  correct: adverb "specially/expressly"
  why: confused with the adjective *eigen*; teaches a false equivalence.

- **bekanntlich** | `english` | severity=high | category=gloss
  current: bekanntlich — "known"
  correct: adverb "as is well known"
  why: not an adjective and not "known" (= *bekannt*).

- **anerkennenswert** | `english` | severity=high | category=gloss
  current: "Recognisable"
  correct: "commendable/praiseworthy"
  why: wrong word entirely (*erkennbar* is "recognisable").

- **höchst** | `english` | severity=high | category=gloss
  current: höchst — "highest"
  correct: adverbial intensifier "extremely/most"
  why: "highest" is *höchste*; the bare form is only an intensifier.

- **allermeist** | `english` | severity=medium | category=gloss
  current: allermeist — "most of the time"
  correct: "by far the most/most of all" (only inflected: *allermeiste*)
  why: wrong gloss plus a stem that never occurs uninflected.

- **her** | `english` | severity=high | category=gloss
  current: her — "here"
  correct: directional particle "hither/towards the speaker" (komm her)
  why: "here" is *hier*; a genuine false-friend trap for learners.

- **hervor** | `word` | severity=high | category=notadj
  current: hervor — "forth/out (as a prefix or particle)"
  correct: remove
  why: the gloss itself concedes it is a prefix/particle.

- **für** | `english` | severity=high | category=gloss
  current: für — "oft often"
  correct: preposition "for"
  why: corrupted gloss belonging to *oft*; also a preposition, not an adjective.

- **besonders** | `english` | severity=high | category=gloss
  current: "besonders?) special (What's special on your birthday?)"
  correct: adverb "especially/particularly"
  why: gloss contains leftover editing debris and a stray bracket; also an adverb.

- **das / der / die / dem** | `english` | severity=high | category=junk
  current: "(the sausage)", "(the kindergarten)", "(the bottle)", "(The ships sail on the river.)"
  correct: delete — definite articles, not adjectives
  why: the glosses are example fragments from an unrelated noun exercise; no translation given.

- **am** | `english` | severity=high | category=gloss
  current: am — "to work (What do you work as?)"
  correct: delete — contraction of *an dem*
  why: gloss is a verb phrase captured from the surrounding exercise; entirely corrupted.

- **zum** | `english` | severity=high | category=gloss
  current: zum — "cheers"
  correct: delete — contraction of *zu dem*
  why: gloss harvested from *zum Wohl!*; a contraction is not a lemma.

- **in** | `english` | severity=high | category=gloss
  current: in — "in (What are the words called in your language?)"
  correct: preposition; remove from deck
  why: gloss is mostly an example sentence; entry is a preposition.

- **wie** | `english` | severity=high | category=gloss
  current: wie — "here: what (What are the words called in your language?)"
  correct: "how; as/like"
  why: "here: what" is exercise-specific and misleading; core senses missing.

- **sowie** | `english` | severity=high | category=gloss
  current: sowie — "and"
  correct: "as well as"
  why: conjunction, and "and" (= *und*) blurs the distinction.

- **guten / gute** | `word` | severity=high | category=junk
  current: guten — "Good day! Hello!"; gute — "good night"
  correct: delete; inflected forms of *gut* lifted from *Guten Tag* / *Gute Nacht*
  why: inflected-form lemmas whose glosses are whole greetings.

- **neutrum** | `word` | severity=high | category=junk
  current: neutrum — "neuter"
  correct: delete
  why: grammar metalanguage (and a noun, *das Neutrum*).

- **qm** | `word` | severity=high | category=junk
  current: qm — "sq m (= square metre)"
  correct: delete
  why: abbreviation of the noun *Quadratmeter*.

- **usw** | `word` | severity=high | category=junk
  current: usw — "etc"
  correct: delete
  why: abbreviation (*usw.*), not a word.

- **contra** | `word` | severity=medium | category=gloss
  current: contra — "contra"
  correct: "against" — and it is a preposition/adverb
  why: the gloss is Latin, i.e. no translation at all.

- **zurecht** | `word` | severity=medium | category=junk
  current: zurecht — "rightly"
  correct: "rightly" is spelt *zu Recht*; *zurecht* exists only as a verbal prefix
  why: teaches a spelling error.

- **entgegengebracht** | `english` | severity=high | category=gloss
  current: "accommodated"
  correct: participle of *entgegenbringen* "show/extend (trust, respect) towards"
  why: wrong translation; also a bare participle.

- **erspart** | `english` | severity=medium | category=gloss
  current: "saves"
  correct: "saved/spared"
  why: participle glossed with a finite English verb.

- **ausgenutzt** | `english` | severity=medium | category=gloss
  current: "utilised"
  correct: "exploited/taken advantage of"
  why: `ausnutzen` of a person is pejorative; "utilised" hides that.

- **ausgeliefert** | `english` | severity=medium | category=gloss
  current: "delivered"
  correct: "at the mercy of/exposed to (jemandem ausgeliefert sein)"
  why: the adjectival sense, which is the only reason to list it, is missing.

- **gedacht** | `english` | severity=medium | category=gloss
  current: "thought"
  correct: "intended (for)" (für Kinder gedacht)
  why: the bare participle gloss is unusable as an adjective.

- **angelehnt** | `english` | severity=medium | category=gloss
  current: "leant on"
  correct: "ajar (of a door); modelled on (an X angelehnt)"
  why: neither real sense is given.

- **anerkennend** | `english` | severity=medium | category=gloss
  current: "recognising"
  correct: "appreciative/approving"
  why: wrong sense of *anerkennen*.

- **berufsbegleitend** | `english` | severity=medium | category=gloss
  current: "part-time"
  correct: "in-service/while continuing to work"
  why: "part-time" is *Teilzeit*; the entry is about studying alongside a job.

- **minderbemittelt** | `english` | severity=medium | category=gloss
  current: "underprivileged"
  correct: chiefly ironic "dim-witted" (geistig minderbemittelt); orig. "of limited means"
  why: register and sense both misrepresented; learner could give serious offence.

- **brotlos** | `english` | severity=medium | category=gloss
  current: "breadless"
  correct: "unprofitable (eine brotlose Kunst); without a livelihood"
  why: "breadless" is not English usage.

- **bestens** | `english` | severity=medium | category=gloss
  current: bestens — "best"
  correct: adverb "very well/perfectly"
  why: superlative adverb, not the adjective *beste*.

- **voller** | `english` | severity=medium | category=gloss
  current: voller — "full"
  correct: indeclinable "full of" (voller Freude); "full" = *voll*
  why: also the comparative of *voll*, so the lemma is ambiguous.

- **haufenweise** | `english` | severity=medium | category=notadj
  current: "heaps"
  correct: adverb "in heaps/loads of"
  why: adverb, and the gloss is a bare noun.

- **infrage** | `word` | severity=medium | category=notadj
  current: infrage — "in question"
  correct: only in *infrage kommen/stellen*
  why: fixed-phrase element, not an adjective.

- **zugrunde** | `word` | severity=medium | category=notadj
  current: zugrunde — "Underlying"
  correct: only in *zugrunde liegen/gehen*
  why: fixed-phrase particle; "underlying" is *zugrunde liegend*.

- **zustande** | `word` | severity=medium | category=notadj
  current: zustande — "into being/about (in zustande kommen)"
  correct: remove
  why: fixed-phrase particle only (the gloss admits it).

- **zugange** | `word` | severity=low | category=notadj
  current: zugange — "at work/underway"
  correct: predicative only, *zugange sein*
  why: no attributive use.

- **getrost** | `word` | severity=low | category=notadj
  current: getrost — "confident"
  correct: adverb "safely/without hesitation" (du kannst getrost …)
  why: modern usage is adverbial, not "confident".

- **prosit** | `word` | severity=high | category=notadj
  current: prosit — "Cheers"
  correct: move to phrases (and it duplicates *prost*)
  why: an interjection.

- **erkältet** | `english` | severity=medium | category=gloss
  current: "to have a cold"
  correct: "having a cold / down with a cold (erkältet sein)"
  why: gloss is an English infinitive phrase, not an adjective translation.

- **los** | `english` | severity=medium | category=gloss
  current: los — "to be up (What's up?)"
  correct: "loose; off (Los!); *Was ist los?* = what's wrong/going on?"
  why: gloss is an unusable fragment of an idiom.

- **gar** | `english` | severity=medium | category=gloss
  current: gar — "really"
  correct: particle "even/at all (gar nicht)"; adjective sense "cooked/done"
  why: "really" is misleading and the culinary adjective sense — the only genuinely
  adjectival one — is absent.

- **hierbei** | `english` | severity=medium | category=gloss
  current: "here"
  correct: pronominal adverb "in this connection/in doing so"
  why: wrong gloss plus wrong part of speech.

- **hierzu** | `english` | severity=low | category=gloss
  current: "regarding this/in addition to this"
  correct: "on this/for this purpose"
  why: "in addition to this" is not a sense of *hierzu*.

- **darauf** | `english` | severity=low | category=gloss
  current: "upon"
  correct: "on it/thereupon; after that"
  why: bare preposition as gloss for a pronominal adverb.

- **noch** | `english` | severity=medium | category=gloss
  current: "once more"
  correct: "still; yet; (noch ein) another"
  why: the core senses are missing; also a particle, not an adjective.

- **Brasilien** | `english` | severity=high | category=gloss
  current: "Brasil"
  correct: "Brazil"
  why: misspelt country name (plus proper noun in an adjective deck).

- **schade** | `english` | severity=low | category=gloss
  current: "pity"
  correct: "a shame/a pity (es ist schade)"
  why: predicative-only adjective; bare noun gloss is confusing.

- **circa** | `word` | severity=medium | category=notadj
  current: circa — "approximately (= approx.)"
  correct: adverb; remove
  why: not an adjective.

- **namens** | `word` | severity=medium | category=notadj
  current: namens — "named"
  correct: adverb/preposition "by the name of; on behalf of"
  why: glossed as a participle, which invites attributive use it does not have.

- **hochdotiert** | `english` | severity=low | category=gloss
  current: "highly endowed/well-paid"
  correct: "well-paid/lucrative; (of a prize) richly endowed"
  why: "highly endowed" first is ambiguous to the point of comedy.

- **verhandlungssicher** | `english` | severity=low | category=gloss
  current: "business fluent"
  uncertain: yes
  correct: "fluent enough to negotiate in (a language)"
  why: job-ad term; "business fluent" is jargon rather than a translation.

- **geteilt** | `english` | severity=low | category=gloss
  current: "shared"
  correct: "divided; shared"
  why: primary sense is "divided" (geteilte Meinungen).

- **gezeichnet** | `english` | severity=low | category=gloss
  current: "drawn"
  correct: "marked (by illness/suffering); drawn"
  why: bare-participle sense placed first.

- **ausgewechselt** | `english` | severity=low | category=gloss
  current: "exchanged"
  correct: "substituted/replaced"
  why: *auswechseln* is replacement, not exchange.

- **aufgerichtet** | `english` | severity=low | category=gloss
  current: "erected"
  correct: "upright/raised"
  why: "erected" reads as construction work.

- **gefühlt** | `english` | severity=low | category=gloss
  current: "felt"
  correct: "as it feels/seemingly (gefühlt hundert Mal)"
  why: the modern adverbial use, which is why it is frequent, is missing.

- **überfordert** | `english` | severity=low | category=gloss
  current: "overstrained"
  correct: "overwhelmed/out of one's depth"
  why: "overstrained" is not idiomatic British English here.

- **verplant** | `english` | severity=low | category=gloss
  current: "planned"
  correct: "fully booked up (of time); colloq. scatty"
  why: "planned" is *geplant*.

- **eingestellt** | `english` | severity=low | category=gloss
  current: "set"
  correct: "set/adjusted; taken on (employed); disposed (positiv eingestellt)"
  why: too thin to be usable.

- **rockig** | `english` | severity=low | category=gloss
  current: "rocking"
  correct: "rock-style/rocky (of music)"
  why: "rocking" suggests motion.

- **zündend** | `english` | severity=low | category=gloss
  current: "igniting"
  correct: "inspiring/rousing (eine zündende Idee)"
  why: literal gloss misses the only common use.

- **rettungslos** | `english` | severity=low | category=gloss
  current: "hopeless"
  correct: "beyond saving/irretrievably (rettungslos verloren)"
  why: chiefly an intensifying adverb.

- **kurfürstlich** | `english` | severity=low | category=gloss
  current: "electoral"
  correct: "of the prince-elector/Electoral (historical)"
  why: "electoral" reads as election-related; it is a historical title adjective.

- **vielbeschäftigt** | `english` | severity=low | category=gloss
  current: "busy"
  correct: "very busy/much in demand"
  why: loses the intensifier.

- **baumbeschattet** | `english` | severity=low | category=gloss
  current: "tree shaded"
  correct: "tree-shaded"
  why: missing hyphen; also a rare literary compound.

- **renoviert** | `english` | severity=low | category=gloss
  current: "refurbished"
  correct: "renovated/done up"
  why: *renoviert* is the direct cognate; "refurbished" is a different register.

- **spannungsmindernd** | `english` | severity=low | category=gloss
  current: "Stress-reducing"
  correct: "tension-reducing"
  why: *Spannung* is tension; "stress" is *Stress*.

- **altersgemischt** | `english` | severity=low | category=gloss
  current: "Mixed ages"
  correct: "mixed-age (group)"
  why: noun phrase given for an attributive adjective.

- **getreulich** | `word` | severity=low | category=junk
  current: getreulich — "faithfully/loyally"
  uncertain: yes
  correct: archaic/literary variant of *treu*; consider dropping
  why: duplicates a live word with a dated form.

- **ungefähr** | `word` | severity=low | category=notadj
  current: ungefähr — "approximately"
  uncertain: yes
  correct: chiefly adverb (attributive *ungefähre Zahl* exists but is marginal)
  why: glossed purely adverbially.

- **näher** | `word` | severity=medium | category=junk
  current: näher — "closer"
  correct: cite as *nah*
  why: comparative listed as its own lemma.

- **wiedererkannt / erbracht** | `word` | severity=low | category=junk
  current: listed as adjectives — "recognised", "provided"
  correct: delete
  why: bare participles with no attributive adjectival use.

- **CEFR levels are unusable across the batch** | `cefr` | severity=medium | category=cefr
  current: everything from rank 9403 onward is C1 regardless of content — *zueinander*,
  *immer*, *nicht*, *wieder*, *ist*, *kennt*, *namens*; while *gestresst*, *netto*, *live*,
  *rockig* and the whole 9592–9746 block of pronouns and greetings sit at A1
  correct: level by word, not by rank block
  why: `immer`, `nicht`, `wieder`, `zurück` are among the commonest words in German and are
  tagged C1, while genuinely advanced items (*prosopagnostisch*, *kurfürstlich*, *skrupulös*)
  share a level with them; the tag carries no information.

## Clean

132 entries had no issues worth reporting — the genuine adjectives and participial
adjectives (e.g. kennzeichnend, bedrückend, energiegeladen, unverkäuflich, entschlussfreudig,
zentnerschwer, hochgewachsen, maßgeschneidert, bildungsbürgerlich, durchsetzungsstark's
neighbours floskelhaft/phrasenhaft, umweltverträglich, ungetrübt, sozialkritisch,
computerspielsüchtig, unvergleichlich, tiefsinnig, sensorisch, zermürbt, topaktuell,
supernett).

**Entries reviewed: 659 (ranks 9101–9759).** 527 flagged, 132 clean.
