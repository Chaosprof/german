#!/usr/bin/env python3
"""Close the holes in data/nouns.json's `rank` sequence.

Ranks are a dense ordering by design -- the app slices tiers with
`NOUNS.filter(n => n.rank <= tier)` (see getNounsForTier in index.html), so a
"Top 5000" deck is really "every surviving rank <= 5000". Entries deleted after
the original ranking were never renumbered, which left 48 unused rank values
spread over the range (16 of them below 10000). The visible effect was tiers
quietly under-filling: Top 5000 returned 4996 rows before any other filtering,
Top 10000 returned 9984.

This rewrites `rank` to a gap-free 1..N over the SAME order the ranks already
describe. Deliberately unchanged:

  * `id` -- the stable identity used to key noun-help.json and the user's saved
    mistakes. It happens to match `rank` today, and after this it no longer
    will for anything past the first gap. That is correct: an id is identity, a
    rank is position, and rewriting ids would break every saved mistake list.
  * `leipzigRank` -- the untouched corpus frequency the ranking was derived
    from.
  * Array order -- hydrateWordData() in index.html pairs NOUNS entries with
    their source rows positionally when grouping senses, so the array order is
    load-bearing. Only the rank VALUES move.

Idempotent: a second run finds no gaps and writes nothing.

After running this, rebuild the derived deck bundle, which embeds ranks:

    node scripts/build_berlin_runner_decks.js

The two rerank scripts in this directory (rerank_nouns_top5000.js,
add_cefr_levels_and_rerank.js) only ever SWAP rank values between pairs, so
they preserve density and are safe to run afterwards.
"""

import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOUNS_PATH = os.path.join(ROOT, "data", "nouns.json")

# One field per line in this file, so the rewrite can be surgical: match only a
# line that IS a rank field. "leipzigRank" does not match (capital R), and the
# two `"english": "rank"` glosses do not match either -- both verified.
RANK_LINE = re.compile(r'^(\s*)"rank": (\d+)(,?)$')


def main():
    raw = io.open(NOUNS_PATH, encoding="utf-8", newline="").read()
    data = json.loads(raw)
    nouns = data["nouns"]

    old_ranks = [n["rank"] for n in nouns]
    if len(set(old_ranks)) != len(old_ranks):
        sys.exit("refusing to renumber: rank values are not unique")

    highest = max(old_ranks)
    gaps = highest - len(old_ranks)
    if gaps == 0:
        print("ranks are already dense (1..%d); nothing to do" % highest)
        return

    # Rank order is the thing being preserved; array order is not touched.
    remap = {old: new for new, old in enumerate(sorted(old_ranks), start=1)}

    # Rewrite the text rather than re-serialising the JSON, so indentation,
    # key order and CRLF line endings all survive and the diff is exactly the
    # rank fields that moved.
    newline = "\r\n" if "\r\n" in raw else "\n"
    lines = raw.split(newline)
    rewritten = 0
    seen = 0
    for i, line in enumerate(lines):
        m = RANK_LINE.match(line)
        if not m:
            continue
        seen += 1
        indent, old, comma = m.group(1), int(m.group(2)), m.group(3)
        new = remap[old]
        if new != old:
            lines[i] = '%s"rank": %d%s' % (indent, new, comma)
            rewritten += 1

    if seen != len(nouns):
        sys.exit("expected %d rank lines, matched %d -- aborting"
                 % (len(nouns), seen))

    out = newline.join(lines)

    # Prove the result before it lands: same entries, same order, dense ranks.
    check = json.loads(out)["nouns"]
    if len(check) != len(nouns):
        sys.exit("entry count changed -- aborting")
    for before, after in zip(nouns, check):
        if before["id"] != after["id"] or before["word"] != after["word"]:
            sys.exit("array order changed -- aborting")
        if after["rank"] != remap[before["rank"]]:
            sys.exit("rank remap not applied as computed -- aborting")
    new_ranks = sorted(n["rank"] for n in check)
    if new_ranks != list(range(1, len(check) + 1)):
        sys.exit("result is still not dense -- aborting")
    # The ordering the ranks describe must be identical to before.
    before_order = [n["id"] for n in sorted(nouns, key=lambda n: n["rank"])]
    after_order = [n["id"] for n in sorted(check, key=lambda n: n["rank"])]
    if before_order != after_order:
        sys.exit("rank ordering changed -- aborting")

    io.open(NOUNS_PATH, "w", encoding="utf-8", newline="").write(out)
    print("closed %d gaps; ranks now 1..%d (was 1..%d)"
          % (gaps, len(check), highest))
    print("rewrote %d of %d rank fields" % (rewritten, seen))
    print("remember: node scripts/build_berlin_runner_decks.js")


if __name__ == "__main__":
    main()
