# verbs_004 (reviewed 700 entries, source rows 2101–2800)

## Errors
- **verstreichen** | `withSein/english` | severity=high | category=aux
  current: `withSein=true`; “elapse/expire/fill in”
  correct: distinguish `ist verstrichen` for elapsed time from transitive `hat etwas verstrichen` for spreading/filling
  why: The single `sein` auxiliary is false for the listed transitive sense.

- **herantragen** | `english` | severity=medium | category=gloss
  current: “approach/bring over”
  correct: “carry/bring over; etw. an jdn. herantragen = put/propose something to someone”
  why: Plain “approach” hides the required transitive construction and suggests a nonexistent intransitive sense.

- **einprägen** | `english` | severity=medium | category=gloss
  current: “impress/imprint/memorise”
  correct: “impress/imprint; sich etw. einprägen = memorise/commit something to memory”
  why: The everyday “memorise” sense is reflexive and takes the thing memorised in the accusative.

- **konstituieren** | `english` | severity=medium | category=gloss
  current: “assemble/constitute/convene”
  correct: “constitute; sich konstituieren = form/constitute itself, convene”
  why: A body assembling or convening is normally expressed reflexively.

- **verschlucken** | `english` | severity=medium | category=gloss
  current: “choke/swallow”
  correct: “swallow; sich verschlucken = choke/swallow the wrong way”
  why: “Choke” is the reflexive construction, whereas transitive `verschlucken` means swallow.

- **bummeln** | `withSein/english` | severity=medium | category=aux
  current: `withSein=true`; “loiter”
  correct: “stroll (sein); dawdle/loaf/idle (haben)” and keep the auxiliary sense-specific
  why: German uses `sein` for strolling movement but `haben` for dawdling or idling, which is closer to “loiter”.

- **dirigieren** | `cefrLevel` | severity=medium | category=cefr
  current: `A1`
  correct: move to approximately B1
  why: “Conduct (an orchestra)” is not realistic A1 productive vocabulary.

- **hochfahren** | `cefrLevel` | severity=medium | category=cefr
  current: `A1`
  correct: move the computing sense to approximately B1
  why: The separable technical verb “boot” is grossly advanced for an A1 deck.

- **tappen** | `withSein/english` | severity=high | category=aux
  current: `withSein=true`; “grope”
  correct: `withSein=false` for “nach etw. tappen = grope/feel for”; alternatively gloss the movement sense that takes `sein`
  why: The listed groping sense forms its perfect with `haben`; `sein` belongs to movement such as `durchs Zimmer tappen`.

- **abzweigen** | `withSein/english` | severity=medium | category=aux
  current: `withSein=true`; “branch off/put aside/set aside”
  correct: distinguish intransitive “branch off” (`ist abgezweigt`) from transitive “divert/set aside” (`hat abgezweigt`)
  why: One auxiliary cannot correctly cover both listed valencies.

- **anbrechen** | `withSein/english` | severity=high | category=aux
  current: `withSein=true`; “begin/break/start”
  correct: distinguish intransitive time/day beginning (`ist angebrochen`) from opening/breaking into something (`hat angebrochen`)
  why: The irregular-forms card currently attaches `sein` to a mixed gloss containing a common transitive `haben` sense.

- **einschreiten** | `withSein` | severity=high | category=aux
  current: `False`
  correct: `True` (`ist eingeschritten`)
  why: `einschreiten` forms the perfect with `sein` in the listed “intervene/step in” sense.

- **plaudern** | `cefrLevel` | severity=medium | category=cefr
  current: `C1`
  correct: move to approximately A2–B1
  why: The everyday verb “chat” is grossly too late at C1.

- **überreden** | `english` | severity=high | category=gloss
  current: “cajole/persuade/talk over”
  correct: “persuade/talk someone into something”
  why: English “talk something over” means discuss it, not persuade someone.

- **aufrichten** | `english` | severity=medium | category=gloss
  current: “erect/raise/sit up”
  correct: “erect/raise; sich aufrichten = sit up/straighten up”
  why: The intransitive-looking “sit up” translation requires the reflexive pronoun.

- **erlösen** | `english` | severity=medium | category=gloss
  current: “deliver/earn/release”
  correct: “redeem/deliver/free from suffering; fetch/raise/realise (a sum)”
  why: Plain “earn” wrongly suggests the ordinary `verdienen` sense.

