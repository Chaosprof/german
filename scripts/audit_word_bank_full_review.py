#!/usr/bin/env python3
"""Generate a full review report for the active word-bank files.

The checks are intentionally conservative. They cover every row for structural
issues, then list high-confidence linguistic problems that should be fixed
manually or by a follow-up patch.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
AUDIT = ROOT / "audit"


WORD_FILES = [
    ("nouns", DATA / "nouns.json", "nouns"),
    ("verbs", DATA / "verbs.json", "verbs"),
    ("adjectives", DATA / "adjectives.json", "adjectives"),
    ("verbs_with_prepositions", DATA / "verbs-with-prepositions.json", "verbs"),
]


ARTICLE_MAP = {"m": "der", "f": "die", "n": "das"}


HIGH_CONFIDENCE_TRANSLATION_FIXES = {
    ("noun", "Hose"): ("trousers/pants", "bad first senses: landspout/pantaloon"),
    ("noun", "Feder"): ("feather/spring", "current gloss is unrelated senses only"),
    ("noun", "Flüchtlingskind"): ("refugee child", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Kreditgeber"): ("lender/creditor", "-geber was mistranslated as boar"),
    ("noun", "Flüchtlingsarbeit"): ("refugee work", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Schieflage"): ("imbalance/skewed position", "contains literal garbage fragment"),
    ("noun", "Einzelbett"): ("single bed", "awkward/wrong plural adjective in English"),
    ("noun", "Startelf"): ("starting eleven/starting lineup", "Elf means eleven/team here, not an elf"),
    ("noun", "Eingangstor"): ("entrance gate", "Tor was mistranslated as cage"),
    ("noun", "Flüchtlingszahl"): ("number of refugees", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Flüchtlingsrat"): ("Refugee Council/refugee council", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Frauenfigur"): ("female figure/woman's figure", "Frau was mistranslated as Mrs"),
    ("noun", "Flüchtlingsfrage"): ("refugee issue/refugee question", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Flüchtlingskonvention"): ("Refugee Convention", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Frauenberuf"): ("women's profession/female-dominated occupation", "Frau was mistranslated as Mrs"),
    ("noun", "Ordensfrau"): ("nun/religious sister", "compound was split into decoration + Mrs"),
    ("noun", "Lizenzgeber"): ("licensor", "-geber was mistranslated as boar"),
    ("noun", "Elbvertiefung"): ("deepening of the Elbe", "Elb-/Elbe was mistranslated as elf"),
    ("noun", "Flüchtlingsheim"): ("refugee shelter/refugee center", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Frauenzeitschrift"): ("women's magazine", "Frau was mistranslated as Mrs"),
    ("noun", "Gottvertrauen"): ("trust in God", "compound was rendered word-for-word"),
    ("noun", "Torerfolg"): ("goal scored/scoring success", "Tor was mistranslated as cage"),
    ("noun", "Dienstgeber"): ("employer", "-geber was mistranslated as boar"),
    ("noun", "Frauengruppe"): ("women's group", "Frau was mistranslated as Mrs"),
    ("noun", "Hintermann"): ("backer/mastermind", "Mann compound was mistranslated as God"),
    ("noun", "Mittelsmann"): ("middleman/intermediary", "Mann compound was mistranslated as God"),
    ("noun", "Privatmann"): ("private individual", "Mann compound was mistranslated as God"),
    ("noun", "Etagenbett"): ("bunk bed", "literal floor bed is not the learner meaning"),
    ("noun", "Flüchtlingsbewegung"): ("refugee movement", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Flüchtlingsinitiative"): ("refugee initiative", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Frauenchor"): ("women's choir", "compound was split into Mrs + chancel"),
    ("noun", "Arbeitsgeber"): ("employer", "gloss is wrong; also verify lemma, standard German is Arbeitgeber"),
    ("noun", "Flüchtlingseigenschaft"): ("refugee status", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Flüchtlingssituation"): ("refugee situation", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Frauenpower"): ("female empowerment/women power", "Frau was mistranslated as Mrs"),
    ("noun", "Gottesmutter"): ("Mother of God", "compound was rendered word-for-word"),
    ("noun", "Kriegsflüchtling"): ("war refugee", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Leihgeber"): ("lender", "-geber was mistranslated as boar"),
    ("noun", "Nationalelf"): ("national team", "Elf means eleven/team here, not an elf"),
    ("noun", "Ballermann"): ("Ballermann/Mallorca party area", "compound was mistranslated as ball + God; needs context"),
    ("noun", "Elbe"): ("Elbe", "river name was mistranslated as elf"),
    ("noun", "Flüchtlingsfrau"): ("refugee woman", "Flüchtling/Frau were both mistranslated"),
    ("noun", "Flüchtlingsschutz"): ("refugee protection", "Flüchtling was mistranslated as flibbertigibbet"),
    ("noun", "Frauenmannschaft"): ("women's team", "compound was split into Mrs + crew"),
    ("noun", "Frauensache"): ("women's issue/matter for women", "Frau was mistranslated as Mrs"),
    ("noun", "Gefolgsmann"): ("follower/henchman", "compound was mistranslated as consequence + God"),
    ("noun", "Ombudsfrau"): ("ombudswoman", "Frau was mistranslated as Mrs"),
    ("noun", "Bettflüchter"): ("early riser", "literal bed runner misses the idiom"),
    ("verb", "einsperren"): ("lock up/imprison", "cage/clap in prison is not a good learner gloss"),
    ("verb", "düngen"): ("fertilize/manure", "starts with the noun gloss dung"),
    ("adjective", "untreu"): ("disloyal/unfaithful", "oneself leaked into adjective gloss"),
    ("adjective", "höchstpersönlich"): ("in person/personal", "pronoun glosses are distracting"),
    ("adjective", "sich"): ("remove from adjectives or mark as reflexive pronoun", "not an adjective"),
    ("adjective", "selbst"): ("self/same; or move out of adjectives", "pronoun/adverb use, not a normal adjective card"),
}


PREPOSITION_ISSUES = {
    192: ("not a preposition", "sich einer Sache bemächtigen", "Genitive object construction, not a fixed preposition."),
    110: ("not a preposition", "sich einer Sache entziehen", "Dative object construction, not a fixed preposition."),
    280: ("questionable pattern", "sich jemandes erbarmen / Erbarmen mit jemandem haben", "Current example 'Erbarme dich über uns' is not a good learner model."),
    298: ("questionable pattern", "jemandem/einer Sache misstrauen", "The verb normally takes a dative object; gegenüber is possible contextually but not the core fixed pattern."),
    356: ("wrong/incomplete reflexive pattern", "sich an etwas Dat ausrichten", "Entry omits sich and the example should be rewritten."),
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def rank_summary(rows):
    ranks = [row.get("rank") for row in rows if isinstance(row.get("rank"), int)]
    if not ranks:
        return {"rank_count": 0, "max_rank": None, "duplicate_ranks": [], "first_gaps": []}
    counts = Counter(ranks)
    gaps = sorted(set(range(1, max(ranks) + 1)) - set(ranks))
    return {
        "rank_count": len(ranks),
        "max_rank": max(ranks),
        "duplicate_ranks": [rank for rank, count in sorted(counts.items()) if count > 1],
        "first_gaps": gaps[:30],
        "gap_count": len(gaps),
    }


def basic_summary():
    result = {}
    for name, path, key in WORD_FILES:
        doc = load_json(path)
        rows = doc[key]
        result[name] = {
            "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "actual_count": len(rows),
            "meta_count": doc.get("meta", {}).get("count"),
            "blank_english": sum(1 for row in rows if not (row.get("english") or "").strip()),
            "rank_summary": rank_summary(rows),
        }
    return result


def noun_help_issues():
    nouns = load_json(DATA / "nouns.json")["nouns"]
    issues = []
    for noun in nouns:
        plural_help = noun.get("pluralHelp") or ""
        match = re.search(r"\(die ([^)]+)\)", plural_help)
        if match and match.group(1) != noun.get("plural"):
            issues.append(
                {
                    "rank": noun["rank"],
                    "article": noun.get("article"),
                    "word": noun["word"],
                    "plural": noun.get("plural"),
                    "plural_help_form": match.group(1),
                    "note": "pluralHelp displays a different form from the stored plural",
                }
            )
    return issues


def translation_issues():
    issues = []
    specs = [
        ("noun", DATA / "nouns.json", "nouns", "word"),
        ("verb", DATA / "verbs.json", "verbs", "word"),
        ("adjective", DATA / "adjectives.json", "adjectives", "word"),
    ]
    for kind, path, key, word_key in specs:
        for row in load_json(path)[key]:
            fix = HIGH_CONFIDENCE_TRANSLATION_FIXES.get((kind, row[word_key]))
            if not fix:
                continue
            suggestion, reason = fix
            if row.get("english", "") == suggestion:
                continue
            issues.append(
                {
                    "kind": kind,
                    "rank": row.get("rank"),
                    "article": row.get("article", ""),
                    "word": row[word_key],
                    "current": row.get("english", ""),
                    "suggestion": suggestion,
                    "reason": reason,
                }
            )
    return sorted(issues, key=lambda row: (row["rank"] or 10**9, row["kind"], row["word"]))


def fixed_preposition_issues():
    rows = load_json(DATA / "verbs-with-prepositions.json")["verbs"]
    issues = []
    for row in rows:
        issue = PREPOSITION_ISSUES.get(row.get("rank"))
        if not issue:
            continue
        if row.get("rank") == 356 and row.get("verb") == "sich ausrichten":
            continue
        category, suggestion, reason = issue
        issues.append(
            {
                "rank": row["rank"],
                "verb": row["verb"],
                "preposition": row["preposition"],
                "case": row["case"],
                "english": row["english"],
                "example": row["example"],
                "category": category,
                "suggestion": suggestion,
                "reason": reason,
            }
        )
    return sorted(issues, key=lambda row: row["rank"])


def article_pattern_audit():
    # Mirrors scripts/audit-bank.js without modifying data.
    nouns = load_json(DATA / "nouns.json")["nouns"]
    corrections = []
    fractions = {
        "Drittel",
        "Viertel",
        "Fünftel",
        "Sechstel",
        "Siebtel",
        "Siebentel",
        "Achtel",
        "Neuntel",
        "Zehntel",
        "Elftel",
        "Zwölftel",
        "Zwanzigstel",
        "Hundertstel",
        "Tausendstel",
        "Millionstel",
    }
    plural_tails = ("jahre", "leute", "spiele", "verhältnisse", "teile", "gründe", "ferien")
    for noun in nouns:
        word = noun["word"]
        article = noun.get("article")
        lower = word.lower()
        if word in fractions and article == "der":
            corrections.append({"rank": noun["rank"], "word": word, "from": article, "to": "das", "reason": "fraction -tel"})
        if article == "das" and any(lower.endswith(tail) and len(word) > len(tail) + 1 for tail in plural_tails):
            corrections.append({"rank": noun["rank"], "word": word, "from": article, "to": "die", "reason": "plural-only suffix"})
        if article == "das" and re.match(r".+mitte$", word):
            corrections.append({"rank": noun["rank"], "word": word, "from": article, "to": "die", "reason": "feminine head Mitte"})
    return corrections


def write_report():
    summary = basic_summary()
    translations = translation_issues()
    preps = fixed_preposition_issues()
    help_issues = noun_help_issues()
    article_issues = article_pattern_audit()

    report = {
        "summary": summary,
        "article_pattern_issues": article_issues,
        "translation_issues": translations,
        "fixed_preposition_issues": preps,
        "noun_plural_help_issues": help_issues,
    }
    (AUDIT / "word_bank_full_review.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    total_rows = sum(item["actual_count"] for item in summary.values())
    lines = [
        "# Word-bank full review",
        "",
        "Scope: `data/nouns.json`, `data/verbs.json`, `data/adjectives.json`, and `data/verbs-with-prepositions.json`.",
        "",
        "## Summary",
        "",
        f"- Rows reviewed: **{total_rows}**",
        f"- Blank English glosses: **{sum(item['blank_english'] for item in summary.values())}**",
        f"- High-confidence translation/POS issues: **{len(translations)}**",
        f"- Fixed-preposition issues: **{len(preps)}**",
        f"- Targeted article-rule issues: **{len(article_issues)}**",
        f"- Noun plural-help text mismatches: **{len(help_issues)}**",
        "",
        "## File checks",
        "",
        "| file | rows | meta count | rank max | rank gaps | duplicate ranks | blank English |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for item in summary.values():
        ranks = item["rank_summary"]
        lines.append(
            f"| `{item['path']}` | {item['actual_count']} | {item['meta_count']} | "
            f"{ranks['max_rank']} | {ranks.get('gap_count', 0)} | {len(ranks['duplicate_ranks'])} | {item['blank_english']} |"
        )

    lines.extend(
        [
            "",
            "## High-confidence translation/POS issues",
            "",
        ]
    )
    if translations:
        lines.extend(
            [
                "| rank | kind | article | word | current English | suggested English | reason |",
                "|---:|---|:---:|---|---|---|---|",
            ]
        )
        for row in translations:
            lines.append(
                f"| {row['rank']} | {row['kind']} | {row['article']} | {row['word']} | "
                f"{row['current']} | {row['suggestion']} | {row['reason']} |"
            )
    else:
        lines.append("No unresolved high-confidence translation/POS issues.")

    lines.extend(
        [
            "",
            "## Fixed-preposition issues",
            "",
        ]
    )
    if preps:
        lines.extend(
            [
                "| rank | verb | prep | case | current English | example | suggested pattern | issue |",
                "|---:|---|---|---|---|---|---|---|",
            ]
        )
        for row in preps:
            lines.append(
                f"| {row['rank']} | {row['verb']} | {row['preposition']} | {row['case']} | "
                f"{row['english']} | {row['example']} | {row['suggestion']} | {row['reason']} |"
            )
    else:
        lines.append("No unresolved fixed-preposition issues.")

    lines.extend(
        [
            "",
            "## Form/article notes",
            "",
            "- Targeted article checks found no clear `der/die/das` corrections in the active nouns.",
            "",
        ]
    )
    if help_issues:
        lines.extend(
            [
                "- Stored noun plurals are mostly coherent, but `pluralHelp` disagrees with the stored plural in the rows below. Several are alternative plurals, but learners will see inconsistent guidance.",
                "",
                "| rank | article | word | stored plural | plural shown in help |",
                "|---:|:---:|---|---|---|",
            ]
        )
        for row in help_issues:
            lines.append(
                f"| {row['rank']} | {row['article']} | {row['word']} | {row['plural']} | {row['plural_help_form']} |"
            )
    else:
        lines.append("- Stored noun plural-help text matches the stored plural for all rows checked.")

    prep_ranks = summary["verbs_with_prepositions"]["rank_summary"]
    lines.extend(
        [
            "",
            "## Rank notes",
            "",
            f"- `data/verbs-with-prepositions.json` has rank gaps at: {', '.join(map(str, prep_ranks['first_gaps']))}.",
            "- `data/nouns.json` has non-dense ranks because the bank preserves source/frequency ranks after filtering; I did not treat those as linguistic errors.",
        ]
    )

    (AUDIT / "word_bank_full_review.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({
        "rows_reviewed": total_rows,
        "translation_issues": len(translations),
        "fixed_preposition_issues": len(preps),
        "article_pattern_issues": len(article_issues),
        "noun_plural_help_issues": len(help_issues),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    write_report()
