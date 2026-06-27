"""Compare parsed glossary entries against the website word bank.

Outputs:
- audit/glossar_missing.md  : words from PDF not present in the appropriate bank
- audit/glossar_mismatch.md : words found but with disagreeing info (article / plural)
- audit/glossar_summary.md  : top-level stats and findings
"""
import json
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

parsed = json.load(open("audit/glossar_parsed.json", encoding="utf-8"))

# Load word banks
nouns_data = json.load(open("data/nouns.json", encoding="utf-8"))["nouns"]
verbs_data = json.load(open("data/verbs.json", encoding="utf-8"))["verbs"]
adj_data = json.load(open("data/adjectives.json", encoding="utf-8"))["adjectives"]

noun_idx = {n["word"]: n for n in nouns_data}
# Also build a case-insensitive secondary index for diagnostic reporting
noun_idx_ci = {n["word"].lower(): n for n in nouns_data}
verb_idx = {v["word"].lower(): v for v in verbs_data}
adj_idx = {a["word"].lower(): a for a in adj_data}


def normalize_plural_hint(hint, base_word):
    """Translate the PDF's compact plural notation to the actual plural form.

    Examples:
        "-en"      + Phase    -> "Phasen"
        "-n"       + Phase    -> "Phasen"
        "-e"       + Hund     -> "Hunde"
        "-er"      + Bild     -> "Bilder"
        "-s"       + Auto     -> "Autos"
        "-"        + Lehrer   -> "Lehrer" (no change)
        ".. e"     + Brustkorb -> "Brustkörbe" (umlaut + e)
        ".. er"    + Buch     -> "Bücher"
        "Curricula" (literal substitute)
    """
    if hint is None:
        return None
    h = hint.strip()
    if not h:
        return None
    if h.startswith("-"):
        suffix = h[1:].strip()
        if not suffix:
            return base_word
        return base_word + suffix
    if h.startswith(".."):
        suffix = h[2:].strip()
        # umlaut: a->ä, o->ö, u->ü on the last umlautable vowel cluster
        umlauted = umlaut(base_word)
        return umlauted + suffix
    # Possibly a literal alternative form (e.g., "Curricula", "Algorithmen")
    if re.match(r"^[A-ZÄÖÜ]\w+$", h):
        return h
    return None


def umlaut(word):
    """Apply umlaut to the last back vowel/au cluster in a word."""
    # First pass: prefer 'au' -> 'äu' on the last 'au' anywhere in the word.
    last_au = word.rfind("au")
    if last_au != -1:
        return word[:last_au] + "äu" + word[last_au + 2:]
    # Otherwise umlaut the last back vowel.
    for i in range(len(word) - 1, -1, -1):
        ch = word[i]
        if ch in "aou":
            return word[:i] + {"a": "ä", "o": "ö", "u": "ü"}[ch] + word[i+1:]
        if ch in "AOU":
            return word[:i] + {"A": "Ä", "O": "Ö", "U": "Ü"}[ch] + word[i+1:]
    return word


# Map separable verb base forms (e.g., "anvertrauen") to lemma exactly
def verb_lookup(lemma):
    """Try several lookups: exact, lower, with/without separable removal."""
    candidates = [lemma, lemma.lower()]
    for c in candidates:
        if c in verb_idx:
            return verb_idx[c]
    return None


missing = {"noun": [], "verb": [], "adj": [], "adj_stem": [], "expression": []}
mismatch = {"noun": [], "verb": [], "adj": []}
found = {"noun": 0, "verb": 0, "adj": 0, "adj_stem": 0, "expression": 0}


def fmt_loc(e):
    return f"[{e['module']} / {e['lektion']}]"