- **hungern** | `english` | severity=medium | category=gloss
  current: “be hungry/hunger/starve”
  correct: “go hungry/starve; hunger for”
  why: Merely feeling hungry is `Hunger haben`, not normally `hungern`.

- **hüten** | `english` | severity=medium | category=gloss
  current: “guard/protect; beware”
  correct: “guard/tend; sich vor etw. hüten = beware of/guard against something”
  why: “Beware” is reflexive and requires `vor` plus dative.

- **jucken** | `english` | severity=medium | category=gloss
  current: “itch/scratch”
  correct: “itch; bother/interest (colloquial)” and remove plain “scratch”
  why: Standard German for scratching an itch is `kratzen`; plain `jucken` means itch.

- **verheißen** | `english` | severity=medium | category=gloss
  current: “promise”
  correct: “promise/foretell; bode/portend (often `nichts Gutes verheißen`)”
  why: The bare gloss invites confusion with everyday interpersonal `versprechen` and omits the verb’s characteristic use.

- **verschmutzen** | `withSein/english` | severity=high | category=aux
  current: `withSein=UNSET` (treated as `haben`); gloss itself says “sein when intransitive”
  correct: model both: transitive `hat etw. verschmutzt`, intransitive `etw. ist verschmutzt`
  why: The stored default contradicts the explicitly listed intransitive construction.

- **schleifen** | `irregular/prateritum/perfekt` | severity=high | category=classification
  current: `irregular=false`, forms unset; “drag/drill/grind”
  correct: split senses: “drag/grind/sharpen” = `schliff, geschliffen`; military “drill” = `schleifte, geschleift`
  why: The dominant listed senses are strong, so treating the whole entry as regular teaches false forms.

- **schwertun** | `english` | severity=medium | category=gloss
  current: “have difficulty/find difficult”
  correct: “sich mit etw. schwertun = have difficulty with/find something difficult”
  why: The verb is used reflexively in this sense.

- **zurückbilden** | `english` | severity=medium | category=gloss
  current: “recede/regress”
  correct: “sich zurückbilden = recede/regress; etw. zurückbilden = reduce/reverse something”
  why: Both current English senses normally correspond to the reflexive construction.

- **zurückhaben** | `irregular/prateritum/perfekt/english` | severity=high | category=classification
  current: `irregular=false`, forms unset; “ich will mein Geld zurückhaben”
  correct: `irregular=true`, `hatte zurück`, `zurückgehabt`; English “have/get back”
  why: A compound of irregular `haben` is irregular, and the English field currently contains only a German example.

- **aufregen** | `english` | severity=medium | category=gloss
  current: “excite/upset”
  correct: “upset/agitate; sich aufregen = get upset/work oneself up”
  why: The very common learner use is reflexive and is not shown.

- **bedrängen** | `english` | severity=medium | category=gloss
  current: “press hard”
  correct: “press/harass/pester/corner”
  why: “Press hard” is vague and is likely to be read as physically pushing firmly rather than putting someone under pressure.

- **rächen** | `english` | severity=medium | category=gloss
  current: “avenge/cost dearly/pay the price”
  correct: “avenge; sich rächen = take revenge; sich rächen = backfire/have bad consequences”
  why: The latter senses are reflexive, and “pay the price” does not directly state the German construction.

- **vereidigen** | `english` | severity=high | category=gloss
  current: “put under oath/swear an oath/take an oath”
  correct: “swear someone in/administer an oath to someone”
  why: `vereidigen` is transitive; “take/swear an oath” wrongly makes the oath-taker its subject.

- **bereiterklären** | `english` | severity=medium | category=gloss
  current: “agree”
  correct: “sich bereiterklären/bereit erklären, etw. zu tun = agree/be willing to do something”
  why: This sense is reflexive; both joined and spaced spellings are valid, but the reflexive pronoun is essential.

- **erkaufen** | `english` | severity=medium | category=gloss
  current: “bribe/buy/pay”
  correct: “obtain/buy at a cost; sich etw. erkaufen = secure something at a price”
  why: `erkaufen` does not ordinarily mean “bribe”, and plain “buy/pay” loses its characteristic cost/means construction.

- **erübrigen** | `english` | severity=medium | category=gloss
  current: “become unnecessary/remain/spare”
  correct: “sich erübrigen = become unnecessary; etw. erübrigen = spare something”
  why: “Become unnecessary” is reflexive, while plain “remain” is not an accurate general gloss.

