# verbs_008 (reviewed 542 entries, source rows 4901–5442)

## Errors
- **leichttun** | `english` | severity=medium | category=gloss
  current: find easy
  correct: sich mit etwas leichttun — find something easy/have little difficulty with something
  why: The ordinary construction is reflexive and takes `mit`; the current gloss invites ungrammatical non-reflexive use.

- **loseisen** | `english` | severity=medium | category=gloss
  current: pry loose; get away; persuade someone to part with something
  correct: etwas loseisen — pry something loose; sich von jemandem/etwas loseisen — get away/extricate oneself; jemandem etwas loseisen — get something out of someone
  why: The listed senses have importantly different valency, and the everyday “get away” sense requires `sich`.

- **losmarschieren** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist losmarschiert`)
  why: This directed-motion/departure verb forms its Perfekt with `sein`.

- **mitsegeln** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist mitgesegelt`)
  why: In the supplied “sail along” sense it is an intransitive motion verb and takes `sein`.

- **niedersetzen** | `english` | severity=medium | category=gloss
  current: put/sit down
  correct: etwas/jemanden niedersetzen — put/set down; sich niedersetzen — sit down
  why: The intransitive English sense “sit down” is reflexive in German.

- **outsourcen** | `prateritum; perfekt` | severity=high | category=verbform
  current: irregular=False; prateritum=UNSET; perfekt=UNSET
  correct: Store `sourcte out/outsourcte` and `outgesourct` (variant `outgesourced`)
  why: This anglicism has variable, partly separable inflection that cannot be safely generated as an ordinary weak verb from the written infinitive.

- **paralysieren** | `english` | severity=low | category=spelling
  current: paralyse/paralyze
  correct: paralyse
  why: The bank targets British English; the American variant should not be mixed into the learner-facing gloss.

- **pirschen** | `english` | severity=medium | category=gloss
  current: creep/go deerstalking/stalk
  correct: sich an jemanden/etwas heranpirschen — creep/stalk up to; auf die Pirsch gehen — go stalking
  why: The normal verb construction is reflexive; “go deerstalking” is not a clear bare-verb equivalent.

- **popeln** | `english` | severity=low | category=gloss
  current: pick the nose
  correct: pick one's nose
  why: The current English is unnatural and obscures that the possessor normally matches the subject.

- **protegieren** | `english` | severity=low | category=spelling
  current: patronize/sponsor/promote
  correct: patronise/sponsor/promote
  why: `Patronise` is the British spelling required by the bank's house style.

- **rechten** | `english; cefrLevel` | severity=medium | category=cefr
  current: argue/claim/defend; B1
  correct: mit jemandem rechten — quarrel/remonstrate with someone (rare/literary); C1+ or UNSET
  why: This rare, elevated verb is not a general equivalent of “claim” or “defend” and is grossly mislevelled as B1 vocabulary.

- **rosten** | `english` | severity=low | category=gloss
  current: degenerate/rust
  correct: rust/corrode; figuratively decline/lose one's edge
  why: The concrete core sense should come first; bare “degenerate” overstates and obscures the figurative extension.

- **rubrizieren** | `english` | severity=low | category=spelling
  current: categorize/classify
  correct: categorise/classify
  why: `Categorise` is the British spelling required by the bank's house style.

- **schippen** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: B1/B2
  why: This concrete everyday verb meaning “shovel” is grossly over-levelled at C1.

- **snowboarden** | `english` | severity=low | category=gloss
  current: to snowboard
  correct: snowboard
  why: Drop the English infinitive marker for consistency with the bank's bare-verb gloss style.

- **spurten** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist gespurtet`)
  why: In the supplied “sprint” motion sense the verb forms its Perfekt with `sein`.

- **staubsaugen** | `perfekt` | severity=high | category=verbform
  current: irregular=False; perfekt=UNSET
  correct: Store `staubgesaugt` (Präteritum `staubsaugte`)
  why: The weak verb has exceptional participle placement; ordinary prefixing would produce the false form `gestaubsaugt`.

- **taumeln** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben); stagger
  correct: withSein=True for the usual motion sense (`ist zur Tür getaumelt`); note `haben` only for non-directional staggering
  why: The unqualified supplied gloss naturally denotes movement, for which the app's default `haben` teaches the wrong Perfekt.

- **tippeln** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist getippelt`)
  why: The glossed small-step motion verb forms its Perfekt with `sein`.

