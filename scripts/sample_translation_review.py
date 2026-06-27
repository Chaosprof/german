#!/usr/bin/env python3
"""Sample bottom-half word-bank entries for manual translation review.

The sample is deterministic by round number so review rounds can be repeated.
It writes both JSON and Markdown under audit/random_translation_samples/.
"""

from __future__ import annotations

import json
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
AUDIT = ROOT / "audit"
DEEPL = AUDIT / "deepl"
DIFF = AUDIT / "deepl_diff"
OUT = AUDIT / "random_translation_samples"


SPECS = [
    ("nouns", DATA / "nouns.json", "nouns"),
    ("verbs", DATA / "verbs.json", "verbs"),
    ("adjectives", DATA / "adjectives.json", "adjectives"),
]


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_deepl(kind: str, value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if kind == "nouns":
        words = []
        for word in value.split():
            if word.isupper() and len(word) > 1:
                words.append(word)
            elif word[:1].isupper():
                words.append(word[:1].lower() + word[1:])
            else:
                words.append(word)
        return " ".join(words)
    if value[:1].isupper() and not value.isupper():
        return value[:1].lower() + value[1:]
    return value


def diff_lookup(kind: str) -> dict[tuple[str, int | None], dict]:
    path = DIFF / f"{kind}_classified.json"
    if not path.exists():
        return {}
    result = {}
    for row in load(path):
        result[(row["word"], row.get("rank"))] = row
    return result


def sample_kind(kind: str, path: Path, key: str, round_no: int, count: int) -> list[dict]:
    rows = sorted(load(path)[key], key=lambda row: (row.get("rank") is None, row.get("rank") or 0, row.get("word", "")))
    bottom = rows[len(rows) // 2 :]
    rng = random.Random(f"translation-review-round-{round_no}-{kind}")
    sampled = rng.sample(bottom, min(count, len(bottom)))
    deepl_map = load(DEEPL / f"{kind}.json") if (DEEPL / f"{kind}.json").exists() else {}
    diff = diff_lookup(kind)

    out = []
    for row in sorted(sampled, key=lambda row: (row.get("rank") or 0, row.get("word", ""))):
        drow = diff.get((row.get("word"), row.get("rank")), {})
        out.append(
            {
                "rank": row.get("rank"),
                "article": row.get("article") or "",
                "word": row.get("word"),
                "english": row.get("english") or "",
                "deepl": drow.get("deepl") or normalize_deepl(kind, deepl_map.get(row.get("word"), "")),
                "category": drow.get("category", ""),
            }
        )
    return out


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--round", type=int, required=True)
    parser.add_argument("--count", type=int, default=100)
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    payload = {}
    for kind, path, key in SPECS:
        payload[kind] = sample_kind(kind, path, key, args.round, args.count)

    json_path = OUT / f"round_{args.round:02d}.json"
    md_path = OUT / f"round_{args.round:02d}.md"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [f"# Random Translation Sample Round {args.round}", ""]
    for kind in ("nouns", "verbs", "adjectives"):
        lines.extend(
            [
                f"## {kind}",
                "",
                "| rank | article | word | current English | DeepL/cache | category |",
                "|---:|:---:|---|---|---|---|",
            ]
        )
        for row in payload[kind]:
            lines.append(
                f"| {row['rank']} | {row['article']} | {row['word']} | "
                f"{row['english']} | {row['deepl']} | {row['category']} |"
            )
        lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {json_path} and {md_path}")


if __name__ == "__main__":
    main()
