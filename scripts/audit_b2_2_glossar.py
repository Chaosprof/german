"""Audit Vielfalt B2.2 glossary against the local word banks.

This intentionally writes B2.2-specific files under audit/ and does not touch
the C1.1 audit outputs.
"""
import json
import re
import sys
import io
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

RAW_PATH = Path("audit/b2_2_glossar_raw.txt")
PARSED_PATH = Path("audit/b2_2_glossar_parsed.json")
SUMMARY_PATH = Path("audit/b2_2_glossar_summary.md")
MISSING_PATH = Path("audit/b2_2_glossar_missing.md")
MISMATCH_PATH = Path("audit/b2_2_glossar_mismatch.md")
CANDIDATES_PATH = Path("audit/b2_2_glossar_candidates.md")
TRANSLATION_PATH = Path("audit/b2_2_translation_review.md")


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def normalize_bar(word):
    return word.replace("|", "")


def strip_reflexive_form(s):
    if s is None:
        return None
    return re.sub(r"\bsich\b\s*", "", s).strip()


def parse_raw():
    raw = RAW_PATH.read_text(encoding="utf-8")
    lines = []
    for ln in raw.splitlines():
        s = ln.rstrip()
        if not s.strip():
            continue
        if s.startswith("=== PAGE"):
            continue
        if s.startswith("Kurs- und Arbeitsbuch Vielfalt"):
            continue
        if s.startswith("Lernwortschatz"):
            continue
        if s.startswith("Vielfalt B2.2"):
            continue
        lines.append(s)

    start = next((i for i, ln in enumerate(lines) if ln.startswith("MODUL ")), 0)
    lines = lines[start:]

    entries = []
    underscore_re = re.compile(r"_{5,}")
    section_re = re.compile(r"^(MODUL\s+\d+|Lektion\s+\d+)\b")
    current_module = None
    current_lektion = None
    current_title = None

    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("MODUL "):
            current_module = ln.strip()
            i += 1
            continue
        if ln.startswith("Lektion "):
            current_lektion = ln.strip()
            if i + 1 < len(lines) and not section_re.match(lines[i + 1]):
                current_title = lines[i + 1].strip()
                i += 2
            else:
                current_title = None
                i += 1
            continue
        if re.fullmatch(r"\d+", ln.strip()):
            i += 1
            continue

        acc = []
        has_underscore = False
        while i < len(lines):
            cur = lines[i]
            if section_re.match(cur) or re.fullmatch(r"\d+", cur.strip()):
                break
            m = underscore_re.search(cur)
            if m:
                part = cur[: m.start()].rstrip()
                if part:
                    acc.append(part)
                has_underscore = True
                i += 1
                break
            acc.append(cur)
            i += 1

        if has_underscore:
            text = " ".join(p.strip() for p in acc if p.strip())
            text = re.sub(r"(\S)-\s+(\S)", r"\1\2", text)
            text = re.sub(r"\s+", " ", text).strip()
            if text:
                entries.append({
                    "module": current_module,
                    "lektion": current_lektion,
                    "lektion_title": current_title,
                    "text": text,
                })
        else:
            i += 1

    return entries


def parse_noun(text):
    m = re.match(r"^(der|die|das|der\s*/\s*die|die\s*/\s*der|der/die|die/der)\s+([A-ZÄÖÜ][\wÄÖÜäöüß-]*)", text)
    if not m:
        return None
    article = m.group(1).replace(" ", "")
    word = m.group(2)
    rest = text[m.end():].strip()
    cont = re.match(r"^([a-zäöüß]+)(?=,|\s*\(|\s*/|$)", rest)
    if cont and not re.search(r"(en|eln|ern)$", cont.group(1)):
        word = word + cont.group(1)
        rest = rest[cont.end():].strip()
    plural = None
    pm = re.match(r",\s*(\.\.\s*\w+|[-–—]\w*|[A-ZÄÖÜ][\wÄÖÜäöüß-]+)", rest)
    if pm:
        plural = pm.group(1).strip()
    slash_plural = re.match(r"/\s*die\s+([A-ZÄÖÜ][\wÄÖÜäöüß-]+)", rest)
    if slash_plural and not plural:
        plural = slash_plural.group(1)
    modifiers = []
    if re.search(r"\(nur Sg\.?\)", text):
        modifiers.append("nur Sg.")
    if re.search(r"\(nur Pl\.?\)", text):
        modifiers.append("nur Pl.")
    return {"article": article, "word": word, "plural": plural, "modifiers": modifiers, "raw": text}