- **trippeln** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist getrippelt`)
  why: The glossed motion verb forms its Perfekt with `sein`.

- **überanstrengen** | `english` | severity=medium | category=gloss
  current: overexert/overstrain
  correct: sich überanstrengen — overexert/overstrain oneself; jemanden überanstrengen — overtax someone
  why: The ordinary self-directed sense requires `sich`, while the bare verb is transitive.

- **überfragen** | `english` | severity=high | category=gloss
  current: be stumped; ask too much of someone
  correct: jemanden überfragen — ask/quiz someone beyond their knowledge; überfragt sein — be stumped/out of one's depth
  why: `Überfragen` itself does not mean “be stumped”; that English meaning belongs to the adjectival passive `überfragt sein`.

- **überheben** | `english` | severity=medium | category=gloss
  current: be presumptuous/relieve/strain oneself
  correct: sich überheben — overreach oneself/be presumptuous/strain oneself by lifting; jemanden einer Last überheben — relieve someone of a burden (rare)
  why: The common senses are reflexive, while the rare transitive construction has a different argument structure.

- **überschäumen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist übergeschäumt`)
  why: In the supplied “foam/brim over” sense it denotes a change/movement and takes `sein`.

- **überschwappen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist übergeschwappt`)
  why: The intransitive “overflow/spill over” verb takes `sein`.

- **übersprudeln** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist übergesprudelt`)
  why: The intransitive “bubble/brim over” verb takes `sein`.

- **überwallen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist übergewallt`)
  why: In the listed “overflow” sense the separable verb forms its Perfekt with `sein`.

- **umlaufen** | `prateritum; perfekt; withSein; english` | severity=high | category=verbform
  current: lief um; umgelaufen; True; circulate/knock over
  correct: Split separable `úmlaufen` — lief um, umgelaufen, sein (knock over by running into) from inseparable `umláufen` — umlief, umlaufen, haben (circulate/orbit/go around)
  why: One entry conflates two differently stressed verbs; the stored forms and auxiliary contradict the first listed sense.

- **upcyceln** | `prateritum; perfekt` | severity=high | category=verbform
  current: irregular=False; prateritum=UNSET; perfekt=UNSET
  correct: Store `cycelte up/upcycelte` and `upgecycelt`
  why: Like other separable English-derived verbs, its accepted inflection is not safely derivable as an ordinary unsplit weak verb.

- **verfilzen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben); become felted/become matted
  correct: withSein=True (`ist verfilzt`) for the supplied intransitive result sense
  why: “Become matted/felted” is a change of state and takes `sein`; transitive `etwas verfilzen` would take `haben`.

- **verfrühen** | `english` | severity=medium | category=gloss
  current: be premature
  correct: sich verfrühen — occur/arrive too early; premature/early (of an event)
  why: The verb is normally reflexive; bare “be premature” also reads like an adjective rather than a usable verb construction.

- **verheben** | `english` | severity=medium | category=gloss
  current: strain oneself by lifting
  correct: sich verheben — strain oneself by lifting
  why: The supplied sense is obligatorily reflexive in German, but the entry never shows `sich`.

- **verholzen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben); lignify
  correct: withSein=True (`ist verholzt`) for the intransitive botanical sense
  why: The usual sense describes becoming woody and takes `sein`.

- **verknappen** | `english` | severity=medium | category=gloss
  current: become scarce/cut down the supply/run short
  correct: etwas verknappen — make/restrict the supply of something; sich verknappen — become scarce
  why: “Become scarce/run short” is reflexive, whereas the bare verb is transitive; the current slash list conflates them.

- **vernarben** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben); scar
  correct: withSein=True (`die Wunde ist vernarbt`); gloss heal over/form a scar
  why: The normal intransitive change-of-state verb takes `sein`, and bare English “scar” misleadingly suggests a transitive verb.

- **verrecken** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist verreckt`)
  why: This intransitive change-of-state verb forms its Perfekt with `sein`.

- **verrennen** | `english` | severity=medium | category=gloss
  current: get stuck on the wrong idea
  correct: sich in etwas verrennen — become fixated on/pursue a mistaken idea
  why: The idiomatic sense is reflexive and normally requires an `in` complement.

- **versacken** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist versackt`)
  why: The intransitive “sink/subside” verb takes `sein`.

- **verschimmeln** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist verschimmelt`)
  why: This change-of-state verb forms its Perfekt with `sein`.

