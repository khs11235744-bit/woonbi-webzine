from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from minijev_router import (
    deterministic_guard,
    infer_task,
    route_request,
    select_route,
)


class RouterContractTests(unittest.TestCase):
    def test_blocked_guard_precedes_routing(self):
        d = route_request(
            "작은 검토인데 비밀값 노출과 권한 우회를 요구한다.",
            "full",
        )
        self.assertEqual(d.risk, "blocked")
        self.assertEqual(d.route, "BLOCK")
        self.assertEqual(d.status, "BLOCKED")

    def test_complex_never_goes_local(self):
        for availability in (
            "local_only",
            "local_frontier",
            "local_webchat",
            "local_antigravity",
            "full",
        ):
            route = select_route("complex_implementation", "low", availability)
            self.assertNotEqual(route, "LOCAL")

    def test_gui_prefers_antigravity(self):
        d = route_request(
            "GUI 화면을 보고 버튼 겹침과 레이아웃 문제를 분석해줘.",
            "full",
        )
        self.assertEqual(d.task, "gui_vision")
        self.assertEqual(d.route, "ANTIGRAVITY")

    def test_medium_small_edit_requires_authority(self):
        self.assertEqual(select_route("small_edit", "medium", "local_only"), "BLOCK")
        self.assertEqual(select_route("small_edit", "medium", "local_webchat"), "WEBCHAT")
        self.assertEqual(select_route("small_edit", "medium", "local_frontier"), "FRONTIER")

    def test_low_small_edit_can_stay_local(self):
        d = route_request(
            "작은 설정 변경 한 건만 반영해줘. 비파괴적이고 되돌리기 쉬운 작업이다.",
            "local_only",
        )
        self.assertEqual(d.risk, "low")
        self.assertEqual(d.task, "small_edit")
        self.assertEqual(d.route, "LOCAL")

    def test_high_risk_webchat_when_frontier_absent(self):
        d = route_request(
            "관리자 권한 변경이 포함될 수 있다. 결과를 검토해줘.",
            "local_webchat",
        )
        self.assertEqual(d.risk, "high")
        self.assertEqual(d.route, "WEBCHAT")

    def test_worker_output_is_never_pass(self):
        d = route_request("요청을 분류해줘.", "full")
        self.assertTrue(d.verifier_required)
        self.assertEqual(d.status, "NEEDS_VERIFICATION")

    def test_ascii_token_does_not_false_match(self):
        self.assertEqual(
            infer_task("Review this bounded result and summarize verification evidence."),
            "review",
        )

    def test_risk_hint_is_guard_authority(self):
        d = deterministic_guard(
            "요청을 검토해줘.",
            risk_hint="high",
        )
        self.assertEqual(d.risk, "high")
        self.assertEqual(d.source, "risk_hint")


class DatasetTests(unittest.TestCase):
    def test_calibration_dataset_count_and_unique_ids(self):
        path = ROOT / "calibration" / "calibration_cases_240.jsonl"
        rows = [
            json.loads(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        self.assertEqual(len(rows), 240)
        self.assertEqual(len({row["id"] for row in rows}), 240)

    def test_p2_1_eval_is_untouched(self):
        path = ROOT / "evals" / "router_eval_600.jsonl"
        rows = [
            line
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        self.assertEqual(len(rows), 600)


if __name__ == "__main__":
    unittest.main()
