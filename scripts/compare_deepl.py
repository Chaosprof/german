"""Compare current English glosses against DeepL output and classify each entry.

Produces audit reports under audit/deepl_diff/ — does NOT modify data files.

Categories per entry (in order of priority):
  DUAL_GENDER     — dual-gender duplicate; do not auto-touch (4 nouns).
  FILL_EMPTY      — current english is blank; DeepL fills it.
  EXACT_MATCH     — equivalent (case/whitespace insensitive).
  CURRENT_SUPERSET— current contains DeepL gloss as one slash-separated sense
                    (likely human-curated multi-sense; keep current).
  DEEPL_SUPERSET  — DeepL output contains current gloss as a substring
                    (DeepL gives more context; consider replacing).
  DIVERGENT_SINGLE— both single-sense and differ; needs review.
  DIVERGENT_MULTI — current is multi-sense, DeepL is single, no overlap;
                    likely a sense-pick mismatch — needs review.
  PUNCT_DIFF      — only punctuation/case differs.
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

DATA = Path('data')
DEEPL = Path('audit/deepl')
OUT = Path('audit/deepl_diff')


def find_dual_gender_words(nouns):
    """Return set of words appearing >1x in nouns (different articles/senses)."""
    c = Counter(n['word'] for n in nouns)
    return {w for w, k in c.items() if k > 1}


def normalize_for_compare(s):
    """Strip, lower, collapse whitespace, drop trailing/leading articles for comparison."""
    s = s.strip().lower()
    s = re.sub(r'\s+', ' ', s)
    return s


def normalize_deepl_noun(s):
    """DeepL title-cases nouns ('Year', 'Crown Princess'). Lowercase non-acronym
    words to match the existing data style. Preserves proper-noun markers like
    'St.', 'Mr.', etc., and ALL-CAPS acronyms (EU, USA)."""
    s = s.strip()
    if not s:
        return s
    PROPER_PREFIXES = {'St.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', "Saint"}
    out_words = []
    for w in s.split():
        if w in PROPER_PREFIXES:
            out_words.append(w)
        elif w.isupper() and len(w) >= 2:  # acronym like EU, USA
            out_words.append(w)
        elif w[0].isupper():
            out_words.append(w[0].lower() + w[1:])
        else:
            out_words.append(w)
    return ' '.join(out_words)


def split_senses(s):
    """Split a multi-sense gloss like 'frame/framework' or 'a / b' on '/'."""
    parts = [p.strip() for p in re.split(r'\s*/\s*', s) if p.strip()]
    return parts


def classify(current, deepl, dual_gender=False):
    cur = (current or '').strip()
    dl = (deepl or '').strip()
    cur_n = normalize_for_compare(cur)
    dl_n = normalize_for_compare(dl)

    if dual_gender:
        return 'DUAL_GENDER'
    if not cur:
        return 'FILL_EMPTY'
    if not dl:
        return 'NO_DEEPL'
    if cur_n == dl_n:
        return 'EXACT_MATCH'

    # Strip punctuation for fuzzy compare
    def strip_punct(x):
        return re.sub(r'[^\w\s]', '', x).strip()
    if strip_punct(cur_n) == strip_punct(dl_n):
        return 'PUNCT_DIFF'

    cur_senses = [normalize_for_compare(p) for p in split_senses(cur)]
    dl_senses = [normalize_for_compare(p) for p in split_senses(dl)]

    if len(cur_senses) > 1:
        # Current is multi-sense
        if dl_n in cur_senses:
            return 'CURRENT_SUPERSET'
        # Check token overlap
        return 'DIVERGENT_MULTI'
    else:
        # Current is single-sense
        if cur_n in dl_senses or cur_n in dl_n:
            return 'DEEPL_SUPERSET'
        return 'DIVERGENT_SINGLE'


def process(list_key, source_file, deepl_file):
    items = json.loads(Path(source_file).read_text(encoding='utf-8'))[list_key]
    deepl_map = json.loads(Path(deepl_file).read_text(encoding='utf-8'))

    dual = find_dual_gender_words(items) if list_key == 'nouns' else set()

    rows = []
    cats = Counter()
    for it in items:
        word = it['word']
        cur = it.get('english', '') or ''
        dl_raw = deepl_map.get(word, '')
        dl = normalize_deepl_noun(dl_raw) if list_key == 'nouns' else dl_raw.strip()
        # For verbs/adjectives, lowercase fully (DeepL may capitalize)
        if list_key != 'nouns' and dl and dl[0].isupper() and not dl.split()[0].isupper():
            dl = dl[0].lower() + dl[1:]
        cat = classify(cur, dl, dual_gender=(word in dual))
        cats[cat] += 1
        rows.append({
            'word': word,
            'rank': it.get('rank'),
            'article': it.get('article'),
            'current': cur,
            'deepl': dl,
            'deepl_raw': dl_raw,
            'category': cat,
        })
    return rows, cats


def write_reports(name, rows):
    by_cat = defaultdict(list)
    for r in rows:
        by_cat[r['category']].append(r)

    OUT.mkdir(parents=True, exist_ok=True)

    # Single combined JSON
    (OUT / f'{name}_classified.json').write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )

    # Per-category markdown reports for easy review
    for cat, items in by_cat.items():
        items_sorted = sorted(items, key=lambda r: (r.get('rank') or 0))
        lines = [f'# {name} — {cat} ({len(items)} entries)\n']
        if name == 'nouns':
            lines.append('| rank | art | word | current | DeepL |')
            lines.append('|---:|:---:|---|---|---|')
            for r in items_sorted:
                lines.append(f'| {r["rank"] or ""} | {r["article"] or ""} | {r["word"]} | {r["current"]} | {r["deepl"]} |')
        else:
            lines.append('| rank | word | current | DeepL |')
            lines.append('|---:|---|---|---|')
            for r in items_sorted:
                lines.append(f'| {r["rank"] or ""} | {r["word"]} | {r["current"]} | {r["deepl"]} |')
        (OUT / f'{name}_{cat}.md').write_text('\n'.join(lines), encoding='utf-8')


def main():
    summary = {}
    for name, list_key, src, dl in [
        ('nouns', 'nouns', DATA / 'nouns.json', DEEPL / 'nouns.json'),
        ('verbs', 'verbs', DATA / 'verbs.json', DEEPL / 'verbs.json'),
        ('adjectives', 'adjectives', DATA / 'adjectives.json', DEEPL / 'adjectives.json'),
    ]:
        rows, cats = process(list_key, src, dl)
        write_reports(name, rows)
        summary[name] = (len(rows), dict(cats))
        print(f'\n{name}: {len(rows)} entries')
        for cat, n in sorted(cats.items(), key=lambda x: -x[1]):
            print(f'  {cat:20s} {n:6d}  ({100*n/len(rows):.1f}%)')

    (OUT / 'summary.json').write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


if __name__ == '__main__':
    main()
