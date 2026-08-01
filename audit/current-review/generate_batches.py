#!/usr/bin/env python3
"""Create review-only TSV batches from the current word bank."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "audit" / "current-review" / "batches"
BATCH_SIZE = 700


def load(name: str, key: str) -> list[dict]:
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))[key]


SPECS = [
    (
        "nouns",
        load("nouns.json", "nouns"),
        ["row", "rank", "article", "word", "plural", "english", "cefrLevel", "flags"],
    ),
    (
        "verbs",
        load("verbs.json", "verbs"),
        ["row", "rank", "word", "irregular", "prateritum", "perfekt", "withSein", "english", "cefrLevel", "source"],
    ),
    (
        "adjectives",
        load("adjectives.json", "adjectives"),
        ["row", "rank", "word", "english", "cefrLevel", "source", "flags"],
    ),
    (
        "verb_preps",
        load("verbs-with-prepositions.json", "verbs"),
        ["row", "rank", "verb", "preposition", "case", "english", "example"],
    ),
]


def flags(row: dict) -> str:
    return ",".join(
        key
        for key in ("adjectivalNoun", "properNoun", "pluralOnly", "weakNoun")
        if row.get(key)
    )


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*.tsv"):
    old.unlink()

manifest = []
for bank, rows, fields in SPECS:
    for batch_no, start in enumerate(range(0, len(rows), BATCH_SIZE), 1):
        chunk = rows[start : start + BATCH_SIZE]
        name = f"{bank}_{batch_no:03d}"
        path = OUT / f"{name}.tsv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", extrasaction="ignore")
            writer.writeheader()
            for offset, source in enumerate(chunk, start + 1):
                row = dict(source)
                row["row"] = offset
                row["flags"] = flags(row)
                writer.writerow({field: row.get(field, "UNSET") for field in fields})
        manifest.append(
            {
                "batch": name,
                "bank": bank,
                "entries": len(chunk),
                "source_row_start": start + 1,
                "source_row_end": start + len(chunk),
                "first_word": chunk[0].get("word", chunk[0].get("verb")),
                "last_word": chunk[-1].get("word", chunk[-1].get("verb")),
                "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            }
        )

(OUT.parent / "manifest.json").write_text(
    json.dumps({"batch_size": BATCH_SIZE, "total": sum(x["entries"] for x in manifest), "batches": manifest}, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

# The app also exposes a curated dual-gender deck. These 98 spellings overlap the
# primary noun bank, so keep them out of the 41,015-row coverage denominator but create
# one supplemental batch to verify all sense/article/plural combinations.
dual_rows = load("dual-gender-nouns.json", "nouns")
dual_path = OUT / "dual_gender_001.tsv"
dual_fields = ["row", "rank", "word", "genders", "bothInDrills"]
with dual_path.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=dual_fields, delimiter="\t", extrasaction="ignore")
    writer.writeheader()
    for offset, source in enumerate(dual_rows, 1):
        writer.writerow(
            {
                "row": offset,
                "rank": source.get("rank", "UNSET"),
                "word": source.get("word", ""),
                "genders": json.dumps(source.get("genders", []), ensure_ascii=False, separators=(",", ":")),
                "bothInDrills": source.get("bothInDrills", False),
            }
        )
(OUT.parent / "supplemental-manifest.json").write_text(
    json.dumps(
        {
            "batches": [
                {
                    "batch": "dual_gender_001",
                    "entries": len(dual_rows),
                    "first_word": dual_rows[0]["word"],
                    "last_word": dual_rows[-1]["word"],
                    "path": str(dual_path.relative_to(ROOT)).replace("\\", "/"),
                }
            ]
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print(
    f"Wrote {len(manifest)} primary batches containing {sum(x['entries'] for x in manifest)} entries "
    f"plus {len(dual_rows)} supplemental dual-gender entries"
)