for e in parsed:
    kind = e["kind"]
    lemma = e["lemma"]
    meta = e["meta"]
    text = e["text"]
    if kind == "noun":
        # Try main bank
        n = noun_idx.get(lemma)
        if not n:
            # Try CI fallback
            n_ci = noun_idx_ci.get(lemma.lower())
            if n_ci:
                missing["noun"].append({
                    "lemma": lemma,
                    "text": text,
                    "loc": fmt_loc(e),
                    "note": f"case mismatch: bank has '{n_ci['word']}'",
                })
            else:
                missing["noun"].append({
                    "lemma": lemma,
                    "text": text,
                    "loc": fmt_loc(e),
                })
            continue
        found["noun"] += 1
        # Compare article + plural
        bank_article = n.get("article")
        bank_plural = n.get("plural")
        pdf_article = meta.get("article")
        pdf_plural = normalize_plural_hint(meta.get("plural"), lemma)
        issues = []
        if pdf_article and bank_article and pdf_article not in ("der/die", "die/der"):
            if pdf_article != bank_article:
                issues.append(f"article: PDF='{pdf_article}' bank='{bank_article}'")
        if pdf_plural and bank_plural:
            if pdf_plural != bank_plural and not ("nur Sg." in meta.get("modifiers", []) or "nur Pl." in meta.get("modifiers", [])):
                issues.append(f"plural: PDF='{pdf_plural}' bank='{bank_plural}'")
        elif pdf_plural and not bank_plural:
            issues.append(f"plural: PDF='{pdf_plural}' bank=<none>")
        if issues:
            mismatch["noun"].append({
                "lemma": lemma,
                "text": text,
                "loc": fmt_loc(e),
                "issues": issues,
                "bank": {"article": bank_article, "plural": bank_plural, "english": n.get("english")},
            })
    elif kind == "verb":
        v = verb_lookup(lemma)
        if not v:
            # Maybe this is a participle being used as adjective ("vergangen",
            # "bescheiden", "gelassen", etc.) — try the adjective bank.
            a = adj_idx.get(lemma.lower())
            if a:
                found["adj"] += 1
                continue
            missing["verb"].append({"lemma": lemma, "text": text, "loc": fmt_loc(e)})
            continue
        found["verb"] += 1
        # Compare conjugation if PDF provides irregular forms in parens
        # Look for pattern "(verb-form, prät, hat/ist part)"
        pm = re.search(r"\(([^)]*?)\)", text)
        if pm:
            inner = pm.group(1)
            parts = [p.strip() for p in inner.split(",")]
            # Try last two as prät + perfekt
            if len(parts) >= 2:
                # last token usually "hat <pp>" or "ist <pp>"
                last = parts[-1]
                m_aux = re.match(r"^(hat|ist)\s+(\S+)$", last)
                pdf_perfekt = m_aux.group(2) if m_aux else None
                pdf_with_sein = (m_aux.group(1) == "ist") if m_aux else None
                # second-to-last is prät
                pdf_prat = parts[-2] if len(parts) >= 2 else None
                # Strip reflexive "sich" / "sich+pronoun" from forms before comparing
                def _strip_refl(s):
                    if s is None:
                        return None
                    return re.sub(r"\bsich\b\s*", "", s).strip()
                pdf_prat = _strip_refl(pdf_prat)
                pdf_perfekt = _strip_refl(pdf_perfekt)
                issues = []
                if pdf_prat and v.get("prateritum") and pdf_prat != v["prateritum"]:
                    # The PDF may give the 3rd-singular form (e.g. "verwies"). Bank uses 1st/3rd-sg form (often equal).
                    issues.append(f"präteritum: PDF='{pdf_prat}' bank='{v['prateritum']}'")
                if pdf_perfekt and v.get("perfekt") and pdf_perfekt != v["perfekt"]:
                    issues.append(f"perfekt: PDF='{pdf_perfekt}' bank='{v['perfekt']}'")
                if pdf_with_sein is not None and v.get("withSein") is not None and pdf_with_sein != v["withSein"]:
                    issues.append(f"aux: PDF={'sein' if pdf_with_sein else 'haben'} bank={'sein' if v['withSein'] else 'haben'}")
                if issues:
                    mismatch["verb"].append({
                        "lemma": lemma,
                        "text": text,
                        "loc": fmt_loc(e),
                        "issues": issues,
                        "bank": v,
                    })
    elif kind == "adj":
        a = adj_idx.get(lemma.lower())
        if not a:
            # Some "adjectives" here are actually verbs whose infinitive happens
            # to lack -en (e.g. "verjüngen" if we ever fall through). Also adverbs
            # / conjunctions / participles may live on their verb's lemma.
            v = verb_lookup(lemma)
            if v:
                found["verb"] += 1
                continue
            missing["adj"].append({"lemma": lemma, "text": text, "loc": fmt_loc(e)})
            continue
        found["adj"] += 1
    elif kind == "adj_stem":
        # Stems like manch-, all-, jen-: not in adjective bank typically
        a = adj_idx.get(lemma.lower())
        if not a:
            missing["adj_stem"].append({"lemma": lemma, "text": text, "loc": fmt_loc(e)})
        else:
            found["adj_stem"] += 1
    else:  # expression
        # Try to detect noun-with-article patterns like "der/die X, -n" first
        m = re.match(r"^(?:der\s*/\s*die|die\s*/\s*der|der/die|die/der)\s+([A-ZÄÖÜ][\wäöüÄÖÜß]*)", text)
        if m:
            w = m.group(1)
            n = noun_idx.get(w)
            if n:
                found["expression"] += 1
                continue
            else:
                missing["expression"].append({"lemma": w, "text": text, "loc": fmt_loc(e), "note": "substantivized adjective noun"})
                continue
        missing["expression"].append({"lemma": text, "text": text, "loc": fmt_loc(e)})

# Write reports
def write_md(path, title, sections):
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n")
        for sec_title, items in sections:
            f.write(f"## {sec_title} ({len(items)})\n\n")
            if not items:
                f.write("_None._\n\n")
                continue
            for it in items:
                line = f"- **{it['lemma']}** — `{it['text']}` {it.get('loc','')}"
                if "note" in it:
                    line += f" — _{it['note']}_"
                if "issues" in it:
                    line += "\n  - " + "\n  - ".join(it["issues"])
                    if "bank" in it and isinstance(it["bank"], dict):
                        if "article" in it["bank"]:
                            line += f"\n  - bank says: {it['bank'].get('article')} {it['lemma']}, pl: {it['bank'].get('plural')} ({it['bank'].get('english')})"
                        else:
                            line += f"\n  - bank: {json.dumps(it['bank'], ensure_ascii=False)}"
                f.write(line + "\n")
            f.write("\n")