- **verwahrlosen** | `withSein; english` | severity=high | category=aux
  current: UNSET (defaults to haben); degenerate/get in a bad state/neglect
  correct: withSein=True (`ist verwahrlost`); fall into neglect/become run-down/deteriorate
  why: The verb is intransitive and takes `sein`; it does not ordinarily mean transitive “neglect”.

- **verweichlichen** | `withSein; english` | severity=high | category=aux
  current: withSein=True; grow soft/make soft/render effeminate
  correct: Split `ist verweichlicht` — has grown soft from transitive `hat jemanden verweichlicht` — has made someone soft
  why: The entry combines intransitive and transitive senses with different auxiliaries, so `sein` is false for two listed glosses.

- **vorglühen** | `english` | severity=low | category=gloss
  current: pre-drink/predrink/pregame
  correct: preheat/pre-glow; colloquially pre-drink/have drinks before going out
  why: The gloss omits the established literal/technical sense and includes the Americanism “pregame” in a British-English bank.

- **waten** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist durch den Fluss gewatet`)
  why: In its supplied motion sense, `waten` forms the Perfekt with `sein`.

- **widerhallen** | `prateritum; perfekt` | severity=high | category=verbform
  current: irregular=False; prateritum=UNSET; perfekt=UNSET
  correct: Store `hallte wider` and `widergehallt`
  why: This `wider-` verb is separable; leaving the forms blank is unsafe because the identically written prefix is inseparable in many other verbs.

- **wohltun** | `english` | severity=medium | category=gloss
  current: do good
  correct: jemandem wohltun — do someone good/be beneficial or pleasant for someone
  why: Bare “do good” suggests performing charitable or virtuous acts (`Gutes tun`), not the dative construction and meaning of `wohltun`.

- **zurückzucken** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist zurückgezuckt`)
  why: The recoil/backward-motion sense takes `sein`.

- **zusammenkrachen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist zusammengekracht`)
  why: Both collision and collapse senses are intransitive events and take `sein`.

- **zutreten** | `withSein; english` | severity=high | category=aux
  current: withSein=True; kick (out at sb.)
  correct: withSein=False (`hat zugetreten`) for “kick/kick out at someone”
  why: The stored auxiliary belongs to a movement/approach reading, not to the only sense actually glossed.

- **anfallen** | `withSein; english` | severity=high | category=aux
  current: withSein=True; attack/set upon sb
  correct: withSein=False (`hat jemanden angefallen`) for the supplied attack sense; split off `ist angefallen` — accrued/arose
  why: The entry assigns the auxiliary of the accrue/arise sense to the transitive attack sense.

- **verirren** | `english` | severity=medium | category=gloss
  current: get lost
  correct: sich verirren — get lost/lose one's way
  why: The supplied everyday sense is reflexive in German.

- **ausströmen** | `withSein; english` | severity=high | category=aux
  current: UNSET (defaults to haben); emit/escape (of gas, smell)
  correct: Split transitive `hat etwas ausgeströmt` — emitted something from intransitive `ist ausgeströmt` — escaped/flowed out
  why: The current single auxiliary is false for the listed intransitive “escape” sense.

- **einreißen** | `withSein; english` | severity=high | category=aux
  current: withSein=False; tear down/get out of hand
  correct: Split transitive `hat etwas eingerissen` — tore something down from intransitive `ist eingerissen` — became widespread/got out of hand
  why: The two supplied senses take different auxiliaries, but the entry assigns `haben` to both.

- **unterlaufen** | `withSein; english` | severity=high | category=aux
  current: withSein=True; undermine/circumvent (Vorschriften unterlaufen)
  correct: withSein=False (`hat Vorschriften unterlaufen`) for circumvent/evade; reserve `sein` for `jemandem ist ein Fehler unterlaufen`
  why: The stored auxiliary contradicts the only glossed, transitive sense.

- **schämen** | `english` | severity=medium | category=gloss
  current: be ashamed
  correct: sich schämen — be ashamed
  why: The German verb is reflexive in this sense.

- **vorspielen** | `cefrLevel` | severity=medium | category=cefr
  current: A1
  correct: B1/B2
  why: The dative “perform/play something for someone” construction and the deceptive “pretend” sense are grossly beyond A1.

- **erschließen** | `cefrLevel` | severity=medium | category=cefr
  current: A1
  correct: B2/C1
  why: “Make accessible/develop/infer” is abstract, polysemous vocabulary and is grossly misassigned to the beginner deck.

- **aufpoppen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist aufgepoppt`)
  why: The intransitive “pop up” sense forms its Perfekt with `sein`.

