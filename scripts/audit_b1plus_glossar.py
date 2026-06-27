"""Audit Vielfalt B1+ glossary against the local word banks.

Reuses the B2.2 audit logic (same PDF layout) and writes B1+-specific output.
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

base.RAW_PATH = Path("audit/b1plus_glossar_raw.txt")
base.PARSED_PATH = Path("audit/b1plus_glossar_parsed.json")
base.SUMMARY_PATH = Path("audit/b1plus_glossar_summary.md")
base.MISSING_PATH = Path("audit/b1plus_glossar_missing.md")
base.MISMATCH_PATH = Path("audit/b1plus_glossar_mismatch.md")
base.CANDIDATES_PATH = Path("audit/b1plus_glossar_candidates.md")
base.TRANSLATION_PATH = Path("audit/b1plus_translation_review.md")


# Same broad valency-prefixed entry handling that B2.1 uses
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
    text = text.replace("ï¬‚", "fl").replace("ï¬", "fi")
    # Strip footer that may bleed into entries
    text = re.sub(r"Vielfalt B1\+.*?Hueber Verlag\s+\d+\s+", "", text)
    text = text.strip()
    text = re.sub(r"^(?:jdn\. / sich|jdn\.|jdm\.|etw\.)\s+", "", text)
    return text.strip()


def main():
    raw_path = base.RAW_PATH
    cleaned_raw = raw_path.read_text(encoding="utf-8")
    cleaned_raw = cleaned_raw.replace("ﬂ", "fl").replace("ﬁ", "fi")
    cleaned_raw = re.sub(r"Vielfalt B1\+.*?Hueber Verlag\s+\d+\s*", "", cleaned_raw)
    cleaned_path = Path("audit/b1plus_glossar_raw_cleaned.txt")
    cleaned_path.write_text(cleaned_raw, encoding="utf-8")
    base.RAW_PATH = cleaned_path
    raw_entries = base.parse_raw()
    base.RAW_PATH = raw_path
    for entry in raw_entries:
        entry["text"] = normalize_text(entry["text"])
    raw_entries = [e for e in raw_entries if not e["text"].strip().isdigit()]

    parsed = [base.classify(entry) for entry in raw_entries]
    base.PARSED_PATH.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    found, missing, mismatch, vp_candidates, irregular_candidates, translation_flags = base.compare(parsed)
    base.write_reports(parsed, found, missing, mismatch, vp_candidates, irregular_candidates, translation_flags)

    for path in [base.SUMMARY_PATH, base.MISSING_PATH, base.MISMATCH_PATH, base.CANDIDATES_PATH, base.TRANSLATION_PATH]:
        text = path.read_text(encoding="utf-8")
        text = text.replace("Vielfalt B2.2", "Vielfalt B1+")
        text = text.replace("Vielfalt_B2-2_Glossar_blanko.pdf", "Vielfalt_B1plus_Glossar_blanko.pdf")
        path.write_text(text, encoding="utf-8")

    print(f"Parsed {len(parsed)} entries -> {base.PARSED_PATH}")
    print("Kinds:", dict(Counter(e["kind"] for e in parsed)))


if __name__ == "__main__":
    main()
