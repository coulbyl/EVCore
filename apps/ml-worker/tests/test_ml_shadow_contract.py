"""Anti-drift guard (docs/ml-worker-sync.md §"garde-fou").

extract.py (this package) and ml-features.ts (packages/analysis-core, the TS
producer) must classify competition codes identically, and train.py's
VALID_SEGMENTS must match the backend's ML_SEGMENTS. ml-shadow-contract.json
is the single source of truth both sides are tested against — see the
matching TS tests in packages/analysis-core/src/score/ml-features.spec.ts and
apps/backend/src/modules/ml/ml.constants.spec.ts.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.data import extract
from src.jobs.train import VALID_SEGMENTS

_CONTRACT_PATH = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "analysis-core"
    / "src"
    / "score"
    / "ml-shadow-contract.json"
)
_contract = json.loads(_CONTRACT_PATH.read_text())


class TestLeagueTierContract:
    @pytest.mark.parametrize("code", _contract["topFiveCompetitions"])
    def test_top5(self, code: str) -> None:
        assert extract._league_tier(code) == "top5"

    @pytest.mark.parametrize("code", _contract["internationalCompetitions"])
    def test_international(self, code: str) -> None:
        assert extract._league_tier(code) == "international"

    def test_no_extra_top5_codes(self) -> None:
        assert extract._TOP5_COMPETITIONS == frozenset(_contract["topFiveCompetitions"])

    def test_no_extra_international_codes(self) -> None:
        assert extract._INTERNATIONAL == frozenset(_contract["internationalCompetitions"])


class TestSegmentsContract:
    def test_valid_segments_match_contract(self) -> None:
        assert VALID_SEGMENTS == frozenset(_contract["trainingSegments"])
