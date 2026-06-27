"""Extract text from a PDF using PyMuPDF (handles fonts that pdftotext/pdfplumber cannot).

Usage: extract_pdf_pymupdf.py <input.pdf> <output.txt>
Writes === PAGE n === markers between pages.
"""
import sys
from pathlib import Path

import fitz  # type: ignore[import-untyped]


def main():
    pdf_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    doc = fitz.open(pdf_path)
    chunks = []
    for i, page in enumerate(doc, start=1):
        chunks.append(f"=== PAGE {i} ===\n" + page.get_text())
    out_path.write_text("".join(chunks), encoding="utf-8")
    print(f"Wrote {out_path} ({len(doc)} pages)")


if __name__ == "__main__":
    main()
