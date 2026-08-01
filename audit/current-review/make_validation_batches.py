#!/usr/bin/env python3
"""Create independent validation packets for high-severity manual findings."""

from __future__ import annotations

import json
import random
from pathlib import Path


BASE = Path(__file__).resolve().parent
findings = json.loads((BASE / "findings-consolidated.json").read_text(encoding="utf-8"))
out = BASE / "validation-batches"
out.mkdir(exist_ok=True)

groups = {
    "noun_high": {"nouns"},
    "verb_high": {"verbs", "verb_preps"},
    "adjective_high": {"adjectives"},
    "dual_gender_high": {"dual_gender"},
}
manifest = []
for name, banks in groups.items():
    rows = [item for item in findings if item["severity"] == "high" and item["bank"] in banks]
    path = out / f"{name}.json"
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest.append({"batch": name, "count": len(rows), "banks": sorted(banks), "path": str(path)})

# A deterministic stratified sample estimates first-pass precision for the editorial
# medium/low tiers without pretending that a second full pass has been performed.
rng = random.Random(20260801)
sample = []
for bank in ("nouns", "verbs", "adjectives", "verb_preps", "dual_gender"):
    for severity in ("medium", "low"):
        population = [item for item in findings if item["bank"] == bank and item["severity"] == severity]
        take = min(24, len(population))
        sample.extend(rng.sample(population, take))
sample_path = out / "medium_low_sample.json"
sample_path.write_text(json.dumps(sample, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
manifest.append(
    {
        "batch": "medium_low_sample",
        "count": len(sample),
        "banks": sorted({item["bank"] for item in sample}),
        "path": str(sample_path),
    }
)

(out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, ensure_ascii=False, indent=2))
