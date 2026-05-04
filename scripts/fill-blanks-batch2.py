#!/usr/bin/env python3
"""Batch 2: noun blanks rank 7000-10000."""
import json, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent

NOUNS = {
    'Schnupfen':'cold / runny nose','Screen':'screen','Stilllegung':'shutdown / decommissioning',
    'Streichung':'cancellation / cutting','Unverständnis':'lack of understanding',
    'Verschärfung':'tightening / intensification','Zelte':'tents','Bauamt':'building authority',
    'Beanspruchung':'strain / demand','Lacke':'puddle (Austrian) / lacquer','Marker':'marker',
    'Modalität':'modality','Ortsvorsteher':'local mayor / village leader',
    'Unterschiedlichkeit':'diversity / difference','Zuzug':'influx / arrival of new residents',
    'Datenschützer':'data protection officer','Eckdaten':'key data / key figures',
    'Spielerei':'plaything / gimmick','Trommeln':'drumming','Ausbilderin':'instructor (female)',
    'Beglaubigung':'certification / attestation','Dirndl':'dirndl (traditional dress)',
    'Eck':'corner','Emittent':'issuer','Fotografin':'photographer (female)',
    'Friede':'peace','Pedale':'pedal','Rekrutierung':'recruitment',
    'Sample':'sample','Schirmherrin':'patroness','Zusammenlegung':'merger / consolidation',
    'Bauhof':'public works yard','Entertainment':'entertainment','Finder':'finder',
    'Genießer':'connoisseur / one who enjoys','Händchen':'little hand / knack',
    'Kennung':'identifier / call sign','Pedelec':'pedelec / electric bicycle',
    'Sinnhaftigkeit':'meaningfulness','Teilstück':'section / piece','Touristik':'tourism industry',
    'Wifi':'Wi-Fi','WiFi':'Wi-Fi','Anlieferung':'delivery','Beisitzer':'assessor / juror',
    'Buchs':'box tree / boxwood','Bundesligist':'Bundesliga team','Comedy':'comedy',
    'Entertainer':'entertainer','Feiger':'coward','Konnektivität':'connectivity',
    'Reporterin':'reporter (female)','Spanne':'span / range / margin','Voliere':'aviary',
    'Au':'meadow / floodplain','Aufräumen':'tidying up','Bares':'cash',
    'Bloggerin':'blogger (female)','Clan':'clan','Harmonisierung':'harmonization',
    'Hiphop':'hip hop','Hotellerie':'hotel industry','Kenntnisnahme':'taking note / acknowledgement',
    'Klarer':'clear schnapps','Mittler':'mediator / intermediary','Parfum':'perfume',
    'Seebad':'seaside resort','Sticker':'sticker','Tutorin':'tutor (female)',
    'Verschwiegenheit':'confidentiality / discretion','Anwohnerin':'resident (female)',
    'Aufmachung':'design / appearance / get-up','Ausbildender':'instructor / trainer',
    'Fossilie':'fossil','Frankfurter':'Frankfurter (resident or sausage)',
    'Gaming':'gaming','Gänze':'entirety','Gemäuer':'walls / masonry / old building',
    'Pastorin':'pastor (female)','Schönste':'most beautiful one','Szenerie':'scenery / setting',
    'Winterspiele':'Winter Games','Anziehen':'getting dressed / putting on','Beat':'beat (music)',
    'Berlinerin':'Berliner (female)','Einholung':'obtaining / collecting','Förde':'fjord / firth',
    'Graphik':'graphic / chart','Grau':'grey','Halde':'heap / spoil tip',
    'Masters':'Masters (golf tournament)','Rentnerin':'pensioner (female)',
    'Tanke':'gas station (colloquial)','Bremer':'Bremen resident','Burnout':'burnout',
    'CEO':'CEO','Dreier':'three / threesome / three-pointer','Erwachsenwerden':'growing up',
    'Esprit':'wit / esprit','Helikopter':'helicopter','Kartierung':'mapping / cartography',
    'Mikro':'mic / microphone','Plausibilität':'plausibility','Requisite':'prop / requisite',
    'Röhren':'pipes / tubes / antlers (hunting)','Rückkehrer':'returner','Turnus':'rotation / cycle',
    'Verengung':'narrowing / constriction','Verurteilter':'convicted person','Werber':'advertiser / suitor',
    'Ahne':'ancestor','Angleichung':'alignment / harmonization','AStA':'student council (Allgemeiner Studierendenausschuss)',
    'Bahncard':'BahnCard (DB rail discount card)','Brüdergemeine':'Moravian Church',
    'Business':'business','Erstplatzierter':'first-place finisher','Etwas':'something',
    'Extrem':'extreme','Festhalten':'holding on / clinging','Final':'final',
    'Fötus':'foetus','Gebrüder':'brothers','Gefüge':'structure / fabric',
    'Glukose':'glucose','Initiatorin':'initiator (female)','Innung':'guild',
    'Instabilität':'instability','Konservatorium':'conservatory (music)','Mini':'mini',
    'Range':'range','Scherben':'shards / pieces of broken glass','Verhältnismäßigkeit':'proportionality',
    'Wilder':'wild one / savage','Aufforstung':'reforestation','Belieferung':'supply / delivery',
    'Bravour':'bravura','Break':'break','Ernsthaftigkeit':'seriousness','Evergreen':'evergreen / classic',
    'Famulatur':'medical clerkship / internship','Forschungsdaten':'research data',
    'Frame':'frame','Fräse':'milling machine / cutter','Hackathon':'hackathon',
    'Kalzium':'calcium','Menschenfeindlichkeit':'misanthropy','Örtchen':'little place / loo',
    'Protagonistin':'protagonist (female)','Regelmäßigkeit':'regularity','Rheuma':'rheumatism',
    'Spa':'spa','Tinnitus':'tinnitus','Trocknung':'drying',
    'Verliebter':'person in love','Verwalten':'administering / managing','Wirkungsweise':'mode of action',
    'Ziehen':'pulling / drawing','Avis':'notification (commercial)','Bildhauerei':'sculpture',
    'Eingewöhnung':'settling in / acclimatization','Flexibilisierung':'making more flexible',
    'Funken':'spark','Gros':'majority / bulk','Hallig':'small marshy island (North Sea)',
    'Körner':'grains','Kosmetikum':'cosmetic product','Loop':'loop',
    'Lüften':'airing / ventilating','Magenta':'magenta','Pflänzchen':'little plant',
    'Rack':'rack','Radikaler':'radical (person)','Schliff':'cut / polish / finesse',
    'Spenderin':'donor (female)','Sprössling':'offspring / sprig','Studienanfängerin':'first-year student (female)',
    'Symphonie':'symphony','Symptomatik':'symptomatology','Überlassung':'transfer / handing over',
    'Übersetzerin':'translator (female)','Bibliographie':'bibliography','Denke':'mindset / way of thinking',
}

def main():
    p = ROOT/'data'/'nouns.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    by = {n['word']:n for n in d['nouns']}
    f=nb=nf=0
    for w,en in NOUNS.items():
        n = by.get(w)
        if not n: nf+=1; continue
        if n.get('english','').strip(): nb+=1; continue
        n['english']=en; f+=1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"  filled: {f}, already-filled: {nb}, not-in-dataset: {nf}")

if __name__=='__main__': main()
