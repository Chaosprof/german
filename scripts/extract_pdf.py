"""Extract text from a PDF using pdftotext -raw, with === PAGE n === markers.

Usage: extract_pdf.py <input.pdf> <output.txt>
Mirrors the layout used by audit/b2_1_glossar_raw.txt so the existing
glossary audit/parse scripts can consume the result.
"""
import subprocess
import sys
from pathlib import Path

import pdfplumber


def main():
    pdf_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])

    with pdfplumber.open(pdf_path) as pdf:
        pages = len(pdf.pages)

    chunks = []
    for n in range(1, pages + 1):
        result = subprocess.run(
            [
                "pdftotext",
                "-raw",
                "-enc",
                "UTF-8",
                "-f",
                str(n),
                "-l",
                str(n),
                str(pdf_path),
                "-",
            ],
            capture_output=True,
            check=True,
        )
        chunks.append(f"=== PAGE {n} ===\n" + result.stdout.decode("utf-8"))

    out_path.write_text("".join(chunks), encoding="utf-8")
    print(f"Wrote {out_path} ({pages} pages)")


if __name__ == "__main__":
    main()