- **hineinversetzen** | `english` | severity=medium | category=gloss
  current: put oneself into/empathise with
  correct: sich in jemanden/etwas hineinversetzen — put oneself in another's position/empathise with
  why: Both supplied senses require a reflexive pronoun and an `in` complement in German.

- **sehnen** | `english` | severity=medium | category=gloss
  current: long/yearn
  correct: sich nach jemandem/etwas sehnen — long/yearn for someone or something
  why: This sense is reflexive and governs `nach`.

- **bedanken** | `english` | severity=medium | category=gloss
  current: thank/express thanks
  correct: sich bei jemandem für etwas bedanken — thank someone/express thanks for something
  why: The standard construction is reflexive and uses `bei` for the person and `für` for the reason.

- **dazusetzen** | `english` | severity=medium | category=gloss
  current: sit down (next to)/join
  correct: sich dazusetzen — sit down beside the others/join them
  why: The only supplied sense is reflexive in German.

- **dazustellen** | `english` | severity=medium | category=gloss
  current: place oneself next to/join
  correct: sich dazustellen — go and stand beside the others/join them
  why: The glossed self-placement sense is reflexive; “place oneself” is also an unnatural learner translation.

- **herumschlagen** | `english` | severity=medium | category=gloss
  current: struggle around
  correct: sich mit jemandem/etwas herumschlagen — struggle/deal with someone or something
  why: The frequent idiomatic sense is reflexive and takes `mit`; “struggle around” is not natural English.

- **draufhauen** | `irregular; prateritum; perfekt` | severity=high | category=classification
  current: irregular=False; prateritum=UNSET; perfekt=UNSET
  correct: irregular=True; prateritum=haute/hieb drauf; perfekt=draufgehauen; withSein=False
  why: The compound inherits the non-regular participle `gehauen`; a regular derivation would teach the false form `draufgehaut`.

- **gewittern** | `english` | severity=low | category=gloss
  current: thunderstorm/be stormy
  correct: thunder/be stormy (impersonal: es gewittert)
  why: “Thunderstorm” is not an English verb, and the impersonal construction is useful learner information.

- **besagen** | `english` | severity=medium | category=gloss
  current: say
  correct: state/mean/indicate (of a text, rule, result, or evidence)
  why: `Besagen` is not the ordinary speech verb “say”; the broad gloss creates a high-frequency false equivalence with `sagen`.

- **vergewissern** | `english` | severity=medium | category=gloss
  current: make sure
  correct: sich einer Sache vergewissern / sich vergewissern, dass … — make sure/ascertain
  why: The standard modern construction is reflexive.

- **verwählen** | `english` | severity=medium | category=gloss
  current: dial a wrong number
  correct: sich verwählen — dial the wrong number/misdial
  why: The supplied sense is reflexive in German.

- **erfolgen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist erfolgt`)
  why: This frequent formal verb obligatorily forms its Perfekt with `sein`.

- **aufdrücken** | `english` | severity=medium | category=gloss
  current: press on
  correct: auf etwas drücken — press on something; jemandem etwas aufdrücken — foist/force something on someone; etwas aufdrücken — press something open
  why: Bare “press on” is ambiguous and misses the verb's important dative idiom, while it can also be mistaken for `auf etwas drücken`.

- **ereignen** | `english` | severity=medium | category=gloss
  current: occur
  correct: sich ereignen — occur/happen
  why: The supplied intransitive sense is reflexive in German.

- **ausreisen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist ausgereist`)
  why: This intransitive departure verb forms its Perfekt with `sein`.

- **sträuben** | `english` | severity=medium | category=gloss
  current: bristle
  correct: sich sträuben — bristle; resist/balk at something
  why: The ordinary literal and figurative senses are reflexive.

- **zurufen** | `english` | severity=low | category=gloss
  current: shout
  correct: jemandem etwas zurufen — call/shout something to someone
  why: The bare gloss loses the required direction toward a dative recipient and makes the word look synonymous with `schreien`.

- **gesellen** | `english` | severity=medium | category=gloss
  current: join
  correct: sich zu jemandem gesellen — join someone/go over to someone
  why: The ordinary modern verb is reflexive and governs `zu`.

- **aufkochen** | `withSein; english` | severity=high | category=aux
  current: UNSET (defaults to haben); boil up/bring to the boil
  correct: Split intransitive `ist aufgekocht` — boiled up from transitive `hat etwas aufgekocht` — brought something to the boil
  why: The gloss combines senses with different auxiliaries, while the app assigns `haben` to both.