- **outen** | `english` | severity=medium | category=gloss
  current: “come out of the closet/out”
  correct: “jdn. outen = out someone; sich outen = come out”
  why: The listed intransitive English sense requires German reflexive `sich`.

- **rentieren** | `english` | severity=medium | category=gloss
  current: “pay off/be worthwhile”
  correct: “sich rentieren = pay off/be worthwhile”
  why: Modern standard usage for this sense is reflexive.

- **verrutschen** | `withSein` | severity=high | category=aux
  current: `UNSET` (treated as `haben`)
  correct: `True` (`ist verrutscht`)
  why: The intransitive “slip/shift out of place” verb forms its perfect with `sein`.

- **einnisten** | `english` | severity=medium | category=gloss
  current: “implant/nest/settle down”
  correct: “sich einnisten = nest/settle in; sich [in der Gebärmutter] einnisten = implant”
  why: The listed senses are reflexive in German.

- **scheren** | `prateritum/perfekt/english` | severity=high | category=verbform
  current: `schor, geschoren`; “care/mind/shear”
  correct: split “shear” = `schor, geschoren` from “sich um etw. scheren = care/mind” = `scherte, geschert`
  why: German has strong and weak paradigms by sense; the current card teaches the strong forms for “care/mind”.

- **schminken** | `english` | severity=medium | category=gloss
  current: “make up”
  correct: “apply make-up to; sich schminken = put on/apply make-up”
  why: “Make up” is ambiguous in English and the ordinary self-directed German use is reflexive.

- **verblassen** | `withSein` | severity=high | category=aux
  current: `UNSET` (treated as `haben`)
  correct: `True` (`ist verblasst`)
  why: The intransitive change-of-state verb “fade” forms the perfect with `sein`.

- **vollstrecken** | `english` | severity=high | category=gloss
  current: “execute/terminate”
  correct: “enforce/execute (a judgment, sentence or order)”
  why: `vollstrecken` does not generally mean “terminate”.

- **zurückfallen** | `english` | severity=medium | category=gloss
  current: “drop back/fall behind/reflect on somebody”
  correct: “drop back/fall behind; auf jdn. zurückfallen = reflect badly on someone”
  why: Omitting “badly” and the `auf` construction makes the figurative English sense misleading.

- **aufhellen** | `english` | severity=medium | category=gloss
  current: “be cleared up/become clear/brighten up”
  correct: “brighten/lighten; sich aufhellen = brighten/clear up”
  why: The intransitive weather/mood sense is reflexive in German.

- **umfahren** | `english` | severity=medium | category=gloss
  current: `umfuhr, umfahren`; “bypass/drive round/round”
  correct: retain inseparable “drive around/bypass”, but add separable `fuhr um, umgefahren = knock/run over`
  why: The omitted separable homograph is common and has different stress, forms and meaning.

- **zollen** | `english` | severity=medium | category=gloss
  current: “pay”
  correct: “jdm. etw. zollen = pay/show someone something (respect, tribute, recognition)”
  why: Plain “pay” is far too broad and hides the restricted objects and dative valency.

- **ausprägen** | `english` | severity=medium | category=gloss
  current: “develop/express/mint”
  correct: “mint/imprint; sich ausprägen = develop/become pronounced”
  why: The intransitive “develop” sense is reflexive.

- **draufhaben** | `irregular/prateritum/perfekt` | severity=high | category=classification
  current: `irregular=false`, forms unset
  correct: `irregular=true`, `hatte drauf`, `draufgehabt`
  why: The compound retains the irregular forms of `haben`.

- **hinsetzen** | `english/cefrLevel` | severity=medium | category=gloss
  current: “put down/sit down”; `C1`
  correct: “jdn./etw. hinsetzen = seat/put down; sich hinsetzen = sit down”; approximately A1–A2
  why: “Sit down” requires the reflexive, and this elementary verb is grossly misplaced at C1.

- **zerren** | `english` | severity=medium | category=gloss
  current: “drag/rip up/strain”
  correct: “drag/tug/yank; strain”
  why: “Rip up” is normally `zerreißen`, not `zerren`.

- **wiederhaben** | `irregular/prateritum/perfekt` | severity=high | category=classification
  current: `irregular=false`, forms unset
  correct: `irregular=true`, `hatte wieder`, `wiedergehabt`
  why: The compound retains the irregular forms of `haben`.

