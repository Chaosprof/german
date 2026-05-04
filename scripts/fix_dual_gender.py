#!/usr/bin/env python3
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

d = json.load(open('data/dual-gender-nouns.json', encoding='utf-8'))

fixes = {
    'Mensch': {'der': 'human/person', 'das': 'wretch/hussy (derogatory)'},
    'Tag': {'der': 'day', 'das': 'tag (markup)'},
    'Teil': {'der': 'part/portion', 'das': 'piece/component'},
    'Kunde': {'die': 'news/tidings', 'der': 'customer/client'},
    'Ort': {'der': 'place/location', 'das': 'pointed end/awl'},
    'Fall': {'der': 'case/fall', 'das': 'halyard (nautical rope)'},
    'Alter': {'der': 'old man (colloquial)', 'das': 'age'},
    'Service': {'der': 'service', 'das': 'tea/dinner set'},
    'Bund': {'der': 'federation/alliance', 'das': 'bunch/bundle'},
    'Band': {'die': 'band (music group)', 'der': 'volume (book)', 'das': 'ribbon/tape/bond'},
    'See': {'die': 'sea/ocean', 'der': 'lake'},
    'Moment': {'der': 'moment (time)', 'das': 'factor/element (physics: torque)'},
    'Leiter': {'die': 'ladder', 'der': 'leader/director/conductor'},
    'Maß': {'die': 'liter of beer (Bavarian)', 'das': 'measure/degree/extent'},
    'Tor': {'der': 'fool (archaic)', 'das': 'gate/goal'},
    'Kaffee': {'der': 'coffee', 'das': 'cafe'},
    'Steuer': {'die': 'tax', 'das': 'steering wheel/helm'},
    'Post': {'die': 'mail/post office', 'der': 'post (online)'},
    'Morgen': {'der': 'morning', 'das': 'tomorrow/the future'},
    'Mangel': {'die': 'mangle (laundry press)', 'der': 'lack/deficiency'},
    'Gang': {'die': 'gang', 'der': 'corridor/aisle/gear/gait'},
    'Gehalt': {'der': 'content/substance', 'das': 'salary/wage'},
    'Bord': {'der': 'board (on board)', 'das': 'shelf'},
    'Boot': {'der': 'boot (footwear, from English)', 'das': 'boat'},
    'Erbe': {'der': 'heir', 'das': 'inheritance/heritage'},
    'Mode': {'die': 'fashion', 'der': 'mode (technical)'},
    'Bauer': {'der': 'farmer/peasant', 'das': 'birdcage'},
    'Loch': {'der': 'loch (Scottish lake)', 'das': 'hole'},
    'Tee': {'der': 'tea', 'das': 'tee (golf)'},
    'Chor': {'der': 'choir/chorus', 'das': 'chancel (church architecture)'},
    'Mund': {'die': 'guardianship (legal, archaic)', 'der': 'mouth'},
    'Kraut': {'der': 'Kraut (derogatory)', 'das': 'herb/cabbage'},
    'Schild': {'der': 'shield', 'das': 'sign/nameplate'},
    'Wende': {'die': 'turn/change (die Wende = reunification)', 'der': 'Wend/Sorb (Slavic people)'},
    'Model': {'der': 'mold/form', 'das': 'model (fashion)'},
    'Plastik': {'die': 'sculpture', 'der': 'plastic'},
    'Mark': {'die': 'mark (currency)/border march', 'das': 'marrow/pith'},
    'Verdienst': {'der': 'earnings/income', 'das': 'merit/credit'},
    'Lob': {'der': 'lob (sports)', 'das': 'praise'},
    'Flur': {'die': 'open field/farmland', 'der': 'hallway/corridor'},
    'Stift': {'der': 'pen/pencil/apprentice', 'das': 'collegiate church/foundation'},
    'Messer': {'der': 'measurer/gauge', 'das': 'knife'},
    'Golf': {'der': 'gulf', 'das': 'golf (sport)'},
    'Militaer': {'der': 'military officer', 'das': 'military/army'},
    'Militär': {'der': 'military officer', 'das': 'military/army'},
    'Reis': {'der': 'rice', 'das': 'twig/shoot'},
    'Schock': {'der': 'shock', 'das': 'sixty (archaic unit)'},
    'Objektiv': {'der': 'objective case (grammar)', 'das': 'lens/objective (camera)'},
    'Gift': {'die': 'gift (archaic/false friend)', 'der': 'anger/wrath (archaic)', 'das': 'poison'},
    'Gefallen': {'der': 'favour', 'das': 'pleasure/liking'},
    'Heide': {'die': 'heath/moor', 'der': 'heathen/pagan'},
    'Kiefer': {'die': 'pine tree', 'der': 'jaw'},
    'Mast': {'die': 'fattening (of animals)', 'der': 'mast/pole/pylon'},
    'Korn': {'der': 'grain schnapps', 'das': 'grain/corn/kernel'},
    'Pony': {'der': 'fringe/bangs (hair)', 'das': 'pony (small horse)'},
    'Marsch': {'die': 'marsh/wetland', 'der': 'march'},
    'Bulle': {'die': 'papal bull', 'der': 'bull/cop (slang)'},
    'Lama': {'der': 'lama (Buddhist monk)', 'das': 'llama (animal)'},
    'Laster': {'der': 'lorry/truck', 'das': 'vice/bad habit'},
    'Rentier': {'der': 'person of independent means', 'das': 'reindeer'},
    'Titan': {'der': 'Titan (mythology)', 'das': 'titanium (element)'},
    'Heroin': {'die': 'heroine', 'das': 'heroin (drug)'},
    'Page': {'die': 'page (web/book)', 'der': 'bellboy/page (attendant)'},
    'Otter': {'die': 'adder/viper', 'der': 'otter'},
    'Orange': {'die': 'orange (fruit)', 'das': 'orange (color)'},
    'Ekel': {'der': 'disgust/revulsion', 'das': 'disgusting person'},
    'Ohm': {'der': 'uncle (dialectal)', 'das': 'ohm (unit)'},
    'Tau': {'der': 'dew', 'das': 'rope/hawser'},
    'Pik': {'der': 'grudge/pique', 'das': 'spades (card suit)'},
    'Zimt': {'der': 'nonsense (colloquial)', 'das': 'cinnamon'},
    'Zink': {'der': 'cornett (Renaissance instrument)', 'das': 'zinc (metal)'},
    'Python': {'der': 'python (snake)', 'das': 'Python (programming)'},
    'Espresso': {'der': 'espresso (coffee)', 'das': 'espresso bar'},
    'Franchise': {'die': 'deductible/excess (insurance)', 'das': 'franchise'},
    'Spektakel': {'der': 'racket/commotion', 'das': 'spectacle/show'},
    'Hut': {'der': 'hat', 'die': 'guard/protection'},
}

for noun in d['nouns']:
    word = noun['word']
    if word in fixes:
        for g_entry in noun['genders']:
            art = g_entry['article']
            if art in fixes[word]:
                g_entry['english'] = fixes[word][art]

with open('data/dual-gender-nouns.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)

print(f'Fixed translations for {len(d["nouns"])} dual-gender nouns.')
print()
for noun in d['nouns']:
    parts = [f'{g["article"]} = {g["english"]}' for g in noun['genders']]
    print(f'  #{noun.get("rank","?"):<5} {noun["word"]:20s} {"  |  ".join(parts)}')
