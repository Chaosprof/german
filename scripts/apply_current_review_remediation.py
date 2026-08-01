#!/usr/bin/env python3
"""Apply the independently validated 2026-08-01 word-bank remediation.

Policy:
- exact manifest operations are applied directly;
- qualified CEFR recommendations become approximate ranges;
- structured verb senses are retained under `senses` while the common learner
  sense remains in the legacy top-level fields used by the website;
- a finding that cannot be represented exactly enough for a learner card is
  preserved as reference data with `learnerSafe: false`, never silently guessed;
- rows are not physically deleted, so ranks, textbook references, and stable IDs
  remain intact.

The script is idempotent and resolves rows by stable ID/source row identity.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
REMEDIATION = ROOT / "audit" / "current-review" / "remediation"
CEFR_RE = re.compile(r"\b(?:A1|A2|B1|B2|C1|C2)\b")


def load(path: Path, *, bom: bool = False):
    return json.loads(path.read_text(encoding="utf-8-sig" if bom else "utf-8"))


def save(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def set_path(root: dict, path: str, value) -> None:
    parts = re.findall(r"[^.\[\]]+|\d+(?=\])", path)
    target = root
    for part in parts[:-1]:
        if part.isdigit():
            target = target[int(part)]
        else:
            if part not in target or target[part] is None:
                target[part] = {}
            target = target[part]
    last = parts[-1]
    if last.isdigit():
        target[int(last)] = value
    else:
        target[last] = value


def remove_path(root: dict, path: str) -> None:
    parts = re.findall(r"[^.\[\]]+|\d+(?=\])", path)
    target = root
    for part in parts[:-1]:
        try:
            target = target[int(part)] if part.isdigit() else target[part]
        except (KeyError, IndexError, TypeError):
            return
    last = parts[-1]
    if isinstance(target, dict):
        target.pop(last, None)


def add_review_history(row: dict, *, finding_id: str, severity: str, action: str,
                       recommendation: str, disposition: str) -> None:
    history = row.setdefault("reviewHistory", [])
    if any(item.get("findingId") == finding_id for item in history):
        return
    history.append({
        "findingId": finding_id,
        "reviewedAt": "2026-08-01",
        "severity": severity,
        "action": action,
        "disposition": disposition,
        "recommendation": recommendation,
    })


def quarantine(row: dict, reason: str, recommendation: str) -> None:
    row["learnerSafe"] = False
    row["reviewStatus"] = "reference_only"
    issues = row.setdefault("referenceOnlyReasons", [])
    item = {"reason": reason, "recommendation": recommendation}
    if item not in issues:
        issues.append(item)


def apply_cefr_estimate(row: dict, recommendation: str) -> bool:
    levels = []
    for level in CEFR_RE.findall(recommendation or ""):
        if level not in levels:
            levels.append(level)
    if not levels:
        return False
    row["cefrLevel"] = levels[0]
    row["cefrApproximate"] = True
    if len(levels) > 1:
        row["cefrRange"] = levels
    else:
        row.pop("cefrRange", None)
    return True


def row_by_identity(rows: list[dict], *, index: int, stable_id: str | None,
                    word: str | None) -> dict:
    if stable_id:
        matches = [row for row in rows if row.get("id") == stable_id]
        if len(matches) == 1:
            return matches[0]
    if 0 <= index < len(rows):
        row = rows[index]
        if word is None or row.get("word", row.get("verb")) == word:
            return row
    raise ValueError(f"Could not resolve row id={stable_id!r} index={index} word={word!r}")


def apply_nouns(stats: Counter) -> None:
    manifest = load(REMEDIATION / "noun-fixes.json", bom=True)
    path = DATA / "nouns.json"
    doc = load(path)
    rows = doc["nouns"]

    for finding in manifest["items"]:
        finding_changed = False
        finding_quarantined = False
        recommendation = finding.get("validatedRecommendation") or finding.get("originalRecommendation") or ""
        for edit in finding["rowEdits"]:
            original = edit["originalIdentity"]
            current_keys = original.get("currentKeyFields", {})
            row = row_by_identity(
                rows,
                index=int(edit["sourceRow"]) - 1,
                stable_id=current_keys.get("id") or (f"noun-{int(current_keys['rank']):05d}" if current_keys.get("rank") is not None else None),
                word=original.get("word"),
            )
            action = edit["action"]
            for field, value in edit.get("setFields", {}).items():
                set_path(row, field, value)
                finding_changed = True
            for field in edit.get("fieldsToRemove", []):
                remove_path(row, field)
                finding_changed = True
            if edit.get("newSenseRecords"):
                row["senses"] = edit["newSenseRecords"]
                finding_changed = True
            if action in {"deactivate", "delete"}:
                row["active"] = False
                row["learnerSafe"] = False
                row["reviewStatus"] = "reference_only"
                finding_changed = True
                finding_quarantined = True

            if not finding["exact"]:
                if finding["category"] == "cefr":
                    finding_changed = apply_cefr_estimate(row, recommendation) or finding_changed
                elif not edit.get("setFields") or finding.get("unresolvedReasons"):
                    quarantine(row, "; ".join(finding.get("unresolvedReasons") or ["Qualified editorial remedy"]), recommendation)
                    finding_quarantined = True

            add_review_history(
                row,
                finding_id=finding["id"],
                severity=finding["validatedSeverity"],
                action=action,
                recommendation=recommendation,
                disposition="reference_only" if finding_quarantined else "corrected",
            )

        stats["noun_findings"] += 1
        stats["noun_changed"] += int(finding_changed)
        stats["noun_reference_only"] += int(finding_quarantined)

    if len(manifest["items"]) != 1829:
        raise ValueError("noun manifest count changed")
    doc["meta"]["reviewedAt"] = "2026-08-01"
    doc["meta"]["learnerSafeCount"] = sum(row.get("learnerSafe") is not False and row.get("active") is not False for row in rows)
    save(path, doc)


def clean_sense_record(source: dict, row_id: str) -> dict | None:
    sense: dict = {
        "id": f"{row_id}-sense-{source.get('sense_index', 1)}",
        "default": bool(source.get("default")),
    }
    for source_key, target_key in (("english", "english"), ("construction", "construction")):
        value = source.get(source_key)
        if value:
            sense[target_key] = value.strip(" `")
    if source.get("reflexive") in (True, False):
        sense["reflexive"] = source["reflexive"]
    if source.get("separability") not in (None, "unspecified"):
        sense["separability"] = source["separability"]
    valency = source.get("valency") or {}
    if valency.get("frame") or valency.get("case_markers"):
        sense["valency"] = {k: v for k, v in valency.items() if v not in (None, "", [], "unspecified")}
    auxiliary = source.get("auxiliary") or {}
    if auxiliary.get("values"):
        sense["auxiliaries"] = auxiliary["values"]
    parts = source.get("principal_parts") or {}
    explicit_parts = {
        "prateritum": parts.get("preterite"),
        "perfekt": parts.get("perfect_participle"),
    }
    explicit_parts = {key: value for key, value in explicit_parts.items() if value}
    if explicit_parts:
        sense["principalParts"] = explicit_parts
    patterns = source.get("attested_forms_or_patterns") or []
    if patterns:
        sense["patterns"] = patterns
    if len(sense) <= 2 and not source.get("source_remedy_segment"):
        return None
    if source.get("source_remedy_segment"):
        sense["editorialSource"] = source["source_remedy_segment"]
    return sense


def first_backtick_sentence(text: str) -> str | None:
    for candidate in re.findall(r"`([^`]+)`", text or ""):
        if candidate and candidate[-1:] in ".!?" and " " in candidate:
            return candidate
    return None


def apply_verbs(stats: Counter) -> None:
    manifest = load(REMEDIATION / "verb-fixes.json")
    docs = {
        "verbs": (DATA / "verbs.json", load(DATA / "verbs.json"), "verbs"),
        "verb_preps": (DATA / "verbs-with-prepositions.json", load(DATA / "verbs-with-prepositions.json"), "verbs"),
    }

    for finding in manifest["fixes"]:
        identity = finding["identity"]
        bank = identity["bank"]
        path, doc, key = docs[bank]
        row = row_by_identity(
            doc[key],
            index=int(identity["source_row_1_based"]) - 1,
            stable_id=identity.get("source_id"),
            word=(finding["current_record"].get("word") or finding["current_record"].get("verb")),
        )
        default = finding["backward_compatible_top_level_default"]
        changed = False
        for operation in default.get("fields_to_set", []):
            row[operation["field"]] = operation["value"]
            changed = True
        for field in default.get("fields_to_remove", []):
            row.pop(field, None)
            changed = True

        senses = [clean_sense_record(sense, row["id"]) for sense in finding.get("sense_records", [])]
        senses = [sense for sense in senses if sense]
        if senses:
            row["senses"] = senses
            changed = True

        recommendation = finding["validation"].get("validated_recommendation") or finding["finding"].get("original_recommendation") or ""
        action = finding["action"]
        if action == "update_cefr":
            changed = apply_cefr_estimate(row, recommendation) or changed
        if not default.get("fields_to_set"):
            default_sense = next((sense for sense in senses if sense.get("default") and sense.get("english")), None)
            if default_sense and bank == "verbs":
                row["english"] = default_sense["english"]
                changed = True
            elif bank == "verb_preps" and "example" in finding["finding"].get("field", ""):
                sentence = first_backtick_sentence(recommendation)
                if sentence:
                    row["example"] = sentence
                    changed = True

        reference_only = False
        if action in {"remove_record"}:
            row["active"] = False
            row["learnerSafe"] = False
            reference_only = True
            changed = True
        elif action == "update_morphology_or_split_senses":
            # These are precisely the entries for which one legacy paradigm
            # cannot safely stand for all senses. Preserve the rich senses but
            # do not drill a knowingly ambiguous top-level paradigm.
            quarantine(row, "Sense-dependent morphology cannot be losslessly represented by one legacy paradigm", recommendation)
            reference_only = True
        elif not changed:
            quarantine(row, "No exact learner-card update could be derived from the retained finding", recommendation)
            reference_only = True

        add_review_history(
            row,
            finding_id=finding["fix_id"],
            severity=finding["finding"]["effective_severity"],
            action=action,
            recommendation=recommendation,
            disposition="reference_only" if reference_only else "corrected",
        )
        stats[f"{bank}_findings"] += 1
        stats[f"{bank}_changed"] += int(changed)
        stats[f"{bank}_reference_only"] += int(reference_only)

    for bank, (path, doc, key) in docs.items():
        doc["meta"]["reviewedAt"] = "2026-08-01"
        doc["meta"]["learnerSafeCount"] = sum(row.get("learnerSafe") is not False and row.get("active") is not False for row in doc[key])
        if bank == "verbs":
            doc["meta"]["irregularCount"] = sum(bool(row.get("irregular")) for row in doc[key])
        save(path, doc)


def apply_adjectives_and_dual(stats: Counter) -> None:
    manifest = load(REMEDIATION / "adjective-dual-fixes.json")
    docs = {
        "adjectives": (DATA / "adjectives.json", load(DATA / "adjectives.json"), "adjectives"),
        "dual_gender": (DATA / "dual-gender-nouns.json", load(DATA / "dual-gender-nouns.json"), "nouns"),
    }
    for finding in manifest["fixes"]:
        identity = finding["identity"]
        bank = identity["bank"]
        path, doc, key = docs[bank]
        row = row_by_identity(
            doc[key],
            index=int(identity["zeroBasedIndex"]),
            stable_id=finding["current"].get("id"),
            word=identity.get("word"),
        )
        safe = finding["exactness"]["safeToApplyExactly"]
        changed = False
        for operation in finding["operations"].get("set", []):
            set_path(row, operation["path"], operation["value"])
            changed = True
        for field in finding["operations"].get("remove", []):
            remove_path(row, field)
            changed = True
        if finding["operations"].get("split"):
            row["senses"] = finding["operations"]["split"]
            changed = True

        recommendation = finding["finding"].get("recommended") or ""
        reference_only = False
        if not safe:
            if finding["finding"].get("category") == "cefr":
                changed = apply_cefr_estimate(row, recommendation) or changed
            else:
                quarantine(row, "; ".join(finding["exactness"].get("manualFlags") or ["Qualified editorial remedy"]), recommendation)
                reference_only = True
        if finding["action"].startswith("deactivate_"):
            row["active"] = False
            row["learnerSafe"] = False
            reference_only = True
        if finding["learnerSafety"].get("excludeFromCoreDrills"):
            row.setdefault("learnerSafety", {})["excludeFromCoreDrills"] = True

        add_review_history(
            row,
            finding_id=finding["id"],
            severity=finding["validation"]["effectiveSeverity"],
            action=finding["action"],
            recommendation=recommendation,
            disposition="reference_only" if reference_only else "corrected",
        )
        stats[f"{bank}_findings"] += 1
        stats[f"{bank}_changed"] += int(changed)
        stats[f"{bank}_reference_only"] += int(reference_only)

    for bank, (path, doc, key) in docs.items():
        doc["meta"]["reviewedAt"] = "2026-08-01"
        doc["meta"]["learnerSafeCount"] = sum(row.get("learnerSafe") is not False and row.get("active") is not False for row in doc[key])
        save(path, doc)


def main() -> None:
    stats: Counter = Counter()
    apply_nouns(stats)
    apply_verbs(stats)
    apply_adjectives_and_dual(stats)
    expected = {
        "noun_findings": 1829,
        "verbs_findings": 633,
        "verb_preps_findings": 25,
        "adjectives_findings": 763,
        "dual_gender_findings": 30,
    }
    for key, value in expected.items():
        if stats[key] != value:
            raise ValueError(f"{key}: expected {value}, got {stats[key]}")
    stats["total_findings"] = sum(stats[key] for key in expected)
    if stats["total_findings"] != 3280:
        raise ValueError("retained finding reconciliation failed")
    print(json.dumps(dict(sorted(stats.items())), indent=2))


if __name__ == "__main__":
    main()