_VERBY_REST_RE = re.compile(
    r"^(?:"
    r"|\(sich\).*"
    r"|\([^)]*\)"
    r"|(?:auf|an|zu|in|bei|mit|von|über|um|für|nach|gegen|gegenüber|unter|zwischen)\s*\+\s*(Akk\.|Dat\.|Gen\.).*"
    r"|sich\s.*"
    r"|wie$"
    r")$",
    re.IGNORECASE,
)


def rest_is_verby(rest):
    return not rest or bool(_VERBY_REST_RE.match(rest))


def parse_verb(text):
    body = text
    is_reflexive = False
    if body.startswith("sich "):
        body = body[5:]
        is_reflexive = True
    tokens = body.split()
    if not tokens:
        return None
    tok = tokens[0].rstrip(",")
    if tok in {"jdm.", "jdn.", "etw.", "etwas", "von", "mit", "bis", "je", "zu", "rund", "auch", "selbst", "um",
               "sozusagen", "einigermaßen", "inwiefern", "insofern"}:
        return None
    if "|" in tok:
        lemma = normalize_bar(tok)
        if re.match(r"^[a-zäöüß]+(en|eln|ern|n)$", lemma):
            rest = body[len(tokens[0]):].strip()
            if rest_is_verby(rest):
                return {"lemma": lemma, "reflexive": is_reflexive, "raw": text}
        return None
    if re.match(r"^[a-zäöüß]+(en|eln|ern)$", tok):
        rest = body[len(tokens[0]):].strip()
        if rest_is_verby(rest):
            return {"lemma": tok, "reflexive": is_reflexive, "raw": text}
    return None


def parse_adj(text):
    if " " in text:
        return None
    m = re.match(r"^([a-zäöüß][a-zäöüß-]+?)(-)?$", text)
    if not m:
        return None
    return {"lemma": m.group(1), "stem": bool(m.group(2)), "raw": text}


def classify(entry):
    text = entry["text"]
    noun = parse_noun(text)
    if noun:
        return {**entry, "kind": "noun", "lemma": noun["word"], "meta": noun}
    verb = parse_verb(text)
    if verb:
        return {**entry, "kind": "verb", "lemma": verb["lemma"], "meta": verb}
    adj = parse_adj(text)
    if adj:
        return {**entry, "kind": "adj_stem" if adj["stem"] else "adj", "lemma": adj["lemma"], "meta": adj}
    return {**entry, "kind": "expression", "lemma": text, "meta": {"raw": text}}


def expand_plural(word, hint, modifiers):
    if "nur Sg." in modifiers:
        return "—"
    if "nur Pl." in modifiers:
        return word
    if not hint:
        return None
    h = hint.strip()
    if h in {"-", "–", "—"}:
        return word
    if h.startswith(".."):
        return add_umlaut(word) + h[2:].strip()
    if h[0] in "-–—":
        return word + h[1:]
    if re.match(r"^[A-ZÄÖÜ]", h):
        return h
    return None


def add_umlaut(word):
    i = word.rfind("au")
    if i != -1:
        return word[:i] + "äu" + word[i + 2:]
    for i in range(len(word) - 1, -1, -1):
        if word[i] in "aou":
            return word[:i] + {"a": "ä", "o": "ö", "u": "ü"}[word[i]] + word[i + 1:]
    return word


