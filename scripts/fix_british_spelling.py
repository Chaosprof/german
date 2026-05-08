#!/usr/bin/env python3
"""
Normalise translations to British spelling per the user's preference:
drop US duplicates, prefer single UK form.

Conservative: only modifies clear US-vs-UK pairs (-ize → -ise, -or → -our,
specific noun pairs). Words that are universal (e.g. "check" as a verb) are
left alone even if they superficially match US-only.
"""
import json
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# (us, uk) — applied as whole-word replacement
PAIRS = [
    # -ize / -ise
    ("organize", "organise"),
    ("organized", "organised"),
    ("organizing", "organising"),
    ("organization", "organisation"),
    ("organizational", "organisational"),
    ("realize", "realise"),
    ("realized", "realised"),
    ("realizing", "realising"),
    ("realization", "realisation"),
    ("recognize", "recognise"),
    ("recognized", "recognised"),
    ("recognizing", "recognising"),
    ("emphasize", "emphasise"),
    ("emphasized", "emphasised"),
    ("emphasizing", "emphasising"),
    ("apologize", "apologise"),
    ("apologized", "apologised"),
    ("apologizing", "apologising"),
    ("prioritize", "prioritise"),
    ("prioritized", "prioritised"),
    ("summarize", "summarise"),
    ("summarized", "summarised"),
    ("utilize", "utilise"),
    ("utilized", "utilised"),
    ("characterize", "characterise"),
    ("characterized", "characterised"),
    ("memorize", "memorise"),
    ("memorized", "memorised"),
    ("industrialize", "industrialise"),
    ("industrialized", "industrialised"),
    ("commercialize", "commercialise"),
    ("commercialized", "commercialised"),
    ("commercialization", "commercialisation"),
    ("penalize", "penalise"),
    ("penalized", "penalised"),
    ("legalize", "legalise"),
    ("legalized", "legalised"),
    ("legalization", "legalisation"),
    ("normalize", "normalise"),
    ("normalized", "normalised"),
    ("standardize", "standardise"),
    ("standardized", "standardised"),
    ("centralize", "centralise"),
    ("centralized", "centralised"),
    ("globalize", "globalise"),
    ("globalized", "globalised"),
    ("modernize", "modernise"),
    ("modernized", "modernised"),
    ("specialize", "specialise"),
    ("specialized", "specialised"),
    ("specialization", "specialisation"),
    ("optimize", "optimise"),
    ("optimized", "optimised"),
    ("optimization", "optimisation"),
    ("randomize", "randomise"),
    ("authorized", "authorised"),
    ("authorize", "authorise"),
    ("authorization", "authorisation"),
    ("colonize", "colonise"),
    ("colonization", "colonisation"),
    ("colonized", "colonised"),
    ("hospitalize", "hospitalise"),
    ("hospitalized", "hospitalised"),
    ("computerize", "computerise"),
    ("computerized", "computerised"),
    ("subsidize", "subsidise"),
    ("subsidized", "subsidised"),
    ("subsidization", "subsidisation"),
    ("urbanize", "urbanise"),
    ("urbanized", "urbanised"),
    ("urbanization", "urbanisation"),
    ("synchronize", "synchronise"),
    ("synchronized", "synchronised"),
    ("synchronization", "synchronisation"),
    ("personalize", "personalise"),
    ("personalized", "personalised"),
    ("digitize", "digitise"),
    ("digitized", "digitised"),
    ("digitization", "digitisation"),
    ("revolutionize", "revolutionise"),
    ("popularize", "popularise"),
    ("polarize", "polarise"),
    ("hybridize", "hybridise"),
    ("stabilize", "stabilise"),
    ("stabilization", "stabilisation"),
    ("destabilize", "destabilise"),
    ("mobilize", "mobilise"),
    ("mobilization", "mobilisation"),
    ("immobilize", "immobilise"),
    ("idolize", "idolise"),
    ("idealize", "idealise"),
    ("vandalize", "vandalise"),

    # -or / -our
    ("color", "colour"),
    ("coloring", "colouring"),
    ("colored", "coloured"),
    ("flavor", "flavour"),
    ("flavored", "flavoured"),
    ("flavoring", "flavouring"),
    ("honor", "honour"),
    ("honored", "honoured"),
    ("humor", "humour"),
    ("humored", "humoured"),
    ("labor", "labour"),
    ("neighbor", "neighbour"),
    ("neighboring", "neighbouring"),
    ("behavior", "behaviour"),
    ("favor", "favour"),
    ("favorable", "favourable"),
    ("favorite", "favourite"),
    ("savor", "savour"),
    ("rumor", "rumour"),
    ("vapor", "vapour"),
    ("harbor", "harbour"),

    # -er / -re (only safe ones)
    ("center", "centre"),
    ("centered", "centred"),
    ("theater", "theatre"),
    ("liter", "litre"),
    ("fiber", "fibre"),

    # noun-specific pairs
    ("defense", "defence"),
    ("offense", "offence"),
    ("judgment", "judgement"),
    ("license", "licence"),  # may be over-eager but on balance UK noun is licence

    # -ll- doubling
    ("traveling", "travelling"),
    ("traveler", "traveller"),
    ("travelers", "travellers"),
    ("traveled", "travelled"),
    ("canceled", "cancelled"),
    ("canceling", "cancelling"),
    ("counseled", "counselled"),
    ("counseling", "counselling"),
    ("counselor", "counsellor"),
    ("modeled", "modelled"),
    ("modeling", "modelling"),
    ("labeled", "labelled"),
    ("labeling", "labelling"),
    ("equaled", "equalled"),
    ("totaled", "totalled"),

    # other UK preferences
    ("aluminum", "aluminium"),
    ("jewelry", "jewellery"),
    ("plow", "plough"),
    ("mold", "mould"),
    ("molded", "moulded"),
    ("molding", "moulding"),
    ("mustache", "moustache"),
    ("tire", "tyre"),
    ("tires", "tyres"),
    ("curbstone", "kerbstone"),
    ("gray", "grey"),
    ("grayish", "greyish"),
    ("pajama", "pyjama"),
    ("pajamas", "pyjamas"),
]

