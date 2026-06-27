"""Add Vielfalt C1.1 verb-preposition combinations and deck data."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VP_PATH = ROOT / "data" / "verbs-with-prepositions.json"
OUT_DIR = ROOT / "data" / "vielfalt-c1-1"
MANIFEST_PATH = OUT_DIR / "manifest.json"

NEW_COMBOS = [
    {
        "verb": "verweisen",
        "preposition": "auf",
        "case": "Akk",
        "english": "refer to / point to",
        "example": "Der Text verweist auf weitere Quellen.",
    },
    {
        "verb": "bewundern",
        "preposition": "an",
        "case": "Dat",
        "english": "admire about",
        "example": "Ich bewundere an ihr ihre Gelassenheit.",
    },
    {
        "verb": "übereinstimmen",
        "preposition": "in",
        "case": "Dat",
        "english": "agree on / match in",
        "example": "Die beiden Berichte stimmen in vielen Punkten überein.",
    },
    {
        "verb": "verstehen",
        "preposition": "unter",
        "case": "Dat",
        "english": "understand by",
        "example": "Was verstehst du unter diesem Begriff?",
    },
    {
        "verb": "verknüpfen",
        "preposition": "mit",
        "case": "Dat",
        "english": "link / connect with",
        "example": "Sie verknüpft die Theorie mit praktischen Beispielen.",
    },
    {
        "verb": "sich einstellen",
        "preposition": "auf",
        "case": "Akk",
        "english": "adjust / prepare for",
        "example": "Wir stellen uns auf neue Bedingungen ein.",
    },
    {
        "verb": "einhergehen",
        "preposition": "mit",
        "case": "Dat",
        "english": "go hand in hand with",
        "example": "Der Wandel geht mit großen Chancen einher.",
    },
    {
        "verb": "hindeuten",
        "preposition": "auf",
        "case": "Akk",
        "english": "point to / indicate",
        "example": "Die Zahlen deuten auf eine Verbesserung hin.",
    },
    {
        "verb": "erfüllen",
        "preposition": "mit",
        "case": "Dat",
        "english": "fill with",
        "example": "Die Nachricht erfüllte sie mit Freude.",
    },
    {
        "verb": "sich einschreiben",
        "preposition": "an",
        "case": "Dat",
        "english": "enroll at",
        "example": "Sie schreibt sich an der Universität ein.",
    },
    {
        "verb": "sich einschreiben",
        "preposition": "für",
        "case": "Akk",
        "english": "enroll / register for",
        "example": "Er schreibt sich für den Kurs ein.",
    },
    {
        "verb": "sich entfremden",
        "preposition": "von",
        "case": "Dat",
        "english": "become alienated from",
        "example": "Er entfremdete sich von seiner Familie.",
    },
    {
        "verb": "investieren",
        "preposition": "in",
        "case": "Akk",
        "english": "invest in",
        "example": "Das Unternehmen investiert in neue Technologien.",
    },
    {
        "verb": "geradestehen",
        "preposition": "für",
        "case": "Akk",
        "english": "answer / be responsible for",
        "example": "Jeder muss für seine Fehler geradestehen.",
    },
    {
        "verb": "zeugen",
        "preposition": "von",
        "case": "Dat",
        "english": "testify to / show evidence of",
        "example": "Sein Verhalten zeugt von großem Mut.",
    },
]

VIELFALT_VP_KEYS = [
    "verweisen|auf",
    "bewundern|an",
    "übereinstimmen|in",
    "zurückführen|auf",
    "verstehen|unter",
    "verknüpfen|mit",
    "ausgehen|von",
    "anpassen|an",
    "sich einstellen|auf",
    "einhergehen|mit",
    "stoßen|auf",
    "hindeuten|auf",
    "sich beziehen|auf",
    "führen|zu",
    "aufkommen|für",
    "erfüllen|mit",
    "sich einschreiben|an",
    "sich einschreiben|für",
    "sich entfremden|von",
    "sich richten|an",
    "investieren|in",
    "erfahren|von",
    "geradestehen|für",
    "zeugen|von",
    "mangeln|an",
]


def key(entry):
    return f"{entry['verb']}|{entry['preposition']}"


vp_data = json.loads(VP_PATH.read_text(encoding="utf-8"))
verbs = vp_data["verbs"]
existing = {key(entry): entry for entry in verbs}
next_rank = max(entry.get("rank", 0) for entry in verbs) + 1

added = 0
for combo in NEW_COMBOS:
    combo_key = key(combo)
    if combo_key in existing:
        continue
    entry = {
        **combo,
        "rank": next_rank,
        "source": "vielfalt-c1.1",
    }
    verbs.append(entry)
    existing[combo_key] = entry
    next_rank += 1
    added += 1

vp_data.setdefault("meta", {})["count"] = len(verbs)
VP_PATH.write_text(json.dumps(vp_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

missing = [combo_key for combo_key in VIELFALT_VP_KEYS if combo_key not in existing]
if missing:
    raise SystemExit(f"Missing expected verb-preposition combos: {missing}")

deck = {
    "id": "vielfalt-c1.1-verb-prepositions",
    "name": "Vielfalt C1.1 - Verb + Preposition",
    "shortName": "Verb + Prep",
    "description": "All fixed verb-preposition combinations from the Vielfalt C1.1 glossary.",
    "source": "Vielfalt_C1-1_Glossar_blanko.pdf",
    "verbPrepositions": VIELFALT_VP_KEYS,
}
(OUT_DIR / "verb-prepositions.json").write_text(
    json.dumps(deck, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
manifest["decks"] = [d for d in manifest["decks"] if d.get("id") != deck["id"]]
manifest["decks"].append({
    "file": "verb-prepositions.json",
    "id": deck["id"],
    "name": deck["name"],
    "kind": "verb_prepositions",
})
MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(f"Added {added} verb-preposition combo(s)")
print(f"Deck contains {len(VIELFALT_VP_KEYS)} combo(s)")
