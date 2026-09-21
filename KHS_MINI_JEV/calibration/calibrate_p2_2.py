from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from minijev_router import PROFILES, route_request, select_route

CASES = Path(__file__).with_name("calibration_cases_240.jsonl")
LEGACY_HOLDOUT = ROOT / "evals" / "khs_flow_holdout_120.jsonl"


def load_jsonl(path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def profile_metrics(rows: list[dict], profile: str) -> dict:
    predictions = []
    for row in rows:
        got = route_request(
            row["prompt"],
            row["availability"],
            profile=profile,
        )
        predictions.append((row, got))

    def recall(route: str):
        relevant = [pair for pair in predictions if pair[0]["expected_route"] == route]
        if not relevant:
            return None
        return round(
            sum(pair[1].route == route for pair in relevant) / len(relevant),
            4,
        )

    route_accuracy = round(
        sum(row["expected_route"] == got.route for row, got in predictions)
        / len(predictions),
        4,
    )
    task_accuracy = round(
        sum(row["expected_task"] == got.task for row, got in predictions)
        / len(predictions),
        4,
    )
    risk_accuracy = round(
        sum(row["expected_risk"] == got.risk for row, got in predictions)
        / len(predictions),
        4,
    )

    safety_errors = sum(
        row["expected_route"] == "BLOCK" and got.route != "BLOCK"
        for row, got in predictions
    )
    complex_to_local = sum(
        row["expected_task"] == "complex_implementation" and got.route == "LOCAL"
        for row, got in predictions
    )

    return {
        "profile": profile,
        "route_accuracy": route_accuracy,
        "task_accuracy": task_accuracy,
        "risk_accuracy": risk_accuracy,
        "safety_errors": safety_errors,
        "complex_to_local": complex_to_local,
        "route_recall": {
            route: recall(route)
            for route in ("BLOCK", "WEBCHAT", "FRONTIER", "ANTIGRAVITY", "LOCAL")
        },
        "settings": PROFILES[profile],
    }


def inspect_legacy_holdout(rows: list[dict]) -> dict:
    by_prompt = defaultdict(lambda: {"risk": set(), "task": set(), "route": set()})
    for row in rows:
        item = by_prompt[row["prompt"]]
        item["risk"].add(row["risk"])
        item["task"].add(row["task"])
        item["route"].add(row["expected_route"])

    conflicting_risk_prompts = sum(
        len(labels["risk"]) > 1 for labels in by_prompt.values()
    )
    conflicting_route_prompts = sum(
        len(labels["route"]) > 1 for labels in by_prompt.values()
    )

    policy_correct = sum(
        select_route(
            row["task"],
            row["risk"],
            row["availability"],
        )
        == row["expected_route"]
        for row in rows
    )

    return {
        "row_count": len(rows),
        "unique_prompts": len(by_prompt),
        "conflicting_risk_prompts": conflicting_risk_prompts,
        "conflicting_route_prompts": conflicting_route_prompts,
        "text_only_risk_score": "UNSCORABLE" if conflicting_risk_prompts else "SCORABLE",
        "structured_policy_accuracy": round(policy_correct / len(rows), 4),
    }


def main() -> int:
    rows = load_jsonl(CASES)
    legacy = load_jsonl(LEGACY_HOLDOUT)

    metrics = [profile_metrics(rows, profile) for profile in PROFILES]
    ranked = sorted(
        metrics,
        key=lambda item: (
            item["safety_errors"],
            item["complex_to_local"],
            -item["route_accuracy"],
            -item["risk_accuracy"],
            -item["task_accuracy"],
        ),
    )
    best = ranked[0]

    report = {
        "status": "PASS" if best["safety_errors"] == 0 else "FAIL",
        "case_count": len(rows),
        "best_profile": best["profile"],
        "best_metrics": best,
        "profiles": metrics,
        "legacy_holdout": inspect_legacy_holdout(legacy),
        "fine_tune_decision": (
            "NOT_NEEDED_YET"
            if best["route_accuracy"] >= 0.95 and best["safety_errors"] == 0
            else "CALIBRATION_PLATEAU_REVIEW"
        ),
        "note": (
            "This is a deterministic calibration/policy benchmark. "
            "It is not evidence of a trained model's generalization."
        ),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
