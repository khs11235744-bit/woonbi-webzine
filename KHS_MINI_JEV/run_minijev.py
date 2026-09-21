from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from minijev_router import AVAILABILITY, PROFILES, route_request


def main() -> int:
    parser = argparse.ArgumentParser(description="Run KHS Mini-Jev router")
    parser.add_argument("prompt", nargs="?", help="request to route")
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
    args = parser.parse_args()

    prompt = args.prompt or input("Mini-Jev 요청> ").strip()
    if not prompt:
        print("요청이 비어 있습니다.", file=sys.stderr)
        return 2

    decision = route_request(
        prompt,
        args.availability,
        profile=args.profile,
    )
    print(json.dumps(asdict(decision), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
