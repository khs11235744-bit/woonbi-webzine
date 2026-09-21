#!/usr/bin/env python3
from __future__ import annotations
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EVAL = ROOT / "router_eval_600.jsonl"
HOLDOUT = ROOT / "khs_flow_holdout_120.jsonl"

REQUIRED = {
    "id","split","project","task","availability","risk","prompt",
    "expected_route","expected_guard_reason","source"
}
VALID_ROUTES = {"LOCAL","FRONTIER","WEBCHAT","ANTIGRAVITY","BLOCK"}

def load(path: Path):
    rows = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        obj = json.loads(line)
        missing = REQUIRED - obj.keys()
        assert not missing, f"{path.name}:{n} missing {sorted(missing)}"
        assert obj["expected_route"] in VALID_ROUTES
        rows.append(obj)
    return rows

def balanced(rows, key, max_delta):
    c = Counter(r[key] for r in rows)
    assert c, f"no values for {key}"
    assert max(c.values()) - min(c.values()) <= max_delta, (key, c)
    return dict(sorted(c.items()))

def main():
    ev = load(EVAL)
    ho = load(HOLDOUT)

    assert len(ev) == 600, len(ev)
    assert len(ho) == 120, len(ho)
    assert len({r["id"] for r in ev}) == 600
    assert len({r["id"] for r in ho}) == 120
    assert set(r["id"] for r in ev).isdisjoint(r["id"] for r in ho)
    assert set(r["prompt"] for r in ev).isdisjoint(r["prompt"] for r in ho)
    assert all(r["project"] == "khs_flow" for r in ho)

    coverage = {
        "project": balanced(ev, "project", 0),
        "task": balanced(ev, "task", 0),
        "availability": balanced(ev, "availability", 0),
        "risk": balanced(ev, "risk", 0),
        "route": dict(sorted(Counter(r["expected_route"] for r in ev).items())),
    }

    for r in ev + ho:
        if r["risk"] == "blocked":
            assert r["expected_route"] == "BLOCK", r["id"]
        if r["expected_route"] == "LOCAL":
            assert r["task"] in {"classify","review","small_edit"}, r["id"]
        if r["task"] == "complex_implementation":
            assert r["expected_route"] != "LOCAL", r["id"]

    print(json.dumps({
        "status":"PASS",
        "eval_count":len(ev),
        "holdout_count":len(ho),
        "coverage":coverage,
        "note":"Dataset/schema/invariant validation only; this is not a router quality PASS."
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