def conjugation_from_text(text):
    m = re.search(r"\(([^)]*(?:hat|ist|habe)[^)]*)\)", text)
    if not m:
        return None
    parts = [p.strip() for p in m.group(1).split(",")]
    if len(parts) < 3:
        return None
    aux_part = parts[-1]
    aux_match = re.search(r"\b(hat|ist|habe)\s+(.+)$", aux_part)
    if not aux_match:
        return None
    return {
        "present": parts[0],
        "prateritum": strip_reflexive_form(parts[-2]),
        "perfekt": strip_reflexive_form(aux_match.group(2)),
        "withSein": aux_match.group(1) == "ist",
        "aux": aux_match.group(1),
    }


def compare(parsed):
    nouns = load_json("data/nouns.json")["nouns"]
    verbs = load_json("data/verbs.json")["verbs"]
    adjs = load_json("data/adjectives.json")["adjectives"]
    vp = load_json("data/verbs-with-prepositions.json")["verbs"]
    dual = load_json("data/dual-gender-nouns.json")["nouns"]

    noun_idx = {n["word"]: n for n in nouns}
    verb_idx = {v["word"]: v for v in verbs}
    adj_idx = {a["word"].lower(): a for a in adjs}
    vp_keys = {(v["verb"], v["preposition"], v["case"]): v for v in vp}
    dual_idx = {d["word"]: d for d in dual}
    special_noun_map = {"Soziale": "Soziale Arbeit"}

    missing = defaultdict(list)
    mismatch = defaultdict(list)
    found = Counter()

    for e in parsed:
        kind, lemma = e["kind"], e["lemma"]
        if kind == "noun":
            lemma = special_noun_map.get(lemma, lemma)
            n = noun_idx.get(lemma)
            if not n:
                missing["noun"].append(e)
                continue
            found["noun"] += 1
            expected = expand_plural(lemma, e["meta"].get("plural"), e["meta"].get("modifiers", []))
            dual_ok = False
            d = dual_idx.get(lemma)
            if d and e["meta"]["article"] in {"der", "die", "das"}:
                for sense in d.get("genders", []):
                    if sense.get("article") == e["meta"]["article"] and (expected is None or sense.get("plural") == expected):
                        dual_ok = True
                        break
            if e["meta"]["article"] in {"der", "die", "das"} and n.get("article") != e["meta"]["article"] and not dual_ok:
                mismatch["noun"].append((e, "article", e["meta"]["article"], n.get("article")))
            if expected is not None and n.get("plural") != expected and not dual_ok:
                # The B2.2 PDF extraction has "die Glocke, -" although the
                # regular/correct plural is "Glocken"; keep the bank correct.
                if lemma == "Glocke" and expected == "Glocke" and n.get("plural") == "Glocken":
                    continue
                # Some textbook shorthand omits predictable umlauts in the hint
                # (e.g. "der Aufbruch, -e" but bank has "Aufbrüche").
                hinted_suffix = e["meta"].get("plural")
                if hinted_suffix and hinted_suffix.startswith("-") and n.get("plural") == add_umlaut(lemma) + hinted_suffix[1:]:
                    continue
                mismatch["noun"].append((e, "plural", expected, n.get("plural")))
        elif kind == "verb":
            v = verb_idx.get(lemma)
            if not v:
                if lemma.lower() in adj_idx:
                    found["adj"] += 1
                    continue
                missing["verb"].append(e)
                continue
            found["verb"] += 1
            conj = conjugation_from_text(e["text"])
            if conj and v.get("irregular"):
                issues = []
                if v.get("prateritum") and conj["prateritum"] != v["prateritum"]:
                    issues.append(("prateritum", conj["prateritum"], v.get("prateritum")))
                if v.get("perfekt") and conj["perfekt"] != v["perfekt"]:
                    issues.append(("perfekt", conj["perfekt"], v.get("perfekt")))
                if "withSein" in v and conj["withSein"] != v.get("withSein"):
                    issues.append(("aux", "ist" if conj["withSein"] else "hat", "ist" if v.get("withSein") else "hat"))
                for issue in issues:
                    mismatch["verb"].append((e, *issue))
        elif kind == "adj":
            if lemma.lower() in adj_idx:
                found["adj"] += 1
            elif lemma in verb_idx:
                found["verb"] += 1
            else:
                missing["adj"].append(e)
        elif kind == "adj_stem":
            if lemma.lower() in adj_idx:
                found["adj_stem"] += 1
            else:
                missing["adj_stem"].append(e)
        elif kind == "expression":
            missing["expression"].append(e)

    prep_re = re.compile(r"\b([^\s,()]+)\s*\+\s*(?:\+)?(Akk\.|Dat\.|Gen\.)")
    allowed = {"an", "auf", "aus", "bei", "für", "gegen", "gegenüber", "in", "mit", "nach", "über", "um", "unter", "von", "vor", "zu", "als", "zwischen"}
    vp_candidates = []
    for e in parsed:
        for m in prep_re.finditer(e["text"]):
            prep, case = m.group(1), m.group(2).rstrip(".")
            if prep not in allowed:
                continue
            if e["kind"] == "verb":
                verb = e["lemma"]
                display = "sich " + verb if ("(sich)" in e["text"] or e["text"].startswith("sich ")) else verb
                variants = {(verb, prep, case), (display, prep, case), (display.replace("sich ", ""), prep, case)}
                status = "existing" if variants & set(vp_keys) else "new"
                vp_candidates.append({"status": status, "verb": display, "preposition": prep, "case": case, "entry": e})
            else:
                vp_candidates.append({"status": "nonverb", "verb": e["lemma"], "preposition": prep, "case": case, "entry": e})

    irregular_candidates = []
    for e in parsed:
        if e["kind"] != "verb":
            continue
        v = verb_idx.get(e["lemma"])
        conj = conjugation_from_text(e["text"])
        if v and v.get("irregular"):
            irregular_candidates.append({"entry": e, "bank": v, "conj": conj, "source": v.get("source")})

    translation_flags = []
    for e in parsed:
        bank = None
        english = None
        if e["kind"] == "noun":
            bank = noun_idx.get(e["lemma"])
        elif e["kind"] == "verb":
            bank = verb_idx.get(e["lemma"])
        elif e["kind"] == "adj":
            bank = adj_idx.get(e["lemma"].lower())
        if bank:
            english = (bank.get("english") or "").strip()
            reasons = []
            if not english:
                reasons.append("missing English")
            if any(token in english.lower() for token in ["todo", "unknown", "translation"]):
                reasons.append("placeholder-looking")
            if "�" in english or "Ã" in english:
                reasons.append("encoding artifact")
            if len(english) <= 2:
                reasons.append("too short")
            if reasons:
                translation_flags.append((e, english, reasons))

    return found, missing, mismatch, vp_candidates, irregular_candidates, translation_flags


