from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from typing import Iterable

VALID_TASKS = {
    "classify",
    "review",
    "small_edit",
    "complex_implementation",
    "gui_vision",
}
VALID_RISKS = {"low", "medium", "high", "blocked"}
VALID_ROUTES = {"LOCAL", "FRONTIER", "WEBCHAT", "ANTIGRAVITY", "BLOCK"}

AVAILABILITY = {
    "local_only": {"LOCAL"},
    "local_frontier": {"LOCAL", "FRONTIER"},
    "local_webchat": {"LOCAL", "WEBCHAT"},
    "local_antigravity": {"LOCAL", "ANTIGRAVITY"},
    "full": {"LOCAL", "FRONTIER", "WEBCHAT", "ANTIGRAVITY"},
}

PROFILES = {
    "baseline": {
        "block_threshold": 1,
        "high_threshold": 1,
        "strict_task_order": False,
        "unknown_task": "review",
        "temperature": 0.7,
        "noul": False,
        "isolation": False,
        "prefer_explicit_low": False,
    },
    "jeff_prompt": {
        "block_threshold": 1,
        "high_threshold": 1,
        "strict_task_order": True,
        "unknown_task": "complex_implementation",
        "temperature": 0.4,
        "noul": False,
        "isolation": False,
        "prefer_explicit_low": False,
    },
    "jeff_noul": {
        "block_threshold": 1,
        "high_threshold": 1,
        "strict_task_order": True,
        "unknown_task": "complex_implementation",
        "temperature": 0.2,
        "noul": True,
        "isolation": False,
        "prefer_explicit_low": False,
    },
    "jeff_noul_isolated": {
        "block_threshold": 1,
        "high_threshold": 1,
        "strict_task_order": True,
        "unknown_task": "complex_implementation",
        "temperature": 0.1,
        "noul": True,
        "isolation": True,
        "prefer_explicit_low": False,
    },
    "jeff_noul_isolated_t0": {
        "block_threshold": 1,
        "high_threshold": 1,
        "strict_task_order": True,
        "unknown_task": "complex_implementation",
        "temperature": 0.0,
        "noul": True,
        "isolation": True,
        "prefer_explicit_low": False,
    },
    "guard_threshold_v2": {
        "block_threshold": 1,
        "high_threshold": 1,
        "strict_task_order": True,
        "unknown_task": "complex_implementation",
        "temperature": 0.0,
        "noul": True,
        "isolation": True,
        "prefer_explicit_low": True,
    },
}

BLOCK_PATTERNS = (
    "비밀값 노출",
    "권한 우회",
    "암호를 훔",
    "토큰 탈취",
    "자격 증명 탈취",
    "credential harvesting",
    "steal credentials",
    "dump secrets",
    "bypass permission",
    "보안 우회",
    "몰래 지속",
    "stealth persistence",
)
HIGH_PATTERNS = (
    "권한·배포·민감 설정",
    "권한 변경",
    "프로덕션 배포",
    "production deploy",
    "관리자 권한",
    "대량 삭제",
    "시스템 설정",
    "민감 설정",
    "실서비스 배포",
    "보안 설정 변경",
)
MEDIUM_PATTERNS = (
    "실제 파일 변경",
    "파일 변경",
    "설정 변경",
    "작은 수정",
    "수정안을",
    "반영해",
    "커밋",
    "코드 수정",
    "edit file",
    "change config",
    "bounded file change",
)
EXPLICIT_LOW_PATTERNS = (
    "비파괴적이고 되돌리기 쉬운",
    "읽기 중심이며 파일을 바꾸지",
    "non-destructive and reversible",
)

GUI_PATTERNS = (
    "화면",
    "gui",
    "버튼",
    "겹침",
    "스크린샷",
    "이미지",
    "vision",
    "레이아웃",
    "screenshot",
    "layout",
)
COMPLEX_PATTERNS = (
    "여러 파일",
    "대규모",
    "구현하고",
    "구현해",
    "기능을 구현",
    "테스트까지",
    "아키텍처",
    "복구 로직",
    "멀티",
    "통합",
    "multi-file",
)
CLASSIFY_PATTERNS = (
    "분류",
    "판정",
    "classify",
    "라우팅 여부",
)
SMALL_EDIT_PATTERNS = (
    "작은 설정 변경",
    "작은 수정",
    "수정안",
    "반영해",
    "한 건만",
    "small edit",
)
REVIEW_PATTERNS = (
    "검토",
    "요약",
    "검증",
    "review",
    "확인해",
    "분석해",
)


@dataclass(frozen=True)
class GuardDecision:
    risk: str
    source: str
    evidence: tuple[str, ...]


@dataclass(frozen=True)
class RouteDecision:
    route: str
    task: str
    risk: str
    profile: str
    availability: str
    guard_source: str
    guard_evidence: tuple[str, ...]
    verifier_required: bool
    status: str
    policy: dict


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _contains(text: str, pattern: str) -> bool:
    if re.fullmatch(r"[a-z0-9 ]+", pattern) and len(pattern) <= 10:
        return bool(
            re.search(
                rf"(?<![a-z0-9]){re.escape(pattern)}(?![a-z0-9])",
                text,
            )
        )
    return pattern in text


def _hits(text: str, patterns: Iterable[str]) -> tuple[str, ...]:
    return tuple(pattern for pattern in patterns if _contains(text, pattern))


