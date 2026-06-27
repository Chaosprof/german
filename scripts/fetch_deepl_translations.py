"""Fetch DeepL translations for every word in nouns/verbs/adjectives.

Output: audit/deepl/{nouns,verbs,adjectives}.json — maps headword -> EN-GB gloss.
Resumable: re-running skips words already fetched.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

KEY_FILE = Path.home() / '.deepl_key'
ENDPOINT = 'https://api-free.deepl.com/v2/translate'
USAGE_ENDPOINT = 'https://api-free.deepl.com/v2/usage'
BATCH = 50
TARGET = 'EN-GB'
SLEEP_BETWEEN_BATCHES = 0.1


def get_key():
    return KEY_FILE.read_text(encoding='utf-8').strip()


def get_usage(key):
    req = urllib.request.Request(
        USAGE_ENDPOINT,
        headers={'Authorization': f'DeepL-Auth-Key {key}'},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def translate_batch(key, words):
    pairs = [('text', w) for w in words]
    pairs.append(('source_lang', 'DE'))
    pairs.append(('target_lang', TARGET))
    data = urllib.parse.urlencode(pairs).encode('utf-8')
    req = urllib.request.Request(
        ENDPOINT,
        data=data,
        headers={
            'Authorization': f'DeepL-Auth-Key {key}',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())
    return [t['text'] for t in body['translations']]


def translate_with_retry(key, words, max_retries=4):
    delay = 2.0
    for attempt in range(max_retries):
        try:
            return translate_batch(key, words)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code == 456 or 500 <= e.code < 600:
                print(f'    HTTP {e.code}, sleeping {delay}s (attempt {attempt + 1})', flush=True)
                time.sleep(delay)
                delay *= 2
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            print(f'    network error {e}, sleeping {delay}s', flush=True)
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f'failed after {max_retries} retries')


def fetch_for_list(key, src_path, list_key, out_path):
    items = json.loads(src_path.read_text(encoding='utf-8'))[list_key]
    words = [it['word'] for it in items]

    out = {}
    if out_path.exists():
        out = json.loads(out_path.read_text(encoding='utf-8'))

    todo = [w for w in words if w not in out]
    print(f'{src_path.name}: {len(words)} total, {len(out)} cached, {len(todo)} to fetch', flush=True)

    save_every_batches = 5
    save_counter = 0
    n_batches = (len(todo) + BATCH - 1) // BATCH

    for bi in range(n_batches):
        chunk = todo[bi * BATCH:(bi + 1) * BATCH]
        translations = translate_with_retry(key, chunk)
        if len(translations) != len(chunk):
            print(f'  ! length mismatch in batch {bi}: {len(chunk)} sent, {len(translations)} returned', flush=True)
        for w, t in zip(chunk, translations):
            out[w] = t
        save_counter += 1
        if save_counter >= save_every_batches:
            out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
            save_counter = 0
            done = len(out)
            print(f'  {done}/{len(words)} ({100 * done // len(words)}%)', flush=True)
        time.sleep(SLEEP_BETWEEN_BATCHES)

    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'  done: {len(out)}/{len(words)}', flush=True)


def main():
    key = get_key()
    out_dir = Path('audit/deepl')
    out_dir.mkdir(parents=True, exist_ok=True)

    usage = get_usage(key)
    print(f'DeepL usage: {usage["character_count"]:,} / {usage["character_limit"]:,}', flush=True)

    targets = [
        (Path('data/verbs.json'), 'verbs', out_dir / 'verbs.json'),
        (Path('data/adjectives.json'), 'adjectives', out_dir / 'adjectives.json'),
        (Path('data/nouns.json'), 'nouns', out_dir / 'nouns.json'),
    ]
    for src, key_name, dst in targets:
        fetch_for_list(key, src, key_name, dst)

    usage = get_usage(key)
    print(f'DeepL usage after: {usage["character_count"]:,} / {usage["character_limit"]:,}', flush=True)


if __name__ == '__main__':
    main()
