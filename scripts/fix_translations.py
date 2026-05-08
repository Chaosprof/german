#!/usr/bin/env python3
"""
Apply curated translation fixes to data/{nouns,verbs,adjectives}.json.

Scope: high-confidence fixes for MT-garbage entries identified in
audit/translation_flags.json and direct inspection. Conservative: only
entries listed below are touched.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

NOUN_FIXES = {
    "Ortsgemeinde":          "local municipality",
    "Ortskern":              "town centre",
    "Ortsverband":           "local branch/local chapter",
    "Ortsrand":              "outskirts/edge of town",
    "Heimatort":             "home town",
    "Urlaubsort":            "holiday destination",
    "Arbeitsort":            "place of work",
    "Teilort":               "district/locality",

    "Wissensstand":          "level of knowledge",
    "Entwicklungsstand":     "state of development",
    "Sachstand":             "state of affairs",
    "Kenntnisstand":         "level of knowledge",
    "Leerstand":             "vacancy",

    "Spülmaschine":          "dishwasher",
    "Küchenmaschine":        "food processor",
    "Werkzeugmaschine":      "machine tool",

    "Bausparkasse":          "building society",
    "Kreissparkasse":        "district savings bank",

    "Bauträger":             "property developer",
    "Sympathieträger":       "popular figure",

    "Kreisverband":          "district association",
    "Kreishaus":             "district administrative building",

    "Kulturgeschichte":      "cultural history",
    "Firmengeschichte":      "company history",

    "Bergwacht":             "mountain rescue service",
    "Neufassung":            "new version/revised version",
    "Verkehrsfläche":        "traffic area/paved area",
    "Grundversorgung":       "basic care/basic supply",
    "Eintreffen":            "arrival",
    "Solarstrom":            "solar power",
    "Ausbildungsstätte":     "training facility",
    "Frauenbund":            "women's association",
    "Pflegegrad":            "care level",
    "Tabellenkeller":        "bottom of the table",
    "Tarnkappe":             "cloak of invisibility",
    "Tarifpartner":          "collective bargaining partner",
    "Tatzeit":               "time of the offence",
    "Taxiunternehmen":       "taxi company",
    "Tagesfahrt":            "day trip",
    "Talgrund":              "valley floor",
    "Strafantrag":           "criminal complaint",
    "Gerichtsstand":         "place of jurisdiction",
    "Gesichtsfeld":          "field of vision",
    "Geschlechterrolle":     "gender role",
    "Glaubensgemeinschaft":  "religious community",
    "Glaubensrichtung":      "religious denomination",
    "Gebäudebestand":        "building stock",
    "Gemeindemitglied":      "parish member/community member",
    "Hauswirtschaft":        "home economics",
    "Hochschulstudium":      "university studies",
    "Marktforschung":        "market research",
    "Interessenvertretung":  "interest group/lobby",
    "Lebensform":            "way of life/life form",
    "Minijob":               "mini-job/part-time job",
    "Verhinderung":          "prevention",
    "Buchen":                "booking/reservation",
    "Gesundheitsschutz":     "health protection",
    "Stoffbeutel":           "cloth bag",
    "Tasteninstrument":      "keyboard instrument",
    "Techno":                "techno (music)",
    "Acht":                  "eight/attention",
    "Email":                 "enamel/email",
    "Plastik":               "sculpture/plastic",

    "Extremität":            "extremity/limb",
    "Faible":                "penchant/weakness",
    "Flat":                  "flat-rate/flatshare",
    "Gegnerin":              "opponent (female)",
    "Gepäckstück":           "piece of luggage",
    "Klopfen":               "knocking",
    "Segmentierung":         "segmentation",
    "Signet":                "logo/emblem",
    "Umkehr":                "reversal/turnaround",
    "Unterstützerin":        "supporter (female)",
    "Verfehlung":            "misconduct/offence",
    "Verhängung":            "imposition (of a penalty)",
    "Zähneputzen":           "brushing teeth",
    "Bafög":                 "student financial aid (BAföG)",
    "Bundesgesetzblatt":     "federal law gazette",
    "Eldorado":              "El Dorado/paradise",
    "Ersuchen":              "request/petition",

    "Klischee":              "cliché/stereotype",
    "Umbruch":               "upheaval/radical change/page break",

    "Nein":                  "no",
    "Folgetag":              "following day/next day",
    "Kreatur":               "creature",
    "Nichts":                "nothing/nothingness",
    "Abbild":                "copy/image",

    # ── -ort compounds (MT: "awl") ──
    "Spielort":              "venue/playing location",
    "Ortseingang":           "town entrance",
    "Rückzugsort":           "retreat/refuge",
    "Ortsausgang":           "town exit",
    "Tagungsort":            "conference venue",
    "Ortsverein":            "local club/local society",
    "Erholungsort":          "resort/holiday destination",
    "Ortsumgehung":          "bypass/ring road",
    "Lieblingsort":          "favourite place",
    "Ortszentrum":           "town centre",
    "Küstenort":             "coastal town",
    "Lebensort":             "place of residence",
    "Ortsrecht":             "local law/municipal law",
    "Hauptort":              "main town/chief town",
    "Ortsschild":            "town sign/place-name sign",
    "Ortstermin":            "on-site visit/on-site meeting",
    "Ortswechsel":           "change of location",
    "Aufbewahrungsort":      "storage place/repository",
    "Ortskenntnis":          "local knowledge",
    "Ortsangabe":            "place name/location detail",
    "Ortsverzeichnis":       "place directory/gazetteer",
    "Brandort":              "site of the fire/fire scene",
    "Sehnsuchtsort":         "place of longing/dream destination",
    "Versammlungsort":       "meeting place/assembly venue",
    "Ortszeit":              "local time",
    "Ortsbild":              "townscape",
    "Dorn":                  "thorn/spike",  # was "awl/thorn" — awl wrong

    # ── -geschichte compounds (MT: "concern") ──
    "Zuwanderungsgeschichte": "history of immigration",
    "Krankengeschichte":     "medical history",
    "Migrationsgeschichte":  "migration history",
    "Geschichtsunterricht":  "history class/history lesson",
    "Geschichtswissenschaft": "historical studies",
    "Fluchtgeschichte":      "story of flight/refugee story",
    "Wirtschaftsgeschichte": "economic history",
    "Baugeschichte":         "history of construction",
    "Bergbaugeschichte":     "history of mining",
    "Entwicklungsgeschichte": "history of development/evolution",
    "Titelgeschichte":       "cover story",
    "Geschichtsdidaktik":    "didactics of history",
    "Geschichtsforschung":   "historical research",
    "Nachkriegsgeschichte":  "post-war history",
    "Schöpfungsgeschichte":  "creation story",
    "Wissenschaftsgeschichte": "history of science",
    "Naturgeschichte":       "natural history",
    "Religionsgeschichte":   "history of religion",
    "Fußballgeschichte":     "football history",
    "Heldengeschichte":      "hero story",
    "Leidensgeschichte":     "story of suffering",
    "Rechtsgeschichte":      "legal history",

    # ── -interesse / Interessen- compounds (MT: "concern") ──
    "Forschungsinteresse":   "research interest",
    "Eigeninteresse":        "self-interest",
    "Kaufinteresse":         "buying interest",
    "Interessengemeinschaft": "interest group/syndicate",
    "Interessensgruppe":     "interest group/lobby group",
    "Interessensvertretung": "interest representation/lobby",
    "Interessensgebiet":     "area of interest",
    "Interessenlage":        "interest situation",
    "Interessengebiet":      "area of interest",
    "Interessenskonflikt":   "conflict of interest",
    "Interessenausgleich":   "balance of interests",
    "Interessenschwerpunkt": "main area of interest",
    "Interessenverband":     "interest group association",
    "Hauptanliegen":         "main concern",

    # ── -maschine compounds (MT: "aircraft") ──
    "Maschinenbauer":        "mechanical engineer",
    "Maschinenwesen":        "machine engineering",
    "Zugmaschine":           "tractor/tractor unit",
    "Arbeitsmaschine":       "work machine/industrial machine",
    "Maschinenpark":         "machinery/machine fleet",
    "Espressomaschine":      "espresso machine",
    "Erntemaschine":         "harvester/harvesting machine",
    "Fräsmaschine":          "milling machine",
    "Maschinenraum":         "engine room/machine room",
    "Schleifmaschine":       "grinding machine",

    # ── -stand compounds (MT: "booth") ──
    "Zählerstand":           "meter reading",
    "Spielstand":            "score/state of play",
    "Tiefstand":             "low point/nadir",
    "Berufsstand":           "profession/occupation group",
    "Standplatz":            "pitch/parking space",
    "Bienenstand":           "apiary",
    "Standfläche":           "floor space/footprint",
    "Standstreifen":         "hard shoulder",
    "Tiefststand":           "all-time low/record low",
    "Unterstand":            "shelter/dugout",

    # ── -träger compounds (MT: "carrier") ──
    "Tonträger":             "audio medium/sound carrier",
    "Werbeträger":           "advertising medium",
    "Mandatsträger":         "elected official",
    "Amtsträger":            "office holder",
    "Funktionsträger":       "officeholder",
    "Titelträger":           "title holder",
    "Ladungsträger":         "charge carrier",
    "Sachaufwandsträger":    "responsible authority for material costs",
    "Überweisungsträger":    "transfer slip/payment slip",
    "Fahrradträger":         "bike rack",
    "Dachträger":            "roof rack",

    # ── -runde compounds (MT: "circuit") ──
    "Endrunde":              "final round",
    "Rückrunde":             "second half of the season",
    "Tarifrunde":            "round of pay negotiations",
    "Schlussrunde":          "final round",
    "Verhandlungsrunde":     "round of negotiations",
    "Talkrunde":             "talk show/discussion round",
    "Spielrunde":            "round of play",
    "Hinrunde":              "first half of the season",

    # ── -schaltung compounds (MT: "circuit") ──
    "Freischaltung":         "activation/unlocking",
    "Anzeigenschaltung":     "advertisement placement",
    "Gleichschaltung":       "forced conformity/synchronisation",
    "Ausschaltung":          "elimination/switching off",
    "Gangschaltung":         "gear shift",

    # ── Fassung compounds (MT: "composure") ──
    "Kurzfassung":           "abridged version/short version",

    # ── other corrections ──
    "Wasserkreislauf":       "water cycle/hydrological cycle",
    "Essenz":                "essence/extract",
    "Gesprächsrunde":        "discussion round/panel discussion",
}

VERB_FIXES = {
    "aushandeln":            "negotiate",
    "schliefen":             "crawl into a burrow (hunting)",
}

ADJECTIVE_FIXES = {
    "ortsfest":              "stationary/fixed in place",
    "rechtsfrei":            "extra-judicial/extralegal/lawless",
    "umstandslos":           "without further ado/without fuss",
}


def apply_fixes():
    changed = {"nouns": 0, "verbs": 0, "adjectives": 0}

    with open(DATA / "nouns.json", encoding="utf-8") as f:
        nouns = json.load(f)
    found_nouns = set()
    for entry in nouns["nouns"]:
        w = entry.get("word")
        if w in NOUN_FIXES:
            found_nouns.add(w)
            new = NOUN_FIXES[w]
            if entry.get("english", "") != new:
                entry["english"] = new
                changed["nouns"] += 1
    with open(DATA / "nouns.json", "w", encoding="utf-8") as f:
        json.dump(nouns, f, ensure_ascii=False, indent=2)

    with open(DATA / "verbs.json", encoding="utf-8") as f:
        verbs = json.load(f)
    found_verbs = set()
    for entry in verbs["verbs"]:
        w = entry.get("word")
        if w in VERB_FIXES:
            found_verbs.add(w)
            new = VERB_FIXES[w]
            if entry.get("english", "") != new:
                entry["english"] = new
                changed["verbs"] += 1
    with open(DATA / "verbs.json", "w", encoding="utf-8") as f:
        json.dump(verbs, f, ensure_ascii=False, indent=2)

    with open(DATA / "adjectives.json", encoding="utf-8") as f:
        adjs = json.load(f)
    found_adjs = set()
    for entry in adjs["adjectives"]:
        w = entry.get("word")
        if w in ADJECTIVE_FIXES:
            found_adjs.add(w)
            new = ADJECTIVE_FIXES[w]
            if entry.get("english", "") != new:
                entry["english"] = new
                changed["adjectives"] += 1
    with open(DATA / "adjectives.json", "w", encoding="utf-8") as f:
        json.dump(adjs, f, ensure_ascii=False, indent=2)

    print("=== Translation fixes applied ===")
    for k, n in changed.items():
        print(f"  {k}: {n}")

    missing_n = [w for w in NOUN_FIXES if w not in found_nouns]
    missing_v = [w for w in VERB_FIXES if w not in found_verbs]
    missing_a = [w for w in ADJECTIVE_FIXES if w not in found_adjs]
    if missing_n or missing_v or missing_a:
        print("\nKeys not found in data:")
        for w in missing_n:
            print(f"  noun: {w}")
        for w in missing_v:
            print(f"  verb: {w}")
        for w in missing_a:
            print(f"  adj:  {w}")


if __name__ == "__main__":
    apply_fixes()
