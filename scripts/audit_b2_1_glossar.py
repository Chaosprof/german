"""Audit Vielfalt B2.1 glossary against the local word banks.

This is a thin B2.1 wrapper around the B2.2 audit logic because both PDFs use
the same glossary layout. It writes B2.1-specific audit files.
"""
import importlib.util
import json
import re
from collections import Counter
from pathlib import Path


BASE_PATH = Path(__file__).with_name("audit_b2_2_glossar.py")
spec = importlib.util.spec_from_file_location("audit_b2_base", BASE_PATH)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

base.RAW_PATH = Path("audit/b2_1_glossar_raw.txt")
base.PARSED_PATH = Path("audit/b2_1_glossar_parsed.json")
base.SUMMARY_PATH = Path("audit/b2_1_glossar_summary.md")
base.MISSING_PATH = Path("audit/b2_1_glossar_missing.md")
base.MISMATCH_PATH = Path("audit/b2_1_glossar_mismatch.md")
base.CANDIDATES_PATH = Path("audit/b2_1_glossar_candidates.md")
base.TRANSLATION_PATH = Path("audit/b2_1_translation_review.md")

# B2.1 has a few object-prefixed entries ("jdn. / sich an|lügen",
# "etw. zu|geben") and valency-only entries ("wagen + Akk."). Treat those as
# verbs for the audit instead of leaving them in the expression bucket.
base._VERBY_REST_RE = re.compile(
    r"^(?:"
    r"|\(sich\).*"
    r"|\([^)]*\)(?:\s*\([^)]*\))*"
    r"|(?:auf|an|zu|in|bei|mit|von|über|um|für|nach|gegen|gegenüber|unter|zwischen|als|durch|vor)\s*\+\s*(Akk\.|Dat\.|Gen\.).*"
    r"|\+\s*(Akk\.|Dat\.|Gen\.).*"
    r"|sich\s.*"
    r"|wie$"
    r")$",
    re.IGNORECASE,
)


def normalize_text(text):
    text = text.replace("ﬂ", "fl").replace("ﬁ", "fi")
    text = text.replace("ï¬‚", "fl").replace("ï¬", "fi")
    text = re.sub(r"Vielfalt B2\.1.*?Hueber Verlag\s+\d+\s+", "", text)
    text = text.strip()
    if text == "halten für":
        text = "halten für + Akk."
    text = re.sub(r"^(?:jdn\. / sich|jdn\.|jdm\.|etw\.)\s+", "", text)
    text = re.sub(r"^Vertreten\b", "vertreten", text)
    return text.strip()


def main():
    raw_path = base.RAW_PATH
    cleaned_raw = raw_path.read_text(encoding="utf-8")
    cleaned_raw = cleaned_raw.replace("ﬂ", "fl").replace("ﬁ", "fi")
    cleaned_raw = cleaned_raw.replace("ï¬‚", "fl").replace("ï¬", "fi")
    cleaned_raw = re.sub(r"Vielfalt B2\.1.*?Hueber Verlag\s+\d+\s*", "", cleaned_raw)
    cleaned_path = Path("audit/b2_1_glossar_raw_cleaned.txt")
    cleaned_path.write_text(cleaned_raw, encoding="utf-8")
    base.RAW_PATH = cleaned_path
    raw_entries = base.parse_raw()
    base.RAW_PATH = raw_path
    for entry in raw_entries:
        entry["text"] = normalize_text(entry["text"])
    raw_entries = [entry for entry in raw_entries if not entry["text"].strip().isdigit()]

    parsed = [base.classify(entry) for entry in raw_entries]
    base.PARSED_PATH.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    found, missing, mismatch, vp_candidates, irregular_candidates, translation_flags = base.compare(parsed)
    mismatch["noun"] = [
        item for item in mismatch["noun"]
        if item[0]["lemma"] not in {"Angst", "Fazit", "Sauna", "Coach"}
    ]
    mismatch["verb"] = [
        item for item in mismatch["verb"]
        if item[0]["lemma"] != "wahrnehmen"
    ]
    vp_candidates = [
        item for item in vp_candidates
        if item["entry"]["text"] not in {"verbunden mit + Dat.", "offen für + Akk."}
    ]
    base.write_reports(parsed, found, missing, mismatch, vp_candidates, irregular_candidates, translation_flags)

    for path in [base.SUMMARY_PATH, base.MISSING_PATH, base.MISMATCH_PATH, base.CANDIDATES_PATH, base.TRANSLATION_PATH]:
      text = path.read_text(encoding="utf-8")
      text = text.replace("Vielfalt B2.2", "Vielfalt B2.1")
      text = text.replace("Vielfalt_B2-2_Glossar_blanko.pdf", "Vielfalt_B2-1_Glossar_blanko.pdf")
      path.write_text(text, encoding="utf-8")

    print(f"Parsed {len(parsed)} entries -> {base.PARSED_PATH}")
    print("Kinds:", dict(Counter(e["kind"] for e in parsed)))
    print(f"Wrote {base.SUMMARY_PATH}, {base.MISSING_PATH}, {base.MISMATCH_PATH}, {base.CANDIDATES_PATH}, {base.TRANSLATION_PATH}")


if __name__ == "__main__":
    main()