PAIRS_DICT = {us.lower(): uk for us, uk in PAIRS}


def _ize_to_ise(text: str) -> str:
    """Convert all -ize/-ized/-izing/-ization word endings to UK -ise variants."""
    # only convert standalone words; preserve case (capital first letter)
    def repl(m):
        word = m.group(0)
        # The matched word ends in ize/ized/izing/ization
        if word.lower().endswith("ization"):
            new = word[:-7] + ("ISATION" if word.isupper() else ("Isation" if word[0].isupper() else "isation"))
        elif word.lower().endswith("izations"):
            new = word[:-8] + ("ISATIONS" if word.isupper() else ("Isations" if word[0].isupper() else "isations"))
        elif word.lower().endswith("izing"):
            new = word[:-5] + ("ISING" if word.isupper() else ("Ising" if word[0].isupper() else "ising"))
        elif word.lower().endswith("ized"):
            new = word[:-4] + ("ISED" if word.isupper() else ("Ised" if word[0].isupper() else "ised"))
        elif word.lower().endswith("izes"):
            new = word[:-4] + ("ISES" if word.isupper() else ("Ises" if word[0].isupper() else "ises"))
        elif word.lower().endswith("ize"):
            new = word[:-3] + ("ISE" if word.isupper() else ("Ise" if word[0].isupper() else "ise"))
        else:
            return word
        return new

    # Match words containing an 'ize' suffix variant. Avoid common false positives
    # like 'size', 'prize', 'seize', 'maize', 'capsize', 'baptize' (rare).
    EXCLUDE = {"size", "sized", "sizes", "sizing", "prize", "prized", "prizes",
               "seize", "seized", "seizing", "seizes", "maize", "capsize",
               "capsized", "capsizing", "downsize", "downsized", "downsizing",
               "oversize", "oversized", "outsize", "outsized",
               "medium-sized", "full-sized", "king-sized", "life-sized",
               "pint-sized", "bite-sized"}

    def safe_repl(m):
        word = m.group(0)
        if word.lower() in EXCLUDE:
            return word
        return repl(m)

    return re.sub(r"\b[a-zA-Z]+iz(?:e|ed|es|ing|ation|ations)\b", safe_repl, text)


def normalise_eng(eng: str) -> str:
    new = eng

    # 0. Generic -ize → -ise rule first
    new = _ize_to_ise(new)

    # 1. Remove duplicate senses: when split on '/', drop senses that are the
    # US version of a sense already present in UK form.
    senses = [s.strip() for s in new.split("/") if s.strip()]
    if len(senses) > 1:
        sense_lower = [s.lower() for s in senses]
        keep_idx = []
        for i, sl in enumerate(sense_lower):
            words = re.findall(r"\b[a-zA-Z'-]+\b", sl)
            is_dup = False
            for w in words:
                if w in PAIRS_DICT:
                    uk = PAIRS_DICT[w]
                    for j, other_sl in enumerate(sense_lower):
                        if i == j:
                            continue
                        if re.search(r"\b" + re.escape(uk) + r"\b", other_sl):
                            is_dup = True
                            break
                if is_dup:
                    break
            if not is_dup:
                keep_idx.append(i)
        new = "/".join(senses[i] for i in keep_idx) if keep_idx else new

    # 1.5 Dedupe identical senses (case-sensitive — capitalisation can be meaningful, e.g. God/god)
    senses = [s.strip() for s in new.split("/") if s.strip()]
    seen = set()
    deduped = []
    for s in senses:
        if s not in seen:
            seen.add(s)
            deduped.append(s)
    new = "/".join(deduped)

    # 2. Apply US → UK substitution case-preserving
    for us, uk in PAIRS:
        def repl(m, _uk=uk):
            tok = m.group(0)
            if tok.isupper():
                return _uk.upper()
            if tok[0].isupper():
                return _uk[0].upper() + _uk[1:]
            return _uk
        new = re.sub(r"\b" + re.escape(us) + r"\b", repl, new, flags=re.IGNORECASE)

    return new


def main():
    log = []
    for fname, key in [("nouns.json", "nouns"), ("verbs.json", "verbs"), ("adjectives.json", "adjectives")]:
        with open(DATA / fname, encoding="utf-8") as f:
            data = json.load(f)
        changed = 0
        for entry in data[key]:
            eng = (entry.get("english") or "").strip()
            if not eng:
                continue
            new = normalise_eng(eng)
            if new != eng:
                log.append((entry.get("rank"), key, entry.get("word"), eng, new))
                entry["english"] = new
                changed += 1
        with open(DATA / fname, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"{key}: changed {changed}")

    print("\nFirst 30 changes:")
    log.sort(key=lambda x: (x[0] is None, x[0] or 0))
    for rank, kind, word, old, new in log[:30]:
        print(f"  rank={rank or '?':>6} [{kind[:1]}] {word:30s} | {old[:50]:50s} -> {new}")


if __name__ == "__main__":
    main()
