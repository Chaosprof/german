"""Fetch DeepL translations for missing entries from a parsed glossary.

Reads audit/<level>_missing.json (saved by audit) and writes
audit/deepl/<level>.json — maps lemma -> EN-GB gloss.

Resumable: skips lemmas already cached.

Usage: fetch_deepl_for_missing.py <missing_json> <out_json>
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


KEY_FILE = Path.home() / ".deepl_key"
ENDPOINT = "https://api-free.deepl.com/v2/translate"
USAGE_ENDPOINT = "https://api-free.deepl.com/v2/usage"
BATCH = 50
TARGET = "EN-GB"
SLEEP_BETWEEN_BATCHES = 0.1


def get_key():
    return KEY_FILE.read_text(encoding="utf-8").strip()


def get_usage(key):
    req = urllib.request.Request(
        USAGE_ENDPOINT,
        headers={"Authorization": f"DeepL-Auth-Key {key}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def translate_batch(key, words):
    pairs = [("text", w) for w in words]
    pairs.append(("source_lang", "DE"))
    pairs.append(("target_lang", TARGET))
    data = urllib.parse.urlencode(pairs).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=data,
        headers={
            "Authorization": f"DeepL-Auth-Key {key}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())
    return [t["text"] for t in body["translations"]]


def translate_with_retry(key, words, max_retries=4):
    delay = 2.0
    for attempt in range(max_retries):
        try:
            return translate_batch(key, words)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code == 456 or 500 <= e.code < 600:
                print(f"    HTTP {e.code}, sleeping {delay}s (attempt {attempt + 1})", flush=True)
                time.sleep(delay)
                delay *= 2
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"    network error {e}, sleeping {delay}s", flush=True)
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f"failed after {max_retries} retries")


def main():
    if len(sys.argv) < 3:
        print("Usage: fetch_deepl_for_missing.py <missing_json> <out_json>")
        sys.exit(1)

    src_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    key = get_key()

    src = json.loads(src_path.read_text(encoding="utf-8"))
    # Build the list of (kind, lemma, query_text) tuples to translate.
    # For nouns we send "der/die/das Word" (helps DeepL pick the noun form).
    # For verbs we send the infinitive ending in -en (DeepL typically handles).
    # For adjectives we send the bare word.
    queries = []
    for n in src.get("nouns", []):
        article = "der"
        # Pull article out of text
        text = n.get("text", "")
        for art in ("der/die", "die/der", "der", "die", "das"):
            if text.startswith(art + " "):
                article = art.split("/")[0]
                break
        queries.append(("noun", n["lemma"], f"{article} {n['lemma']}"))
    for v in src.get("verbs", []):
        queries.append(("verb", v["lemma"], v["lemma"]))
    for a in src.get("adjs", []):
        queries.append(("adj", a["lemma"], a["lemma"]))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {}
    if out_path.exists():
        out = json.loads(out_path.read_text(encoding="utf-8"))

    todo = [(kind, lemma, query) for kind, lemma, query in queries if lemma not in out]
    print(f"{src_path.name}: {len(queries)} total, {len(out)} cached, {len(todo)} to fetch", flush=True)

    if not todo:
        return

    usage = get_usage(key)
    todo_chars = sum(len(q[2]) for q in todo)
    print(
        f"DeepL usage: {usage['character_count']:,} / {usage['character_limit']:,} "
        f"(this run will use ≈{todo_chars:,} chars)",
        flush=True,
    )
    if usage["character_count"] + todo_chars > usage["character_limit"]:
        print("  WARN: would exceed quota.")

    n_batches = (len(todo) + BATCH - 1) // BATCH
    save_every = 5
    save_counter = 0
    for bi in range(n_batches):
        chunk = todo[bi * BATCH : (bi + 1) * BATCH]
        translations = translate_with_retry(key, [q[2] for q in chunk])
        for (kind, lemma, _), t in zip(chunk, translations):
            # Strip leading article from noun translations to match bank style.
            if kind == "noun":
                t = t.removeprefix("the ").removeprefix("The ").strip()
            out[lemma] = {"kind": kind, "english": t}
        save_counter += 1
        if save_counter >= save_every:
            out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
            save_counter = 0
            done = len(out)
            total = len(queries)
            print(f"  {done}/{total} ({100 * done // total}%)", flush=True)
        time.sleep(SLEEP_BETWEEN_BATCHES)

    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    usage = get_usage(key)
    print(f"DeepL usage after: {usage['character_count']:,} / {usage['character_limit']:,}", flush=True)
    print(f"  done: {len(out)}/{len(queries)}", flush=True)


if __name__ == "__main__":
    main()