write_md("audit/glossar_missing.md", "Vielfalt C1.1 glossary words missing from word bank",
         [("Nouns missing", missing["noun"]),
          ("Verbs missing", missing["verb"]),
          ("Adjectives missing", missing["adj"]),
          ("Adjective stems (filter words like manch-/all-)", missing["adj_stem"]),
          ("Expressions / multi-word entries (mostly not stored as single words)", missing["expression"])])

write_md("audit/glossar_mismatch.md", "Vielfalt C1.1 entries with disagreeing info",
         [("Nouns with article/plural mismatch", mismatch["noun"]),
          ("Verbs with conjugation mismatch", mismatch["verb"])])

# Summary
total_nouns = sum(1 for c in parsed if c["kind"] == "noun")
total_verbs = sum(1 for c in parsed if c["kind"] == "verb")
total_adjs = sum(1 for c in parsed if c["kind"] == "adj")
total_adj_stems = sum(1 for c in parsed if c["kind"] == "adj_stem")
total_exprs = sum(1 for c in parsed if c["kind"] == "expression")

total_in_pdf = total_nouns + total_verbs + total_adjs + total_adj_stems + total_exprs
total_found = found["noun"] + found["verb"] + found["adj"] + found["adj_stem"] + found["expression"]
total_missing = (len(missing["noun"]) + len(missing["verb"]) + len(missing["adj"])
                 + len(missing["adj_stem"]) + len(missing["expression"]))

with open("audit/glossar_summary.md", "w", encoding="utf-8") as f:
    f.write("# Vielfalt C1.1 Glossar audit summary\n\n")
    f.write(f"PDF: `Vielfalt_C1-1_Glossar_blanko.pdf` — {len(parsed)} entries parsed.\n\n")
    f.write(f"**Bottom line:** {total_found}/{total_in_pdf} entries are present in the website's word bank "
            f"({total_found * 100 // total_in_pdf}%). {total_missing} are missing. "
            f"Of the entries that match, only **{len(mismatch['noun']) + len(mismatch['verb'])}** disagree on "
            "stored info (article / plural / conjugation).\n\n")
    f.write("## Coverage by kind\n\n")
    f.write("| Kind | In PDF | Found in bank | Missing |\n")
    f.write("|---|---:|---:|---:|\n")
    f.write(f"| Nouns | {total_nouns} | {found['noun']} | {len(missing['noun'])} |\n")
    f.write(f"| Verbs | {total_verbs} | {found['verb']} | {len(missing['verb'])} |\n")
    f.write(f"| Adjectives | {total_adjs} | {found['adj']} | {len(missing['adj'])} |\n")
    f.write(f"| Adjective stems (manch-, all-, …) | {total_adj_stems} | {found['adj_stem']} | {len(missing['adj_stem'])} |\n")
    f.write(f"| Multi-word expressions | {total_exprs} | {found['expression']} | {len(missing['expression'])} |\n\n")
    f.write("## Mismatches between PDF and bank\n\n")
    f.write(f"- Nouns with article/plural mismatch: **{len(mismatch['noun'])}** — see `glossar_mismatch.md`.\n")
    f.write(f"- Verbs with conjugation mismatch: **{len(mismatch['verb'])}**.\n\n")
    f.write("## Notes on the missing list\n\n")
    f.write("- The bank is built from the Leipzig 1M-corpus frequency list, so domain-specific or "
            "low-frequency words used in the textbook (e.g. *Hafermilch*, *Schnapsidee*, *Kopfkino*) "
            "do not appear.\n")
    f.write("- Single-word adverbs / conjunctions / genitive prepositions (*mehrmals*, *somit*, "
            "*anlässlich*, *mangels*, *zumal* …) are stored in `adjectives.json` for translation "
            "and matching deck support.\n")
    f.write("- 'Adjective stems' (*manch-*, *all-*, *jen-*, …) are filter-words from a grammar drill "
            "and not really lemmas.\n")
    f.write("- Multi-word expressions (*außer Frage stehen*, *im Mittelpunkt stehen*, …) are by design "
            "not stored as single dictionary entries.\n\n")
    f.write("See `glossar_missing.md` for the per-word lists and `glossar_parsed.json` for the raw "
            "parse output.\n")

print("Wrote audit/glossar_missing.md, audit/glossar_mismatch.md, audit/glossar_summary.md")
print()
print(f"Nouns:   {total_nouns} total, {found['noun']} found, {len(missing['noun'])} missing, {len(mismatch['noun'])} mismatch")
print(f"Verbs:   {total_verbs} total, {found['verb']} found, {len(missing['verb'])} missing, {len(mismatch['verb'])} mismatch")
print(f"Adj:     {total_adjs} total, {found['adj']} found, {len(missing['adj'])} missing")
print(f"Stems:   {total_adj_stems} total, {found['adj_stem']} found, {len(missing['adj_stem'])} missing")
print(f"Expr:    {total_exprs} total, {found['expression']} found, {len(missing['expression'])} missing")
