#!/usr/bin/env python3
"""
Token-substitution fixer for systematic MT-garbage patterns where a German
morpheme was consistently translated to the wrong English word.

Strategy:
1. Detect suspicious tokens in the English gloss.
2. Look at the German compound word, find the corresponding morpheme.
3. Substitute the wrong English token with the right one.
4. Sanity-check against an explicit override map for cases where simple
   substitution doesn't yield a natural phrase.

Run after fix_translations.py.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Replacement rules: bad English token -> good English token (whole-word, case-insensitive)
TOKEN_FIX = {
    "tense":          "time",
    "civilisation":   "cultural",
    "civilization":   "cultural",
    "jurisprudence":  "law",
    "clearance":      "game",
    "circus":         "place",
    "bags":           "edge",
    "boor":           "builder",
    "blueprint":      "plan",
    "cutting remark": "top",
    "German armed forces": "federal",
}

# Hard overrides for nouns
NOUN_OVERRIDES = {
    # ── Bund- compounds (MT: "German armed forces") ──
    "Bundesministerin":        "federal minister (female)",
    "Bundesinnenminister":     "Federal Minister of the Interior",
    "Bundesgesundheitsminister": "Federal Minister of Health",
    "Bundeskartellamt":        "Federal Cartel Office",
    "Bundestrainer":           "national team coach",
    "Bundesvorsitzende":       "federal chairperson",
    "Bundesinnenministerium":  "Federal Ministry of the Interior",
    "Bundesbeauftragte":       "federal commissioner",
    "Bundesgesundheitsministerium": "Federal Ministry of Health",
    "Bundesfinanzminister":    "Federal Minister of Finance",
    "Bundeshaushalt":          "federal budget",
    "Bundesrechtsanwaltskammer": "Federal Bar Association",
    "Bundeskanzleramt":        "Federal Chancellery",
    "Bundespolitik":           "federal politics",
    "Bundesversammlung":       "Federal Convention/Federal Assembly",
    "Bundesaußenminister":     "Federal Minister of Foreign Affairs",
    "Bundesarbeitsgericht":    "Federal Labour Court",
    "Bundesfreiwillige":       "federal volunteer",
    "Bundesrecht":             "federal law",
    "Bundespolizist":          "federal police officer",
    "Bundesarchiv":            "Federal Archives",
    "Bundesnachrichtendienst": "Federal Intelligence Service",
    "Bundesarbeitsminister":   "Federal Minister of Labour",
    "Bundespost":              "federal postal service",
    "Städtebund":              "league of cities",
    "Gewerkschaftsbund":       "trade union confederation",

    # ── -stelle compounds (MT: "digit") ──
    "Pressestelle":            "press office",
    "Planstelle":              "established position",
    "Vollzeitstelle":          "full-time position",
    "Zweigstelle":             "branch office",
    "Unfallstelle":            "site of the accident",
    "Verkaufsstelle":          "point of sale/retail outlet",
    "Fundstelle":              "site of discovery",
    "Messstelle":              "measuring station",
    "Poststelle":              "post office/mailroom",
    "Informationsstelle":      "information office",
    "Hauptstelle":             "main branch/head office",
    "Stellvertretung":         "deputy/representation",
    "Textstelle":              "passage of text",
    "Hautstelle":              "patch of skin",
    "Stabstelle":              "staff unit",
    "Bibelstelle":             "biblical passage",
    "Stellensuche":            "job search",
    "Einstichstelle":          "puncture site",
    "Körperstelle":            "part of the body",
    "Kennziffer":              "identification number/code",

    # ── -zug compounds (MT: "breath") ──
    "Streifzug":               "foray/ramble",
    "Grundzug":                "main feature/fundamental trait",
    "Familiennachzug":         "family reunification",
    "Straßenzug":              "row of buildings/street block",
    "Spielmannszug":           "marching band",
    "Festzug":                 "parade/procession",
    "Demonstrationszug":       "protest march",
    "Beutezug":                "raid/looting expedition",
    "Gebirgszug":              "mountain range",
    "Nachzug":                 "follow-up move",
    "Charakterzug":            "character trait",
    "Rosenmontagszug":         "Rose Monday parade (Carnival)",
    "Zugverkehr":              "rail traffic",
    "Zugspitze":               "Zugspitze (mountain)",
    "Zugkraft":                "tractive force/pulling power",

    # ── Gang/Schiff compounds (MT: "aisle") ──
    "Behördengang":            "bureaucratic errand",
    "Schiffsverkehr":          "shipping traffic",
    "Hauptgang":               "main course",
    "Schiffsreise":            "boat trip/voyage",
    "Seitenschiff":            "side aisle (church)",
    "Mittelgang":              "central aisle",
    "Spülgang":                "rinse cycle",
    "Wellengang":              "swell/sea state",
    "Unterrichtsgang":         "school excursion",
    "Weggang":                 "departure",
    "Arbeitsgang":             "work step/operation",
    "Unfallhergang":           "course of an accident",
    "Ausflugsschiff":          "excursion boat",
    "Fahrgastschiff":          "passenger ship",

    # ── Spitze- compounds (MT: "cutting remark") ──
    "Spitzenposition":         "leading position",
    "Spitzenkandidat":         "leading candidate",
    "Spitzengruppe":           "leading group",
    "Spitzensport":            "elite sport",
    "Spitzenkoch":             "top chef",
    "Spitzensportler":         "top athlete",
    "Spitzensportlerin":       "top athlete (female)",
    "Spitzenkandidatin":       "leading candidate (female)",
    "Spitzberg":               "Spitzbergen",
    "Tabellenspitze":          "top of the table",
    "Weltspitze":              "world's elite",

    # ── -plan compounds (MT: "blueprint") ──
    "Sparplan":                "savings plan",
    "Bauplan":                 "building plan/construction plan",
    "Zukunftsplan":            "future plan",
    "Notfallplan":             "emergency plan",
    "Arbeitsplan":             "work plan",
    "Landschaftsplan":         "landscape plan",
    "Medikationsplan":         "medication plan",
    "Wochenplan":              "weekly plan",
    "Ablaufplan":              "schedule/process plan",
    "Reiseplan":               "travel plan/itinerary",
    "Fondssparplan":           "fund savings plan",

    # ── Alter compounds (MT: "dude") ──
    "Kindesalter":             "childhood",
    "Jugendalter":             "adolescence",
    "Altersteilzeit":          "partial early retirement",
    "Tierhalter":              "pet owner/animal keeper",
    "Katzenhalter":            "cat owner",
    "Höchstalter":             "maximum age",
    "Altersmedizin":           "geriatrics",
    "Kleinkindalter":          "toddler age",

    # ── archaic/odd → modern ──
    "Floskel":                 "platitude/cliché/empty phrase",
    "Binsenweisheit":          "platitude/truism",

    # ── single-word fixes ──
    "Bestzeit":                "best time/record time",
    "Vergünstigung":           "discount/concession/benefit",
    "Spielfigur":              "game piece",

    # ── more breath/aisle/digit cleanup ──
    "Atemzug":                 "breath",
    "Atemfrequenz":            "respiratory rate",
    "Atemproblem":             "breathing problem",
    "Puste":                   "breath/wind",
    "Altersangabe":            "age (specification)",
    "Schiffsfahrt":            "boat trip/voyage",
    "Schiffsmotor":            "marine engine/ship engine",
    "Schiffsführer":           "ship's captain/skipper",
    "Teilzeitstelle":          "part-time position",
    "Zollstelle":              "customs office",
    "Brandstelle":             "site of the fire",
    "Bundesprüfstelle":        "Federal Review Board",
    "Fernzug":                 "long-distance train",
    "Freigang":                "leave (from prison)/free running",
    "Nahtstelle":              "seam/junction/interface",
    "Rekordhalter":            "record holder",
    "Endziffer":               "final digit",
    "Prüfziffer":              "check digit",

    # ── Lieblings- compounds (MT: "darling") ──
    "Lieblingsbuch":           "favourite book",
    "Lieblingsmusik":          "favourite music",
    "Lieblingsrezept":         "favourite recipe",
    "Lieblingstier":           "favourite animal",
    "Lieblingssong":           "favourite song",
    "Lieblingsthema":          "favourite topic",
    "Lieblingsbeschäftigung":  "favourite activity",
    "Lieblingsgericht":        "favourite dish",
    "Lieblingsspiel":          "favourite game",
    "Lieblingsfilm":           "favourite film",
    "Lieblingsgetränk":        "favourite drink",
    "Lieblingsschuh":          "favourite shoe",
    "Lieblingsspielzeug":      "favourite toy",
    "Lieblingsplatz":          "favourite spot",

    # ── Berg- compounds (MT: "heap") ──
    "Bergakademie":            "mining academy",
    "Schlossberg":             "castle hill",
    "Bergretter":              "mountain rescuer",
    "Bergregion":              "mountain region",
    "Berggorilla":             "mountain gorilla",
    "Bergwelt":                "mountain world/alpine world",
    "Bergbahn":                "mountain railway/funicular",
    "Bergland":                "mountainous country/highland",
    "Berghütte":               "mountain cabin/alpine hut",
    "Bergstadt":               "mountain town",
    "Bergsee":                 "mountain lake",
    "Bergwald":                "mountain forest",
    "Bergwiese":               "mountain meadow",

    # ── Macher / -macher compounds (MT: "doer") ──
    "Spielmacher":             "playmaker",
    "Aufmacher":               "front-page story/headline",
    "Meinungsmacher":          "opinion-maker",
    "Macher":                  "maker/go-getter",

    # ── abode / Wohnsitz related ──
    "Bleibeperspektive":       "right of residence",
    "Nebenwohnsitz":           "secondary residence",
    "Bleibe":                  "place to stay/lodging",

    # ── other corrections ──
    "Aubergine":               "aubergine/eggplant",
    "Mattscheibe":             "screen/matt glass",
    "Pellkartoffel":           "potato boiled in its skin",
    "Aufmarsch":               "parade/deployment",
    "Fußmarsch":               "march on foot",
    "Moos":                    "moss",
    "Klo":                     "loo/lavatory/toilet",
    "Phrase":                  "phrase/empty phrase",
    "Trumpf":                  "trump card",
    "Knabe":                   "boy/lad",
    "Kamerad":                 "comrade/companion",
    "Schmutz":                 "dirt/filth/grime",
    "Schleim":                 "slime/mucus",
    "Schneide":                "edge/blade",
    "Rinde":                   "bark/rind/crust",

    # ── -bahn compounds (MT: "face") ──
    "Sommerrodelbahn":         "summer toboggan run",
    "Reeperbahn":              "Reeperbahn (Hamburg street)",
    "Regionalbahn":            "regional train",
    "Eisbahn":                 "ice rink",
    "Außenbahn":               "outer track/outer lane",
    "Laterne":                 "lantern",

    # ── Frauen- compounds (MT: "Mrs") ──
    "Landfrau":                "country woman/farm wife",
    "Frauenärztin":            "gynaecologist (female)",
    "Frauenklinik":            "women's clinic",
    "Frauenquote":             "women's quota",
    "Frauenbewegung":          "women's movement",
    "Frauenbild":              "image of women",
    "Frauenheilkunde":         "gynaecology",
    "Bankkauffrau":            "female bank clerk",
    "Kauffrau":                "businesswoman",

    # ── -geld compounds (MT: "dough") ──
    "Geldinstitut":            "financial institution",
    "Pflegegeld":              "care benefit/care allowance",
    "Spendengeld":             "donation money",
    "Betreuungsgeld":          "childcare benefit",
    "Schulgeld":               "school fees/tuition",
    "Urlaubsgeld":             "holiday pay",
    "Kröte":                   "toad",
    "Kies":                    "gravel/dough (slang for money)",

    # ── -woche compounds (MT: "puerperal") ──
    "Schulwoche":              "school week",
    "Vorwoche":                "previous week",
    "Ferienwoche":             "holiday week",
    "Lebenswoche":             "week of life",
    "Wochenbett":              "childbed/maternity period",

    # ── -fahrer compounds (MT: "chauffeur") ──
    "Mitfahrer":               "passenger/co-driver",
    "Kraftfahrer":             "professional driver",
    "Mopedfahrer":             "moped rider",
    "Fahrersitz":              "driver's seat",

    # ── individual ──
    "Eimer":                   "bucket",
    "Flachbildfernseher":      "flat-screen TV",
    "Millionenhöhe":           "millions (range/amount)",
    "Wertvorstellung":         "values/value system",
    "Partnersuche":            "search for a partner",
    "Nahrungsangebot":         "food supply/food on offer",
    "Rundung":                 "rounding/curve",
    "Rosenmontag":             "Rose Monday (Carnival)",
    "Drahtesel":               "bicycle (slang)",
    "Konfliktfall":            "case of conflict",
    "Essensausgabe":           "food distribution/serving area",
    "Rockstar":                "rock star",
    "Musikkultur":             "musical culture",
    "Teildisziplin":           "subdiscipline",
    "Inkassounternehmen":      "debt collection agency",
    "Rechenoperation":         "arithmetic operation",
    "Minigolfplatz":           "mini-golf course",
    "Sommersonne":             "summer sun",
    "Medianwert":              "median value",
    "Monatsbeitrag":           "monthly fee/monthly contribution",
    "Mengenangabe":            "quantity specification",
    "Handynutzer":             "mobile phone user",
    "Eierspeise":              "egg dish",
    "Imker":                   "beekeeper",
    "Kelle":                   "trowel/ladle",
    "Vollbeschäftigung":       "full employment",
    "Gegentor":                "goal conceded",
    "Ausnahmegenehmigung":     "special permission",
    "Bootstour":               "boat tour",

    # ── batch 8 ──
    "Pauschalreise":           "package holiday",
    "Sachunterricht":          "general studies (school subject)",
    "Sonderveranstaltung":     "special event",
    "Markenprodukt":           "branded product",
    "Schutzimpfung":           "vaccination",
    "Abendprogramm":           "evening programme",
    "Erwerbsfähigkeit":        "earning capacity",
    "Fleischkonsum":           "meat consumption",
    "Heimatregion":            "home region",
    "Komposthaufen":           "compost heap",
    "Erkältungskrankheit":     "cold/respiratory illness",
    "Meinungsaustausch":       "exchange of opinions",
    "Eintrittswahrscheinlichkeit": "probability of occurrence",
    "Institutsleiter":         "institute director",
    "Kunstlehrerin":           "art teacher (female)",
    "Bahnhofsplatz":           "station square",
    "Erfindergeist":           "inventiveness/ingenuity",
    "Volksbildung":            "public education",
    "Einzelschicksal":         "individual fate",
    "Querschnittslähmung":     "paraplegia",
    "Reformvorhaben":          "reform project",
    "Bäckerhandwerk":          "baker's trade",
    "Bauingenieurin":          "civil engineer (female)",
    "Ersatzverkehr":           "replacement transport",
    "Literaturangabe":         "bibliographic reference",
    "Monatshälfte":            "half-month",
    "Raumforschung":           "space research",
    "Chemiekonzern":           "chemical corporation",
    "Kinderwunsch":            "desire to have children",

    # ── top-3000 fixes ──
    "Behinderung":             "disability",
    "Schale":                  "shell/bowl/peel",
    "Selbstoptimierung":       "self-optimisation",

    # ── original first batch overrides (already applied, kept for idempotency) ──
    "Bearbeitungszeit":        "processing time",
    "Ausbildungszeit":         "training period",
    "Adventszeit":             "Advent season",
    "Fahrzeit":                "travel time",
    "Reisezeit":               "travel time",
    "Studienzeit":             "study period",
    "Dienstzeit":              "working hours/length of service",
    "Übergangszeit":           "transition period",
    "Vorlesungszeit":          "lecture period",
    "Anfangszeit":             "starting time/early period",
    "Ruhezeit":                "rest period/quiet time",
    "Erntezeit":               "harvest time",
    "Zeitabschnitt":           "period of time",
    "Kulturzentrum":           "cultural centre",
    "Kultureinrichtung":       "cultural institution",
    "Kulturkreis":             "cultural sphere/cultural area",
    "Willkommenskultur":       "welcoming culture",
    "Kulturangebot":           "cultural offerings",
    "Kulturszene":             "cultural scene",
    "Kulturhauptstadt":        "cultural capital",
    "Kulturbesitz":            "cultural property",
    "Kulturveranstaltung":     "cultural event",
    "Kulturwandel":            "cultural change",
    "Popkultur":               "pop culture",
    "Kulturforum":             "cultural forum",
    "Kulturverein":            "cultural association",
    "Kulturbüro":              "cultural office",
    "Baurecht":                "building law/planning law",
    "Stimmrecht":              "voting right/right to vote",
    "Rechtspopulismus":        "right-wing populism",
    "Landesrecht":             "state law",
    "Sonderkündigungsrecht":   "special right of termination",
    "Zugriffsrecht":           "access right",
    "Rechtsstaatlichkeit":     "rule of law",
    "Rechtssystem":            "legal system",
    "Rechtsausschuss":         "legal affairs committee",
    "Rechtsauffassung":        "legal opinion",
    "Verwaltungsrecht":        "administrative law",
    "Planspiel":               "simulation game",
    "Gastspiel":               "guest performance",
    "Testspiel":               "friendly match/test match",
    "Spielregel":              "rule of the game",
    "Spielplan":               "schedule/fixture list",
    "Spielbetrieb":            "match operations/gameplay",
    "Spielmöglichkeit":        "playing opportunity",
    "Spielstätte":             "venue",
    "Spielekonsole":           "games console",
    "Spielspaß":               "playing fun/fun of the game",
    "Gruppenspiel":            "group match",
    "Lernspiel":               "educational game",
    "Pflichtspiel":            "competitive match",
    "Spielfläche":             "playing area",
    "Spielwelt":               "game world",
    "Spielart":                "type/variety",
    "Spielsache":              "toy/plaything",
    "Spielverlauf":            "course of the game",
    "Ausverkauf":              "clearance sale/sell-off",
    "Brutplatz":               "breeding ground",
    "Spitzenplatz":            "top spot/leading position",
    "Betreuungsplatz":         "care place/childcare slot",
    "Platzangebot":            "available space",
    "Grillplatz":              "barbecue area",
    "Startplatz":              "starting place/grid position",
    "Tabellenplatz":           "league position/table position",
    "Vorplatz":                "forecourt",
    "Nistplatz":               "nesting place",
    "Platzbedarf":             "space requirement",
    "Wegesrand":               "wayside/roadside",
    "Randbereich":             "edge area/peripheral area",
    "Autobauer":               "car manufacturer",
    "Zivilisation":            "civilisation",
    "Didaktik":                "didactics/teaching methodology",
    "Sympathie":               "sympathy/liking",
    "Rechtswissenschaft":      "law/legal studies",
    "Flugzeug":                "aircraft/aeroplane",
    "Stapel":                  "stack/pile/heap",
    "Stoß":                    "push/blow/stack",
    "Zirkus":                  "circus",
    "Freeware":                "freeware",
    "Artist":                  "circus performer/acrobat",
}

VERB_OVERRIDES = {
    "knipsen":                 "snap/click/take a photo",
    "herausnehmen":            "take out/remove",
    "verpönen":                "frown upon",
}

ADJECTIVE_OVERRIDES = {
    "praxisnah":               "practical/practice-oriented",
    "extremistisch":           "extremist",
    "lesenswert":              "worth reading",
    "instabil":                "unstable",
}


def apply_dict(items, key_to_new, kind, log):
    """Apply override dict to a list of entries, return change count."""
    changed = 0
    for entry in items:
        word = entry.get("word", "")
        eng = (entry.get("english") or "").strip()
        if not eng:
            continue
        if word in key_to_new:
            new = key_to_new[word]
            if eng != new:
                log.append((entry.get("rank"), kind, word, eng, new, "override"))
                entry["english"] = new
                changed += 1
    return changed


def apply_token_sub(items, log):
    """Apply token substitution to entries not matched by overrides."""
    changed = 0
    for entry in items:
        word = entry.get("word", "")
        eng = (entry.get("english") or "").strip()
        if not eng:
            continue
        if word in NOUN_OVERRIDES:
            continue  # already handled
        new_eng = eng
        applied = []
        for bad, good in TOKEN_FIX.items():
            pattern = re.compile(r"\b" + re.escape(bad) + r"\b", re.IGNORECASE)
            if pattern.search(new_eng):
                new_eng = pattern.sub(good, new_eng)
                applied.append(f"{bad}->{good}")
        if new_eng != eng and applied:
            log.append((entry.get("rank"), "noun", word, eng, new_eng, "/".join(applied)))
            entry["english"] = new_eng
            changed += 1
    return changed


def main():
    log = []

    with open(DATA / "nouns.json", encoding="utf-8") as f:
        nouns = json.load(f)
    n_changed = apply_dict(nouns["nouns"], NOUN_OVERRIDES, "noun", log)
    n_changed += apply_token_sub(nouns["nouns"], log)
    with open(DATA / "nouns.json", "w", encoding="utf-8") as f:
        json.dump(nouns, f, ensure_ascii=False, indent=2)

    with open(DATA / "verbs.json", encoding="utf-8") as f:
        verbs = json.load(f)
    v_changed = apply_dict(verbs["verbs"], VERB_OVERRIDES, "verb", log)
    with open(DATA / "verbs.json", "w", encoding="utf-8") as f:
        json.dump(verbs, f, ensure_ascii=False, indent=2)

    with open(DATA / "adjectives.json", encoding="utf-8") as f:
        adjs = json.load(f)
    a_changed = apply_dict(adjs["adjectives"], ADJECTIVE_OVERRIDES, "adjective", log)
    with open(DATA / "adjectives.json", "w", encoding="utf-8") as f:
        json.dump(adjs, f, ensure_ascii=False, indent=2)

    print(f"Changed: nouns={n_changed} verbs={v_changed} adjectives={a_changed}")
    if log:
        print("\nFirst 30 changes (rank | kind | word | old -> new):")
        log.sort(key=lambda x: (x[0] is None, x[0] or 0))
        for rank, kind, word, old, new, _ in log[:30]:
            print(f"  {rank or '?':>6} {kind[:1]} {word:30s} | {old[:40]:40s} -> {new}")


if __name__ == "__main__":
    main()