- **fristen** | `english` | severity=high | category=gloss
  current: “keep alive/sustain”
  correct: “sein Dasein/Leben fristen = eke out/live out an existence”
  why: The verb is restricted to constructions such as `ein kümmerliches Dasein fristen`; it is not a general verb for sustaining something.

- **klammern** | `english` | severity=medium | category=gloss
  current: “bracket/cling”
  correct: “clamp/bracket; sich an jdn./etw. klammern = cling to someone/something”
  why: “Cling” requires the reflexive construction and `an` plus accusative.

- **weggehen** | `cefrLevel` | severity=medium | category=cefr
  current: `C1`
  correct: move to approximately A1–A2
  why: “Go away/leave” is elementary everyday vocabulary, not C1.

- **buhlen** | `english` | severity=medium | category=gloss
  current: “court/have a love affair/suck up”
  correct: “um jdn./etw. buhlen = vie/compete for; court/woo”
  why: The verb does not mean “have a love affair”; “suck up” is at best an indirect contextual implication.

- **einengen** | `english` | severity=medium | category=gloss
  current: “concentrate/narrow”
  correct: “narrow/restrict/confine”
  why: `einengen` does not generally mean “concentrate”.

- **hervortun** | `english` | severity=medium | category=gloss
  current: “excel”
  correct: “sich hervortun = distinguish oneself/excel”
  why: The verb is reflexive in this sense.

- **hocken** | `english` | severity=medium | category=gloss
  current: “lounge around/sit down/squat”
  correct: “squat/crouch/sit/be sitting”
  why: `hocken` describes a position, not the action “sit down” (`sich hinsetzen`).

- **keimen** | `english` | severity=low | category=gloss
  current: “germinate/pullulate/sprout”
  correct: “germinate/sprout”
  why: “Pullulate” is extremely rare English and is unsuitable learner-facing vocabulary here.

- **mutieren** | `english` | severity=high | category=gloss
  current: “crack/mutate”
  correct: “mutate/change into”
  why: `mutieren` does not mean that something cracks.

- **verbünden** | `english` | severity=medium | category=gloss
  current: “ally”
  correct: “sich mit jdm. verbünden = ally oneself with someone/form an alliance”
  why: The normal modern construction is reflexive.

- **bröckeln** | `withSein/english` | severity=high | category=aux
  current: `withSein=true`; “break/crumble/disappear”
  correct: use `haben` for “crumble/disintegrate” (`hat gebröckelt`) and `sein` only for directional detachment such as `von der Wand gebröckelt`
  why: The listed generic senses do not justify teaching `sein` as their sole auxiliary.

- **aberkennen** | `english` | severity=medium | category=gloss
  current: “deprive”
  correct: “jdm. etw. aberkennen = deprive someone of/revoke/withdraw something”
  why: The bare gloss hides the required dative-plus-accusative valency and the usual revocation sense.

- **ausatmen** | `english` | severity=high | category=gloss
  current: “breathe out/draw one's last breath/exhale”
  correct: “breathe out/exhale”
  why: “Draw one’s last breath” means die and is not a standard sense of `ausatmen`.

- **entkernen** | `english` | severity=low | category=gloss
  current: “pit”
  correct: “core/stone/remove the seeds or stones from”
  why: “Pit” is chiefly American; the bank is intended for British-English learners and the verb also covers cores and seeds.

- **fortpflanzen** | `english` | severity=medium | category=gloss
  current: “procreate”
  correct: “sich fortpflanzen = reproduce/procreate; etw. fortpflanzen = propagate/transmit”
  why: Living beings procreating is expressed reflexively in German.

- **mausern** | `english` | severity=low | category=gloss
  current: “moult”
  correct: retain “moult”, and add “sich mausern = develop/blossom/come on”
  why: The common figurative reflexive sense is useful and otherwise opaque to learners.

- **mitschwingen** | `english` | severity=medium | category=gloss
  current: “contain/resonate”
  correct: “resonate/reverberate; be implicit/present as an undertone”
  why: Plain transitive “contain” gives the wrong valency and overstates the figurative meaning.

- **schränken** | `english` | severity=high | category=gloss
  current: “restrict”
  correct: delete as an everyday “restrict” item or give its rare specialist senses; use `einschränken` for “restrict”
  why: Standalone `schränken` does not have the ordinary meaning taught by this gloss.