- **wehren** | `english` | severity=medium | category=gloss
  current: defend
  correct: sich gegen jemanden/etwas wehren — defend oneself/resist/fight back
  why: Modern `wehren` in this sense is reflexive and normally takes `gegen`; bare transitive “defend” is misleading.

- **einstürmen** | `withSein; english` | severity=high | category=aux
  current: UNSET (defaults to haben); storm in
  correct: withSein=True (`ist auf jemanden eingestürmt`); gloss rush/storm at someone
  why: The verb takes `sein`, and its normal construction is `auf jemanden einstürmen`, not generic “storm in” (`hineinstürmen`).

- **hindurchgelangen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist hindurchgelangt`)
  why: `Gelangen` and its directional compounds form the Perfekt with `sein`.

- **strukturieren** | `cefrLevel` | severity=medium | category=cefr
  current: A2
  correct: B2
  why: This abstract organisational/academic verb is grossly under-levelled for an A2 learner deck.

- **verzetteln** | `english` | severity=medium | category=gloss
  current: get bogged down
  correct: sich verzetteln — get bogged down/spread oneself too thin/lose oneself in details
  why: The supplied idiomatic sense is reflexive in German.

- **entpuppen** | `english` | severity=medium | category=gloss
  current: turn out
  correct: sich als etwas entpuppen — turn out/reveal itself to be something
  why: The normal figurative construction is reflexive and governs `als`.

- **hinauswollen** | `irregular; prateritum; perfekt; english` | severity=high | category=classification
  current: irregular=False; prateritum=UNSET; perfekt=UNSET; want to go out
  correct: irregular=True; prateritum=wollte hinaus; perfekt=hinausgewollt; add `auf etwas hinauswollen` — be getting at/aim at something
  why: The compound inherits the irregular modal `wollen`, and the gloss omits its especially frequent abstract idiom.

- **zusammenhaben** | `irregular; prateritum; perfekt` | severity=high | category=classification
  current: irregular=False; prateritum=UNSET; perfekt=UNSET
  correct: irregular=True; prateritum=hatte zusammen; perfekt=zusammengehabt; withSein=False
  why: The compound inherits the irregular forms of `haben`; regular derivation would produce false forms.

- **herumirren** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist herumgeirrt`)
  why: In the supplied wandering/motion sense, the verb takes `sein`.

- **verzweigen** | `english` | severity=medium | category=gloss
  current: branch out
  correct: sich verzweigen — branch/fork; branch out
  why: The intransitive sense is reflexive in German.

- **aufraffen** | `english` | severity=medium | category=gloss
  current: pull oneself together
  correct: sich aufraffen — pull oneself together/muster the energy to do something
  why: The supplied sense is reflexive in German.

- **verpuffen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist verpufft`)
  why: The intransitive “fizzle out/come to nothing” verb takes `sein`.

- **wärmen** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A2/B1
  why: This basic concrete verb meaning “warm” is grossly over-levelled at C1.

- **ausschöpfen** | `english` | severity=low | category=gloss
  current: utilise
  correct: exploit/use fully/exhaust (a possibility, resource, or potential)
  why: Bare “utilise” misses the defining sense of using something to its full extent.

- **hingucken** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A2/B1
  why: This very common colloquial concrete verb meaning “look/watch” is grossly over-levelled at C1.

- **anmalen** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A1/A2
  why: The everyday concrete verb “paint/colour in” is grossly over-levelled at C1.

- **ausloggen** | `english` | severity=medium | category=gloss
  current: log out
  correct: sich ausloggen — log out/sign out
  why: The standard learner construction is reflexive.

- **missglücken** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist missglückt`)
  why: This intransitive failure/result verb forms its Perfekt with `sein`.

- **erschauern** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist erschauert`)
  why: The intransitive “shiver/shudder” verb conventionally takes `sein`.

- **totlachen** | `english` | severity=medium | category=gloss
  current: laugh oneself silly/laugh oneself to death
  correct: sich totlachen — laugh oneself silly/to death
  why: Both supplied senses require a reflexive pronoun in German.

- **einparken** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A2/B1
  why: This everyday driving verb meaning “park” is grossly over-levelled at C1.

- **breitmachen** | `english` | severity=medium | category=gloss
  current: spread out/take up space
  correct: sich breitmachen — spread oneself out/take up too much space; figuratively spread/proliferate
  why: The supplied core sense is reflexive in German.

- **durchbeißen** | `english` | severity=low | category=gloss
  current: bite through
  correct: bite through; sich durchbeißen — persevere/struggle through
  why: The gloss omits the very common reflexive figurative sense that learners are likely to encounter.

- **herumreisen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist herumgereist`)
  why: The supplied “travel around” motion sense takes `sein`.

