#!/usr/bin/env python3
"""Batch 3: adjective blanks rank 1999-3500."""
import json, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent

ADJ = {
    'ressourcenschonend':'resource-saving / sustainable','soziokulturell':'sociocultural',
    'verkaufsoffen':'open for business (Sunday/holiday)','befähigt':'qualified / capable',
    'erdenklich':'imaginable / conceivable','erwerbstätig':'gainfully employed',
    'mehrwöchig':'lasting several weeks','überzogen':'excessive / overdrawn',
    'ursächlich':'causal','valide':'valid','dörflich':'village-like / rural',
    'gegensätzlich':'opposing / contradictory','öffentlichkeitswirksam':'effective in publicity / high-profile',
    'stillgelegt':'shut down / decommissioned','stimmberechtigt':'eligible to vote',
    'nachgeordnet':'subordinate','auffindbar':'findable / locatable',
    'erzgebirgisch':'of the Erzgebirge / Ore Mountains','geriatrisch':'geriatric',
    'kommentiert':'commented / annotated','platziert':'placed / positioned',
    'vierteljährlich':'quarterly','antragsberechtigt':'entitled to apply',
    'beiliegend':'enclosed / attached','grundständig':'basic / undergraduate',
    'lichtdurchflutet':'light-flooded / sun-drenched','märchenhaft':'fairy-tale / magical',
    'selbstgebacken':'home-baked','überbetrieblich':'inter-company / cross-company',
    'unspezifisch':'unspecific / nonspecific','verziert':'decorated / ornamented',
    'vorgelagert':'upstream / outlying','abgesichert':'secured / safeguarded',
    'neuerlich':'renewed / once again','neunjährig':'nine-year-old / nine-year',
    'vierwöchig':'four-week / lasting four weeks','zünftig':'proper / hearty / traditional',
    'ausgewachsen':'fully grown / mature','dominiert':'dominated',
    'kabelgebunden':'wired / cable-connected','langanhaltend':'long-lasting',
    'minimalinvasiv':'minimally invasive','allgemeingültig':'universally valid',
    'altehrwürdig':'venerable / time-honoured','funktionstüchtig':'functional / operational',
    'gastgebend':'hosting','museal':'museum-like / museum-quality',
    'pädiatrisch':'paediatric','überfachlich':'cross-disciplinary',
    'unverfälscht':'unadulterated / genuine','wildlebend':'living in the wild',
    'alpin':'alpine','höhenverstellbar':'height-adjustable','krebskrank':'suffering from cancer',
    'topographisch':'topographical','zweigeschossig':'two-storey',
    'atmungsaktiv':'breathable','handgefertigt':'handcrafted','hochklassig':'top-class',
    'hoteleigen':'hotel-owned','personal':'personal','pommersch':'Pomeranian',
    'rückwärtig':'rear / back','untypisch':'atypical','wildromantisch':'wildly romantic',
    'asphaltiert':'asphalted','automobil':'automotive','dreistündig':'three-hour',
    'durchlässig':'permeable / pervious','europarechtlich':'under European law',
    'fachpraktisch':'practical (in a specialty)','feststehend':'fixed / firm / established',
    'ionisierend':'ionizing','nachgefragt':'in demand','übergroß':'oversized',
    'übersetzt':'translated','ungesättigt':'unsaturated','elfjährig':'eleven-year-old',
    'generationenübergreifend':'cross-generational','kostendeckend':'cost-covering / break-even',
    'reaktiv':'reactive','themenbezogen':'topic-related','tiefgehend':'deep / profound',
    'trübe':'cloudy / murky / dim','verkehrsgünstig':'conveniently located (transport-wise)',
    'weltanschaulich':'ideological / philosophical','beendet':'finished / ended',
    'dreiteilig':'three-part','dreiwöchig':'three-week','erstinstanzlich':'first-instance (court)',
    'fachgebunden':'subject-restricted','gestützt':'supported / based on',
    'gewerbsmäßig':'commercial / professional','kosteneffizient':'cost-efficient',
    'nahestehend':'close to / closely associated','sexistisch':'sexist',
    'unübersehbar':'unmistakable / glaring','vierköpfig':'four-person / of four',
    'viertägig':'four-day','antragstellend':'applying / petitioning',
    'ernstzunehmend':'to be taken seriously','gefürchtet':'feared / dreaded',
    'kilometerlang':'kilometres long','kunsthistorisch':'art-historical',
    'mittelschwer':'moderately severe / medium-heavy','naturverträglich':'environmentally compatible',
    'nichtstaatlich':'non-governmental','orangen':'orange (colour)',
    'batteriebetrieben':'battery-powered','beiderseitig':'mutual / on both sides',
    'generationsübergreifend':'cross-generational','halbstündig':'half-hour',
    'investiv':'investment-related','manipuliert':'manipulated',
    'niederschwellig':'low-threshold / easily accessible','rechtsradikal':'far-right / radically right-wing',
    'suchtkrank':'addicted','unsachgemäß':'improper / inappropriate',
    'beengt':'cramped / confined','bildungsfern':'with little formal education',
    'blöde':'stupid / silly','eigentümlich':'peculiar / characteristic',
    'existentiell':'existential','geschlechtergerecht':'gender-equitable',
    'hochinteressant':'highly interesting','mehrmonatig':'lasting several months',
    'milliardenschwer':'billion-euro / multi-billion','reell':'real / honest',
    'schnelllebig':'fast-paced','sportwissenschaftlich':'sport-scientific',
    'unbebaut':'undeveloped / unbuilt','unternehmenseigen':'company-owned',
    'verwunderlich':'surprising','vierstündig':'four-hour','abgebrochen':'broken off / aborted',
    'allgemeinverständlich':'generally understandable','arbeitsmedizinisch':'occupational-medicine',
    'aufsuchend':'outreach / visiting','berufen':'qualified / called','demenzkrank':'suffering from dementia',
    'innig':'heartfelt / intimate','kleinteilig':'small-scale / fragmented',
    'selbsternannt':'self-proclaimed','sozialverträglich':'socially acceptable',
    'vielgestaltig':'multifaceted / varied','wasserführend':'water-bearing',
    'auslösend':'triggering','dosiert':'measured / dosed','erforscht':'researched / explored',
    'fünfköpfig':'five-person','randomisiert':'randomized','siebenjährig':'seven-year-old',
    'solarthermisch':'solar-thermal','termingerecht':'on schedule / on time',
    'trainiert':'trained','unangemeldet':'unannounced / unregistered',
    'unbefestigt':'unpaved / unfortified','uneben':'uneven','zwölfjährig':'twelve-year-old',
    'beklemmend':'oppressive / suffocating','binational':'binational',
    'gewaltbereit':'prone to violence','gewöhnungsbedürftig':'an acquired taste',
    'gutbürgerlich':'good middle-class / traditional (cuisine)','meistbesucht':'most-visited',
    'neugegründet':'newly founded','niederrheinisch':'Lower Rhine',
    'sechswöchig':'six-week','stromsparend':'energy-saving','unangekündigt':'unannounced',
    'unbelastet':'unburdened / untainted','ureigen':'one\'s very own / inherent',
    'voluminös':'voluminous','einfarbig':'single-coloured / monochrome',
    'energieintensiv':'energy-intensive','finanzschwach':'financially weak',
    'floral':'floral','fünfstündig':'five-hour','höchstgelegen':'highest-altitude',
    'identitätsstiftend':'identity-forming','inaktiv':'inactive',
    'jederzeitig':'at any time / anytime','kilometerweit':'for kilometres',
    'kryptographisch':'cryptographic','kulturgeschichtlich':'cultural-historical',
    'prioritär':'priority','punktgleich':'tied on points','sachverständig':'expert / qualified',
    'sanierungsbedürftig':'in need of renovation','streitgegenständlich':'in dispute / contested',
    'südwestdeutsch':'southwest German','überbordend':'overflowing / exuberant',
    'unwegsam':'impassable / rough','verdünnt':'diluted','vergoldet':'gold-plated / gilded',
    'vierteilig':'four-part','zweimonatig':'two-month','abgegrenzt':'delineated / demarcated',
    'doppelseitig':'double-sided / bilateral','einkommensschwach':'low-income',
}

def main():
    p = ROOT/'data'/'adjectives.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    by = {a['word']:a for a in d['adjectives']}
    f=nb=nf=0
    for w,en in ADJ.items():
        a = by.get(w)
        if not a: nf+=1; continue
        if a.get('english','').strip(): nb+=1; continue
        a['english']=en; f+=1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"  filled: {f}, already-filled: {nb}, not-in-dataset: {nf}")

if __name__=='__main__': main()