def infer_task(
    prompt: str,
    profile: str = "guard_threshold_v2",
    task_hint: str | None = None,
) -> str:
    if task_hint is not None:
        if task_hint not in VALID_TASKS:
            raise ValueError(f"invalid task_hint: {task_hint}")
        return task_hint

    cfg = PROFILES[profile]
    text = _normalize(prompt)

    if cfg["strict_task_order"]:
        ordered = (
            ("gui_vision", GUI_PATTERNS),
            ("complex_implementation", COMPLEX_PATTERNS),
            ("classify", CLASSIFY_PATTERNS),
            ("small_edit", SMALL_EDIT_PATTERNS),
            ("review", REVIEW_PATTERNS),
        )
    else:
        ordered = (
            ("classify", CLASSIFY_PATTERNS),
            ("review", REVIEW_PATTERNS),
            ("small_edit", SMALL_EDIT_PATTERNS),
            ("gui_vision", GUI_PATTERNS),
            ("complex_implementation", COMPLEX_PATTERNS),
        )

    for task, patterns in ordered:
        if _hits(text, patterns):
            return task
    return str(cfg["unknown_task"])


def deterministic_guard(
    prompt: str,
    profile: str = "guard_threshold_v2",
    risk_hint: str | None = None,
) -> GuardDecision:
    if profile not in PROFILES:
        raise ValueError(f"unknown profile: {profile}")

    if risk_hint is not None:
        if risk_hint not in VALID_RISKS:
            raise ValueError(f"invalid risk_hint: {risk_hint}")
        return GuardDecision(
            risk=risk_hint,
            source="risk_hint",
            evidence=(risk_hint,),
        )

    cfg = PROFILES[profile]
    text = _normalize(prompt)

    blocked = _hits(text, BLOCK_PATTERNS)
    if len(blocked) >= int(cfg["block_threshold"]):
        return GuardDecision("blocked", "deterministic_guard", blocked)

    high = _hits(text, HIGH_PATTERNS)
    if len(high) >= int(cfg["high_threshold"]):
        return GuardDecision("high", "deterministic_guard", high)

    explicit_low = _hits(text, EXPLICIT_LOW_PATTERNS)
    if cfg.get("prefer_explicit_low") and explicit_low:
        return GuardDecision("low", "deterministic_guard", explicit_low)

    medium = _hits(text, MEDIUM_PATTERNS)
    if medium:
        return GuardDecision("medium", "deterministic_guard", medium)

    return GuardDecision("low", "deterministic_guard", explicit_low)


def select_route(task: str, risk: str, availability: str) -> str:
    if task not in VALID_TASKS:
        raise ValueError(f"invalid task: {task}")
    if risk not in VALID_RISKS:
        raise ValueError(f"invalid risk: {risk}")
    if availability not in AVAILABILITY:
        raise ValueError(f"invalid availability: {availability}")

    workers = AVAILABILITY[availability]

    if risk == "blocked":
        return "BLOCK"

    if risk == "high":
        if "FRONTIER" in workers:
            return "FRONTIER"
        if "WEBCHAT" in workers:
            return "WEBCHAT"
        return "BLOCK"

    if task in {"classify", "review"}:
        return "LOCAL"

    if task == "small_edit":
        if risk == "low":
            return "LOCAL"
        if "FRONTIER" in workers:
            return "FRONTIER"
        if "WEBCHAT" in workers:
            return "WEBCHAT"
        return "BLOCK"

    if task == "gui_vision":
        if "ANTIGRAVITY" in workers:
            return "ANTIGRAVITY"
        if "WEBCHAT" in workers:
            return "WEBCHAT"
        if "FRONTIER" in workers:
            return "FRONTIER"
        return "BLOCK"

    if "FRONTIER" in workers:
        return "FRONTIER"
    if "WEBCHAT" in workers:
        return "WEBCHAT"
    return "BLOCK"


def route_request(
    prompt: str,
    availability: str = "full",
    *,
    profile: str = "guard_threshold_v2",
    risk_hint: str | None = None,
    task_hint: str | None = None,
) -> RouteDecision:
    if profile not in PROFILES:
        raise ValueError(f"unknown profile: {profile}")

    guard = deterministic_guard(prompt, profile=profile, risk_hint=risk_hint)
    task = infer_task(prompt, profile=profile, task_hint=task_hint)
    route = select_route(task, guard.risk, availability)

    status = "BLOCKED" if route == "BLOCK" else "NEEDS_VERIFICATION"
    cfg = PROFILES[profile]

    return RouteDecision(
        route=route,
        task=task,
        risk=guard.risk,
        profile=profile,
        availability=availability,
        guard_source=guard.source,
        guard_evidence=guard.evidence,
        verifier_required=route != "BLOCK",
        status=status,
        policy={
            "deterministic_guard_first": True,
            "local_bounded_only": True,
            "complex_authority": "FRONTIER_OR_WEBCHAT",
            "worker_output_trusted": False,
            "temperature": cfg["temperature"],
            "noul": cfg["noul"],
            "isolation": cfg["isolation"],
        },
    )


def _main() -> int:
    parser = argparse.ArgumentParser(description="KHS Mini-Jev routing core")
    parser.add_argument("--prompt", required=True)
    parser.add_argument(
        "--availability",
        default="full",
        choices=sorted(AVAILABILITY),
    )
    parser.add_argument(
        "--profile",
        default="guard_threshold_v2",
        choices=sorted(PROFILES),
    )
    parser.add_argument("--risk-hint", choices=sorted(VALID_RISKS))
    parser.add_argument("--task-hint", choices=sorted(VALID_TASKS))
    args = parser.parse_args()

    decision = route_request(
        args.prompt,
        args.availability,
        profile=args.profile,
        risk_hint=args.risk_hint,
        task_hint=args.task_hint,
    )
    print(json.dumps(asdict(decision), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
