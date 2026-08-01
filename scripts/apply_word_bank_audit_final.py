#!/usr/bin/env python3
"""Apply the unambiguous, learner-safe corrections from WORD-BANK-AUDIT-FINAL.

The final audit is prose rather than a patch: some findings name one exact row,
some group many rows, and some propose editorial choices that are not universally
correct.  This migration deliberately applies only corrections that resolve to a
specific row and a concrete value.  It also handles the two confirmed contamination
blocks and a small set of verb paradigms whose intended learner sense is explicit.

Run without --apply for a dry run.  The script is idempotent.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
AUDIT = ROOT / "audit" / "findings-consolidated.json"
BANK_KEYS = {"nouns": "nouns", "verbs": "verbs", "adjectives": "adjectives"}
ARTICLES = {"der", "die", "das"}

# These entries are already represented sense-by-sense in dual-gender-nouns.json,
# or the audit rejects a standard accepted variant.  Flattening them would regress
# the existing dual-gender drill support.
ARTICLE_EXCLUSIONS = {"Alzheimer", "Cannabis", "Release"}

# The bare plural depends on the determiner.  The existing -en values agree with
# the definite-article prompt used by the noun bank (die Erwachsenen, etc.).
ADJECTIVAL_PLURAL_EXCLUSIONS = True
PLURAL_OVERRIDES = {"Fasching", "Humor", "Müsli"}
NULL_PLURAL_WORDS = {
    "Schulkleidung", "Dings", "Tango-Musik", "Beste", "Arztkleidung",
    "Englisch-Studium", "Sprachenlernen", "Kitesurfen", "Hasilein",
    "Ticketwahl", "Hardrock", "Pop",
}

# The audit accidentally supplies an English possessive for this verb.
GLOSS_OVERRIDES = {
    ("nouns", "Angina"): "tonsillitis/throat infection",
    ("nouns", "Beruhigungssauger"): "dummy",
    ("nouns", "Bete"): "beetroot (only in Rote Bete)",
    ("nouns", "Flugbegleiterin"): "flight attendant",
    ("nouns", "Hexenwerk"): "witchcraft/sorcery; difficult task (usually kein Hexenwerk)",
    ("nouns", "Ironisierung"): "ironic treatment",
    ("nouns", "Notensystem"): "marking system",
    ("nouns", "Pfeife"): "whistle/pipe; wimp (colloquial)",
    ("nouns", "Pulli"): "jumper (informal)",
    ("nouns", "Schuld"): "guilt/fault; debt (plural: debts)",
    ("nouns", "Schwarm"): "swarm/flock/shoal; crush (person one fancies)",
    ("nouns", "Sud"): "stock/broth/decoction",
    ("verbs", "entgegenwerfen"): "throw back/retort",
    ("verbs", "abatmen"): "eliminate by breathing/breathe off (technical)",
    ("verbs", "aussteuern"): "adjust the gain/level (audio); control/phase out",
    ("verbs", "umgehen"): "handle/deal with; go around",
    ("verbs", "verziehen"): "spoil (a child); warp/distort",
    ("verbs", "wiederhaben"): "have/get back",
    ("verbs", "übergießen"): "pour over/douse; spill over",
    ("adjectives", "bedient"): "fed up/had enough (bedient sein)",
    ("adjectives", "endlich"): "finite (mathematics/philosophy); finally/at last (adverb)",
    ("adjectives", "evangelikal"): "evangelical",
    ("adjectives", "fatal"): "disastrous/unfortunate; fatal",
    ("adjectives", "gar"): "cooked/done; even/at all (particle)",
    ("adjectives", "geil"): "awesome/great (colloquial); horny (vulgar)",
    ("adjectives", "krass"): "blatant/glaring/extreme; awesome (colloquial)",
    ("adjectives", "plump"): "clumsy/crude/unsubtle",
    ("adjectives", "rauch"): "rough/hairy (archaic or dialectal)",
    ("adjectives", "rassenkundlich"): "relating to racial science (historical, offensive)",
    ("adjectives", "weh"): "sore/painful (especially in weh tun)",
    ("adjectives", "zeichnerisch"): "graphic/relating to drawing",
    ("nouns", "Stuten"): "sweet white loaf (regional)",
    ("nouns", "Sommernachtstraum"): "A Midsummer Night's Dream",
}

EXPLICIT_ADJECTIVE_REMOVALS = {
    "entgegengebracht", "her", "hierbei", "karikativ", "voller",
}

# Sense choices that cannot be represented by the current single-paradigm schema.
# For these entries we choose the common learner sense named by the audit.
VERB_FORM_FIXES = {
    "wenden": ("wendete", "gewendet", False, False),
    "senden": ("sendete", "gesendet", False, False),
    "schaffen": ("schaffte", "geschafft", False, False),
    "backen": ("backte", "gebacken", True, False),
    "abwenden": ("wendete ab", "abgewendet", False, False),
    "entsenden": ("entsandte", "entsandt", True, False),
    "dabeihaben": ("hatte dabei", "dabeigehabt", True, False),
    "mithaben": ("hatte mit", "mitgehabt", True, False),
    "unterschlagen": ("unterschlug", "unterschlagen", True, False),
    "zurückwollen": ("wollte zurück", "zurückgewollt", True, False),
    "wegwollen": ("wollte weg", "weggewollt", True, False),
    "guthaben": ("hatte gut", "gutgehabt", True, False),
    "überbacken": ("überbackte", "überbacken", True, False),
    "durchscheinen": ("schien durch", "durchgeschienen", True, False),
    "verschleißen": ("verschliss", "verschlissen", True, False),
    "melken": ("molk", "gemolken", True, False),
    "glimmen": ("glomm", "geglommen", True, False),
    "durchstechen": ("stach durch", "durchgestochen", True, False),
    "vorbacken": ("backte vor", "vorgebacken", True, False),
    "dünken": ("dünkte", "gedünkt", True, False),
    "entflechten": ("entflocht", "entflochten", True, False),
    "schwellen": ("schwoll", "geschwollen", True, True),
    "beschreiten": ("beschritt", "beschritten", True, False),
    "herumschlagen": ("schlug herum", "herumgeschlagen", True, False),
    "aufliegen": ("lag auf", "aufgelegen", True, False),
    "herausfließen": ("floss heraus", "herausgeflossen", True, True),
    "aufspringen": ("sprang auf", "aufgesprungen", True, True),
    "durchbeißen": ("biss durch", "durchgebissen", True, False),
    "freinehmen": ("nahm frei", "freigenommen", True, False),
    "hinauswachsen": ("wuchs hinaus", "hinausgewachsen", True, True),
    "verhelfen": ("verhalf", "verholfen", True, False),
    "näherkommen": ("kam näher", "nähergekommen", True, True),
    "zurückdenken": ("dachte zurück", "zurückgedacht", True, False),
    "mitsprechen": ("sprach mit", "mitgesprochen", True, False),
    "mitlesen": ("las mit", "mitgelesen", True, False),
    "nachsprechen": ("sprach nach", "nachgesprochen", True, False),
    "drankommen": ("kam dran", "drangekommen", True, True),
    "rausgehen": ("ging raus", "rausgegangen", True, True),
    "zurückfahren": ("fuhr zurück", "zurückgefahren", True, True),
    "zurückfinden": ("fand zurück", "zurückgefunden", True, False),
    "einsenden": ("sandte ein", "eingesandt", True, False),
    "besehen": ("besah", "besehen", True, False),
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def save_compact(path: Path, value) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def clean_markup(value: str) -> str:
    value = value.replace("*", "").replace("`", "")
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value


def finding_word(value: str) -> str | None:
    value = clean_markup(value)
    value = re.sub(r"^(?:der|die|das)\s+", "", value)
    if any(mark in value for mark in (" / ", ", ", "[", "]", " entries", "group", "GROUP")):
        return None
    return value or None


def resolve_row(finding: dict, rows: list[dict], index: dict[str, list[int]]) -> int | None:
    word = finding_word(finding.get("word", ""))
    if not word:
        return None
    candidates = index.get(word, [])
    if len(candidates) == 1:
        return candidates[0]
    if not candidates:
        return None

    current = finding.get("current", "")
    scored = []
    for pos in candidates:
        row = rows[pos]
        score = 0
        for field in ("article", "plural", "english"):
            value = row.get(field)
            if value and str(value) in current:
                score += 1
        scored.append((score, pos))
    scored.sort(reverse=True)
    if scored and scored[0][0] > 0 and (len(scored) == 1 or scored[0][0] > scored[1][0]):
        return scored[0][1]
    return None


def extract_gloss(correct: str) -> str | None:
    value = correct.strip()
    full_code = re.fullmatch(r"`([^`]+)`[.!]?", value)
    if full_code:
        return clean_markup(full_code.group(1))

    # Quoted text is how the reviewers most consistently marked the replacement.
    for match in re.finditer(r'[“"]([^”"]+)[”"]', value):
        prefix = value[max(0, match.start() - 16):match.start()].lower()
        if re.search(r"(?:not|rather than)\s+$", prefix):
            continue
        return clean_markup(match.group(1))

    lower = value.lower()
    rejected_starts = (
        "add ", "front ", "lead ", "keep ", "remove", "drop", "replace ",
        "use ", "prefer ", "retain ", "correct ", "split", "one form",
        "standardise", "standardize", "see ", "same ", "n/a", "both ",
        "fine ", "only ", "the adjective", "the noun", "for the ", "this ",
    )
    if lower.startswith(rejected_starts) or "cefr" in lower:
        return None
    if any(marker in lower for marker in ("why:", "better: remove", "better: drop", "should be removed")):
        return None

    # Remove reviewer rationale while retaining sense/register qualifications.
    value = re.split(r"\s+/\s+(?:why|reason):", value, maxsplit=1, flags=re.I)[0]
    value = re.split(r";\s+(?:the .*?should|plural .*?should|mark as|cefr\b)", value, maxsplit=1, flags=re.I)[0]
    value = clean_markup(value)
    if not value or len(value) > 180:
        return None
    return value


def extract_article(correct: str) -> str | None:
    articles = re.findall(r"\b(der|die|das)\b", clean_markup(correct))
    unique = list(dict.fromkeys(articles))
    return unique[0] if len(unique) == 1 else None


def extract_plural(correct: str, word: str) -> str | None:
    value = clean_markup(correct)
    patterns = (
        r"→\s*(—|[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]*)\b",
        rf"^(?:der|die|das)\s+{re.escape(word)}\s*/\s*([^/;()]+)",
        r"\bpl\.\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]*|—)",
        r"^(—|[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]*)\b",
    )
    for pattern in patterns:
        match = re.search(pattern, value)
        if match:
            candidate = match.group(1).strip()
            if " " not in candidate and candidate not in ARTICLES:
                return candidate
    return None


def words_named_in_finding(finding: dict, known_words: set[str]) -> set[str]:
    values = [finding.get("word", ""), finding.get("current", "")]
    found: set[str] = set()
    for value in values:
        for token in re.findall(r"`([^`]+)`", value):
            token = re.sub(r"^(?:der|die|das)\s+", "", token.strip())
            if token in known_words:
                found.add(token)
        for token in re.split(r"\s*/\s*|,\s*", finding.get("word", "")):
            token = clean_markup(token)
            if token in known_words:
                found.add(token)
    return found


def markdown_group_words(path: Path, known_words: set[str]) -> set[str]:
    """Recover grouped word lists that the JSON consolidator truncated at line one."""
    text = path.read_text(encoding="utf-8")
    found: set[str] = set()
    for block in re.split(r"(?m)^- \*\*", text)[1:]:
        header = block.splitlines()[0]
        if "category=notadj" not in header and "category=junk" not in header:
            continue
        if "severity=high" not in header and "severity=medium" not in header:
            continue
        current_match = re.search(r"(?ms)^  current:\s*(.*?)^  correct:", block)
        if not current_match:
            continue
        current = current_match.group(1)
        for token in re.findall(r"[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*", current):
            if token in known_words:
                found.add(token)
    return found


def contaminated_verb_ranks(path: Path) -> set[int]:
    """Read the two explicit rank lists in verbs_008 without catching dup references."""
    text = path.read_text(encoding="utf-8")
    ranks: set[int] = set()
    sections = (
        ("Affected ranks/words:", "- **[GROUP] not verbs at all"),
        ("why: nothing about these can be conjugated.", "- **verargumentieren**"),
    )
    for start_marker, end_marker in sections:
        start = text.find(start_marker)
        end = text.find(end_marker, start + 1)
        if start < 0:
            continue
        section = text[start:end if end >= 0 else None]
        section = re.sub(r"\(dup(?:licate)?\s+of[^)]*\)", "", section, flags=re.I)
        for match in re.finditer(r"\b(\d{4})\s+[^\s,(]+", section):
            ranks.add(int(match.group(1)))
    return ranks


def is_nominalized_infinitive(noun: dict, verb_words: set[str]) -> bool:
    return noun.get("article") == "das" and noun.get("word", "").lower() in verb_words


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes to data files")
    args = parser.parse_args()

    docs = {bank: load(DATA / f"{bank}.json") for bank in BANK_KEYS}
    rows_by_bank = {bank: docs[bank][key] for bank, key in BANK_KEYS.items()}
    indexes: dict[str, dict[str, list[int]]] = {}
    for bank, rows in rows_by_bank.items():
        index: dict[str, list[int]] = defaultdict(list)
        for pos, row in enumerate(rows):
            index[row["word"]].append(pos)
        indexes[bank] = index

    dual_doc = load(DATA / "dual-gender-nouns.json")
    dual_rows = dual_doc.get("nouns", dual_doc.get("dualGenderNouns", []))
    dual_words = {row.get("word") for row in dual_rows}
    article_exclusions = ARTICLE_EXCLUSIONS | dual_words
    findings = load(AUDIT)
    changes = Counter()
    skipped = Counter()
    touched: dict[str, set[str]] = defaultdict(set)
    article_help_words: set[str] = set()
    plural_help_words: set[str] = set()

    # Apply exact field corrections first.
    for finding in findings:
        bank = finding.get("bank")
        if bank not in rows_by_bank:
            continue
        rows = rows_by_bank[bank]
        pos = resolve_row(finding, rows, indexes[bank])
        if pos is None:
            skipped[f"{bank}:unresolved"] += 1
            continue
        row = rows[pos]
        word = row["word"]
        category = finding.get("category")
        field = finding.get("field", "")

        if category == "gloss" or field == "english":
            target = GLOSS_OVERRIDES.get((bank, word)) or extract_gloss(finding.get("correct", ""))
            if target and target != row.get("english"):
                row["english"] = target
                changes[f"{bank}:english"] += 1
                touched[bank].add(word)
            elif not target:
                skipped[f"{bank}:gloss-editorial"] += 1

        if bank == "nouns" and category == "article":
            if word in article_exclusions:
                skipped["nouns:article-variant"] += 1
            else:
                target = extract_article(finding.get("correct", ""))
                if target:
                    article_help_words.add(word)
                    if target != row.get("article"):
                        row["article"] = target
                        changes["nouns:article"] += 1
                        touched[bank].add(word)

        if bank == "nouns" and category == "plural":
            if word in PLURAL_OVERRIDES:
                skipped["nouns:plural-override"] += 1
            elif ADJECTIVAL_PLURAL_EXCLUSIONS and row.get("adjectivalNoun"):
                skipped["nouns:adjectival-plural"] += 1
            else:
                target = extract_plural(finding.get("correct", ""), word)
                if target:
                    plural_help_words.add(word)
                    if target != row.get("plural"):
                        row["plural"] = target
                        changes["nouns:plural"] += 1
                        touched[bank].add(word)

        if bank == "nouns" and field in {"flags", "flag"}:
            correct = finding.get("correct", "")
            flag_map = {
                "adjNoun": "adjectivalNoun",
                "weak": "weak",
                "pluraleTantum": "pluraleTantum",
            }
            for marker, key in flag_map.items():
                if marker.lower() in correct.lower() and row.get(key) is not True:
                    row[key] = True
                    changes[f"nouns:{key}"] += 1
                    touched[bank].add(word)

        if bank == "adjectives" and field in {"flags", "flag"}:
            correct = finding.get("correct", "").lower()
            if "notdeclinable" in correct or "predicative-only" in correct:
                if not row.get("notDeclinable"):
                    row["notDeclinable"] = True
                    changes["adjectives:notDeclinable"] += 1
                    touched[bank].add(word)
            elif "declinable" in correct and row.pop("notDeclinable", None) is not None:
                changes["adjectives:declinable"] += 1
                touched[bank].add(word)

        if bank == "verbs" and category == "aux":
            correct = clean_markup(finding.get("correct", "")).lower()
            match = re.match(r"^(sein|haben)\b", correct)
            if match:
                target = match.group(1) == "sein"
                if row.get("withSein") is not target:
                    row["withSein"] = target
                    changes["verbs:auxiliary"] += 1
                    touched[bank].add(word)

    # Confirmed adjective contamination.  Medium findings are included only when
    # the reviewer explicitly says remove/delete/drop; low-value editorial cuts are not.
    adjective_words = set(indexes["adjectives"])
    remove_adjectives: set[str] = set()
    for finding in findings:
        if finding.get("bank") != "adjectives" or finding.get("category") not in {"notadj", "junk"}:
            continue
        correct = finding.get("correct", "").lower()
        explicit = any(term in correct for term in ("remove", "delete", "drop"))
        if explicit and finding.get("severity") in {"high", "medium"}:
            remove_adjectives |= words_named_in_finding(finding, adjective_words)
    remove_adjectives |= markdown_group_words(
        ROOT / "audit" / "findings" / "adjectives_014.md", adjective_words
    )
    remove_adjectives |= EXPLICIT_ADJECTIVE_REMOVALS & adjective_words

    # Confirmed verb contamination, including grouped participle lists.
    verb_words = set(indexes["verbs"])
    remove_verbs: set[str] = set()
    for finding in findings:
        if finding.get("bank") != "verbs":
            continue
        correct = finding.get("correct", "").lower()
        if any(term in correct for term in ("remove", "delete")):
            word = finding_word(finding.get("word", ""))
            if word in verb_words:
                remove_verbs.add(word)
    contaminated_ranks = contaminated_verb_ranks(ROOT / "audit" / "findings" / "verbs_008.md")
    remove_verbs |= {
        row["word"] for row in rows_by_bank["verbs"] if row.get("rank") in contaminated_ranks
    }
    # Both have an existing correct lemma elsewhere in the bank.
    remove_verbs |= {word for word in ("enhalten", "möchten") if word in verb_words}

    # High-confidence duplicate/malformed noun deletions, while preserving valid
    # productive nominalized infinitives rejected by the audit on policy grounds.
    noun_words = set(indexes["nouns"])
    remove_nouns: set[str] = set()
    noun_lookup = {row["word"]: row for row in rows_by_bank["nouns"] if len(indexes["nouns"][row["word"]]) == 1}
    for finding in findings:
        if finding.get("bank") != "nouns" or finding.get("category") != "junk" or finding.get("severity") != "high":
            continue
        if not re.match(r"^(?:remove|delete)\b", finding.get("correct", ""), re.I):
            continue
        word = finding_word(finding.get("word", ""))
        noun = noun_lookup.get(word) if word else None
        if noun and not is_nominalized_infinitive(noun, {v.lower() for v in verb_words}):
            remove_nouns.add(word)

    for bank, removal in (("adjectives", remove_adjectives), ("verbs", remove_verbs), ("nouns", remove_nouns)):
        if not removal:
            continue
        key = BANK_KEYS[bank]
        before = len(docs[bank][key])
        docs[bank][key] = [row for row in docs[bank][key] if row["word"] not in removal]
        removed = before - len(docs[bank][key])
        changes[f"{bank}:removed"] += removed
        touched[bank] |= removal

    # Corrections whose audit prose describes a replacement lemma or whose generic
    # plural notation is ambiguous to the parser.
    nouns = docs["nouns"]["nouns"]
    before_duplicate_cleanup = len(nouns)
    nouns[:] = [row for row in nouns if row["word"] not in {"Socken", "Schranken"}]
    duplicate_rows_removed = before_duplicate_cleanup - len(nouns)
    if duplicate_rows_removed:
        changes["nouns:removed"] += duplicate_rows_removed
    for row in nouns:
        if row["word"] == "Alzheimer":
            row.update({"word": "Alzheimer-Krankheit", "article": "die", "plural": "—"})
            changes["nouns:lemma"] += 1
        elif row["word"] == "Genua":
            row["article"] = "das"
        elif row["word"] == "Müsli":
            row["plural"] = "Müslis"
        elif row["word"] in {"Humor", "Fasching"}:
            row["plural"] = "—"
        if row.get("plural") is None:
            row["plural"] = "—"
            changes["nouns:null-plural"] += 1
            plural_help_words.add(row["word"])
    article_help_words |= {"Alzheimer-Krankheit", "Genua"}
    plural_help_words |= PLURAL_OVERRIDES | NULL_PLURAL_WORDS | {"Alzheimer-Krankheit"}

    # Explicit principal-part repairs take precedence over generic findings.
    verb_index = {row["word"]: row for row in docs["verbs"]["verbs"]}
    for word, (prateritum, perfekt, irregular, with_sein) in VERB_FORM_FIXES.items():
        row = verb_index.get(word)
        if not row:
            skipped["verbs:missing-form-target"] += 1
            continue
        before = (row.get("prateritum"), row.get("perfekt"), row.get("irregular"), row.get("withSein"))
        row.update({
            "prateritum": prateritum,
            "perfekt": perfekt,
            "irregular": irregular,
            "withSein": with_sein,
        })
        after = (prateritum, perfekt, irregular, with_sein)
        if before != after:
            changes["verbs:paradigm"] += 1
            touched["verbs"].add(word)

    # The consolidator retained these two mechanical plural groups as parallel
    # backtick lists.  Apply them positionally: generated broken form -> reviewed form.
    noun_rows_by_plural: dict[str, list[dict]] = defaultdict(list)
    for row in docs["nouns"]["nouns"]:
        noun_rows_by_plural[row.get("plural")].append(row)
    for finding in findings:
        if finding.get("bank") != "nouns" or not finding.get("word", "").startswith(
            ("Truncated umlaut plurals", "Doubled-stem plurals")
        ):
            continue
        old_forms = re.findall(r"`([^`]+)`", finding.get("current", ""))
        new_forms = re.findall(r"`([^`]+)`", finding.get("correct", ""))
        if finding.get("word", "").startswith("Truncated umlaut plurals"):
            old_forms = [form for form in old_forms if form != "Lebenskünst"]
            new_forms = [
                form for form in new_forms
                if form not in {"-e", "-er", "Lebenskunst", "—"}
            ]
            lebenskunst = next(
                (row for row in docs["nouns"]["nouns"] if row["word"] == "Lebenskunst"), None
            )
            if lebenskunst and lebenskunst.get("plural") != "—":
                lebenskunst["plural"] = "—"
                changes["nouns:plural"] += 1
                touched["nouns"].add("Lebenskunst")
            if lebenskunst:
                plural_help_words.add("Lebenskunst")
        if len(old_forms) != len(new_forms):
            skipped["nouns:grouped-plural-shape"] += 1
            continue
        for old_form, new_form in zip(old_forms, new_forms):
            candidates = noun_rows_by_plural.get(old_form, []) or noun_rows_by_plural.get(new_form, [])
            if len(candidates) == 1:
                plural_help_words.add(candidates[0]["word"])
            if len(candidates) == 1 and old_form != new_form:
                if candidates[0].get("plural") != new_form:
                    candidates[0]["plural"] = new_form
                    changes["nouns:plural"] += 1
                    touched["nouns"].add(candidates[0]["word"])

    # Keep the lazily loaded teaching explanations consistent with corrected
    # morphology without regenerating or replacing unrelated user-authored help.
    help_path = DATA / "noun-help.json"
    if args.apply and help_path.exists():
        help_doc = load(help_path)
        help_rows = help_doc.setdefault("help", {})
        noun_word_counts = Counter(row["word"] for row in docs["nouns"]["nouns"])
        noun_by_word = {
            row["word"]: row for row in docs["nouns"]["nouns"]
            if noun_word_counts[row["word"]] == 1
        }
        for obsolete in set(help_rows) - set(noun_word_counts):
            del help_rows[obsolete]
        for word in (article_help_words | plural_help_words):
            row = noun_by_word.get(word)
            if not row:
                continue
            existing = help_rows.get(word)
            pair = list(existing) if isinstance(existing, list) and len(existing) == 2 else ["", ""]
            if word in article_help_words:
                pair[0] = f"Learn this noun with its article: {row['article']} {word}."
            if word in plural_help_words:
                pair[1] = (
                    "Normally used without a plural in the sense taught here."
                    if row["plural"] == "—"
                    else f"Plural: die {row['plural']}."
                )
            help_rows[word] = pair
        help_doc.setdefault("meta", {})["count"] = len(help_rows)
        save_compact(help_path, help_doc)

    for bank, key in BANK_KEYS.items():
        doc = docs[bank]
        doc["meta"]["count"] = len(doc[key])
        if bank == "verbs":
            doc["meta"]["irregularCount"] = sum(bool(row.get("irregular")) for row in doc[key])

    summary = {
        "mode": "apply" if args.apply else "dry-run",
        "changes": dict(sorted(changes.items())),
        "touchedUniqueWords": {bank: len(words) for bank, words in touched.items()},
        "skipped": dict(sorted(skipped.items())),
        "finalCounts": {bank: len(docs[bank][key]) for bank, key in BANK_KEYS.items()},
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if args.apply:
        for bank in BANK_KEYS:
            save(DATA / f"{bank}.json", docs[bank])


if __name__ == "__main__":
    main()