def loc(e):
    return f"{e.get('module') or '?'} / {e.get('lektion') or '?'}"


def write_reports(parsed, found, missing, mismatch, vp_candidates, irregular_candidates, translation_flags):
    totals = Counter(e["kind"] for e in parsed)
    with SUMMARY_PATH.open("w", encoding="utf-8") as f:
        f.write("# Vielfalt B2.2 Glossar audit summary\n\n")
        f.write(f"PDF: `Vielfalt_B2-2_Glossar_blanko.pdf` — {len(parsed)} entries parsed.\n\n")
        f.write("## Coverage by kind\n\n")
        f.write("| Kind | In PDF | Found | Missing |\n|---|---:|---:|---:|\n")
        for kind, label in [("noun", "Nouns"), ("verb", "Verbs"), ("adj", "Adjectives/adverbs"), ("adj_stem", "Adjective stems"), ("expression", "Expressions")]:
            f.write(f"| {label} | {totals[kind]} | {found[kind]} | {len(missing[kind])} |\n")
        f.write("\n")
        f.write(f"- Noun mismatches: **{len(mismatch['noun'])}**\n")
        f.write(f"- Verb conjugation mismatches: **{len(mismatch['verb'])}**\n")
        f.write(f"- Verb + preposition candidates: **{sum(1 for c in vp_candidates if c['status'] == 'new')} new**, "
                f"**{sum(1 for c in vp_candidates if c['status'] == 'existing')} already present**\n")
        f.write(f"- Irregular glossary verbs already in Verb Forms bank: **{len(irregular_candidates)}**\n")
        f.write(f"- Translation metadata flags: **{len(translation_flags)}**\n")

    with MISSING_PATH.open("w", encoding="utf-8") as f:
        f.write("# Vielfalt B2.2 missing entries\n\n")
        for kind in ["noun", "verb", "adj", "adj_stem", "expression"]:
            f.write(f"## {kind} missing ({len(missing[kind])})\n\n")
            if not missing[kind]:
                f.write("_None._\n\n")
                continue
            for e in missing[kind]:
                f.write(f"- **{e['lemma']}** — `{e['text']}` [{loc(e)}]\n")
            f.write("\n")

    with MISMATCH_PATH.open("w", encoding="utf-8") as f:
        f.write("# Vielfalt B2.2 mismatches\n\n")
        for kind in ["noun", "verb"]:
            f.write(f"## {kind} mismatches ({len(mismatch[kind])})\n\n")
            if not mismatch[kind]:
                f.write("_None._\n\n")
                continue
            for e, field, pdf, bank in mismatch[kind]:
                f.write(f"- **{e['lemma']}** `{field}` PDF `{pdf}` vs bank `{bank}` — `{e['text']}` [{loc(e)}]\n")
            f.write("\n")

    with CANDIDATES_PATH.open("w", encoding="utf-8") as f:
        f.write("# Vielfalt B2.2 candidates for special decks\n\n")
        f.write("## Verb + Preposition candidates\n\n")
        for status in ["new", "existing", "nonverb"]:
            items = [c for c in vp_candidates if c["status"] == status]
            f.write(f"### {status} ({len(items)})\n\n")
            if not items:
                f.write("_None._\n\n")
                continue
            for c in items:
                e = c["entry"]
                f.write(f"- **{c['verb']} {c['preposition']} + {c['case']}** — `{e['text']}` [{loc(e)}]\n")
            f.write("\n")
        f.write("## Irregular verb-form candidates\n\n")
        seen = set()
        for item in irregular_candidates:
            e = item["entry"]
            if e["lemma"] in seen:
                continue
            seen.add(e["lemma"])
            b = item["bank"]
            aux = "ist" if b.get("withSein") else "hat"
            f.write(f"- **{e['lemma']}** — `{b.get('prateritum')}`, `{aux} {b.get('perfekt')}` [{loc(e)}]\n")

    with TRANSLATION_PATH.open("w", encoding="utf-8") as f:
        f.write("# Vielfalt B2.2 translation metadata review\n\n")
        if not translation_flags:
            f.write("No empty/placeholder/encoding-artifact English fields were found among matched single-word entries.\n")
        else:
            for e, english, reasons in translation_flags:
                f.write(f"- **{e['lemma']}** — English `{english}` ({', '.join(reasons)}) [{loc(e)}]\n")


def main():
    parsed = [classify(e) for e in parse_raw()]
    PARSED_PATH.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    found, missing, mismatch, vp_candidates, irregular_candidates, translation_flags = compare(parsed)
    write_reports(parsed, found, missing, mismatch, vp_candidates, irregular_candidates, translation_flags)
    print(f"Parsed {len(parsed)} entries -> {PARSED_PATH}")
    print("Kinds:", dict(Counter(e["kind"] for e in parsed)))
    print(f"Wrote {SUMMARY_PATH}, {MISSING_PATH}, {MISMATCH_PATH}, {CANDIDATES_PATH}, {TRANSLATION_PATH}")


if __name__ == "__main__":
    main()