- **verhelfen** | `english` | severity=medium | category=gloss
  current: help
  correct: jemandem zu etwas verhelfen — help someone obtain/achieve something
  why: Bare “help” falsely makes this look interchangeable with `helfen` and hides its required dative-plus-`zu` construction.

- **vorbeirasen** | `withSein` | severity=high | category=aux
  current: UNSET (defaults to haben)
  correct: withSein=True (`ist vorbeigerast`)
  why: This directed-motion verb forms its Perfekt with `sein`.

- **rätseln** | `english` | severity=medium | category=gloss
  current: puzzle
  correct: wonder/speculate/be puzzled; try to solve a riddle
  why: English transitive “puzzle” normally means “confuse”, so the bare gloss teaches the wrong valency and likely meaning.

- **weitererzählen** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A2/B1
  why: This transparent, everyday separable verb meaning “retell/pass on” is grossly over-levelled at C1.

- **zusammenfegen** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A2/B1
  why: This transparent concrete household verb is grossly over-levelled at C1.

- **danebenstellen** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A2/B1
  why: The transparent concrete meaning “place next to it” is grossly over-levelled at C1.

- **hochschauen** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A2/B1
  why: This common transparent verb meaning “look up” is grossly over-levelled at C1.

- **pieksen** | `cefrLevel` | severity=medium | category=cefr
  current: C1
  correct: A2/B1
  why: This common concrete colloquial verb meaning “prick/poke” is grossly over-levelled at C1.

- **zunicken** | `english` | severity=low | category=gloss
  current: nod
  correct: jemandem zunicken — nod to/at someone
  why: The dative-directed meaning distinguishes this verb from bare `nicken`; the current gloss loses that valency.

- **hineinleben** | `english` | severity=medium | category=gloss
  current: settle into/get used to
  correct: sich in etwas hineinleben — settle into/immerse oneself in/get used to something
  why: The supplied sense is reflexive and normally takes an `in` complement.

- **mitlesen** | `english` | severity=low | category=gloss
  current: to read along
  correct: read along
  why: Drop the English infinitive marker for consistency with the rest of the verb bank.

- **nachsprechen** | `english` | severity=low | category=gloss
  current: to repeat
  correct: repeat/repeat after someone
  why: Drop the infinitive marker and retain the “after someone” nuance contributed by `nach-`.

- **freihaben** | `irregular; prateritum; perfekt` | severity=high | category=classification
  current: irregular=False; prateritum=UNSET; perfekt=UNSET
  correct: irregular=True; prateritum=hatte frei; perfekt=freigehabt; withSein=False
  why: The compound inherits the irregular forms of `haben`; regular derivation would produce false forms.

- **zusammenpassen** | `english` | severity=low | category=gloss
  current: to fit together
  correct: fit together/match
  why: Drop the English infinitive marker for consistency with the rest of the verb bank.

- **drankommen** | `english` | severity=low | category=gloss
  current: to have one's turn
  correct: have one's turn/be next
  why: Drop the English infinitive marker for consistency with the rest of the verb bank.

- **rausgehen** | `english` | severity=low | category=gloss
  current: to go outside
  correct: go outside/go out
  why: Drop the English infinitive marker for consistency with the rest of the verb bank.

- **zuhaben** | `irregular; prateritum; perfekt; english` | severity=high | category=classification
  current: irregular=False; prateritum=UNSET; perfekt=UNSET; to be closed
  correct: irregular=True; prateritum=hatte zu; perfekt=zugehabt; withSein=False; gloss `be closed`
  why: The compound inherits the irregular forms of `haben`, and the English gloss should use the bank's bare-verb style.

- **zurückfahren** | `english` | severity=low | category=gloss
  current: to drive back
  correct: drive/go/travel back
  why: Drop the English infinitive marker; also avoid limiting the intransitive motion verb to driving when the means of transport can be unspecified.

## Clean
424 entries had no issues worth reporting.

## Coverage attestation
I manually evaluated all 542 rows in order, including the final row `zurückfinden`.