- **verspäten** | `english` | severity=medium | category=gloss
  current: “be late”
  correct: “sich verspäten = be late/be delayed”
  why: The ordinary sense is reflexive.

- **abschauen** | `english` | severity=medium | category=gloss
  current: “copy/peek”
  correct: “jdm. etw. abschauen = copy/learn something by watching someone”
  why: Plain “peek” is not an accurate standard translation and the characteristic double-object valency is omitted.

- **amortisieren** | `english` | severity=medium | category=gloss
  current: “amortise/pay itself off”
  correct: “amortise; sich amortisieren = pay for itself/pay off”
  why: “Pay itself off” corresponds to the reflexive construction.

- **aufgießen** | `english` | severity=medium | category=gloss
  current: “add water/make/pour in”
  correct: “pour water/liquid onto or over; brew/infuse; top up”
  why: “Make” and “pour in” are too vague and do not teach the verb’s normal liquid construction.

- **aufstecken** | `english` | severity=medium | category=gloss
  current: “put on”
  correct: “fit/attach; put up (hair); put/place on top”
  why: Generic “put on” is too broad to identify when this separable verb can actually be used.

- **aufwecken** | `english` | severity=low | category=gloss
  current: “awake/wake up”
  correct: “wake/awaken someone; wake someone up”
  why: The German verb is transitive, while the current gloss can be read as intransitive “wake up”.

- **auswerfen** | `english` | severity=medium | category=gloss
  current: “cough up/produce”
  correct: “throw/cast/eject/expel; cough up; yield/produce”
  why: The gloss omits the core literal senses and leaves only two contextual extensions.

- **inhalieren** | `cefrLevel` | severity=medium | category=cefr
  current: `A1`
  correct: move to approximately B1–B2
  why: This Latinate medical verb is grossly advanced for A1.

- **liebäugeln** | `english` | severity=medium | category=gloss
  current: “fancy/ogle”
  correct: “mit etw. liebäugeln = toy with/consider/fancy the idea of; cast amorous glances”
  why: Plain “ogle” overstates the personal sense and omits the very common `mit` construction for considering an option.

- **reglementieren** | `english` | severity=medium | category=gloss
  current: “regularise/regulate”
  correct: “regulate/control/restrict by rules”
  why: “Regularise” means make regular or legitimate and is not a reliable translation here.

- **übergießen** | `prateritum/perfekt/english` | severity=high | category=verbform
  current: `goss über, übergegossen`; “pour over/douse; spill over”
  correct: for “pour over/douse”, use inseparable `übergoss, übergossen`; split off separable `über|gießen = decant/pour across` if wanted
  why: The stored separable forms do not belong to the dominant listed sense.

- **untertauchen** | `withSein/english` | severity=medium | category=aux
  current: `withSein=true`; “submerge”
  correct: “dive/submerge oneself/go into hiding” with `sein`; transitive “submerge/dip something” takes `haben`
  why: English “submerge” is transitive or intransitive, but the stored auxiliary only fits the latter German valency.

- **anbrennen** | `english` | severity=medium | category=gloss
  current: “burn/kindle/light”
  correct: “scorch/burn (onto a pan); start burning”
  why: Modern `anbrennen` is not the ordinary verb for kindling or lighting something (`anzünden`).

- **anklopfen** | `english` | severity=medium | category=gloss
  current: “approach/knock/touch”
  correct: “knock; bei jdm. anklopfen = approach/sound someone out”
  why: Plain “touch” is false, and “approach” is only a figurative prepositional construction.

- **abschotten** | `english` | severity=medium | category=gloss
  current: “encapsulate/seal off”
  correct: “seal off/isolate; sich abschotten = shut oneself off”
  why: “Encapsulate” is not the normal meaning and risks confusion with “summarise”.

- **ausreißen** | `withSein/english` | severity=high | category=aux
  current: `withSein=false`; gloss explicitly includes “intransitive, with sein = run away”
  correct: split transitive `hat etw. ausgerissen` from intransitive `ist ausgerissen`
  why: The irregular-forms card teaches `haben` while the same entry explicitly lists a common `sein` sense.

- **kitzeln** | `cefrLevel` | severity=medium | category=cefr
  current: `C1`
  correct: move to approximately A2–B1
  why: The concrete everyday verb “tickle” is grossly too late at C1.

## Clean
616 entries had no issues worth reporting.

## Coverage attestation
I manually evaluated all 700 rows in order, including the final row `lichten`.
