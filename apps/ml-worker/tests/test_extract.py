"""Tests for the dataset extraction feature engineering (pure functions)."""

from __future__ import annotations

import pytest

from src.data import extract


# ── _league_tier ────────────────────────────────────────────────────────────────


class TestLeagueTier:
    @pytest.mark.parametrize("code", ["PL", "SA", "LL", "BL1", "L1"])
    def test_top5(self, code: str) -> None:
        assert extract._league_tier(code) == "top5"

    @pytest.mark.parametrize("code", ["WC", "UCL", "UEL", "UECL", "FRI"])
    def test_international(self, code: str) -> None:
        assert extract._league_tier(code) == "international"

    @pytest.mark.parametrize("code", ["D2", "SP2", "J1", "MX1"])
    def test_secondary(self, code: str) -> None:
        assert extract._league_tier(code) == "secondary"


# ── _odds_segment ───────────────────────────────────────────────────────────────


class TestOddsSegment:
    def test_none_is_unknown(self) -> None:
        assert extract._odds_segment(None) == "unknown"

    def test_low_mid_high_boundaries(self) -> None:
        assert extract._odds_segment(1.49) == "low"
        assert extract._odds_segment(1.5) == "mid"
        assert extract._odds_segment(2.5) == "mid"
        assert extract._odds_segment(2.51) == "high"


# ── _devig_pinnacle (degenerate one-leg case must not produce a fake 1.0) ───────


class TestDevigPinnacle:
    def test_three_way_devig_removes_overround(self) -> None:
        # Balanced 1X2 with ~5% overround → de-vigged probs sum to 1.
        p = extract._devig_pinnacle({"target": 2.1, "home": 2.1, "draw": 3.5, "away": 3.6})
        assert p is not None
        assert 0.0 < p < 1.0

    def test_one_sided_market_does_not_invent_certainty(self) -> None:
        # Only the target leg present → overround = 1/target, so de-vig = 1.0.
        # This is the degenerate case the audit flagged; document the behaviour:
        # a single available leg yields 1.0, which is why _pinnacle_prob_for_pick
        # must always pass BOTH sides for 2-outcome markets.
        only_target = extract._devig_pinnacle({"target": 2.0, "home": 2.0})
        assert only_target == pytest.approx(1.0)

    def test_missing_target_returns_none(self) -> None:
        assert extract._devig_pinnacle({"target": None, "home": 2.0, "away": 2.0}) is None

    def test_no_available_legs_returns_none(self) -> None:
        assert extract._devig_pinnacle({"target": 2.0}) is None


# ── _pinnacle_prob_for_pick passes both sides for 2-outcome markets ─────────────


class TestPinnacleProbForPick:
    def test_btts_yes_uses_both_sides(self) -> None:
        odds = {"yes": 1.8, "no": 2.0, "home": None, "draw": None, "away": None,
                "over": None, "under": None}
        p = extract._pinnacle_prob_for_pick("BTTS", "YES", odds)
        assert p is not None
        # de-vig of two-way 1.8/2.0 → (1/1.8) / (1/1.8 + 1/2.0)
        expected = (1 / 1.8) / (1 / 1.8 + 1 / 2.0)
        assert p == pytest.approx(expected)
        assert p < 1.0  # never the degenerate 1.0

    def test_over_under_uses_both_sides(self) -> None:
        odds = {"over": 1.9, "under": 1.9, "yes": None, "no": None,
                "home": None, "draw": None, "away": None}
        p = extract._pinnacle_prob_for_pick("OVER_UNDER", "OVER", odds)
        assert p == pytest.approx(0.5)


# ── _target_odds routing ────────────────────────────────────────────────────────


class TestTargetOdds:
    def test_routes_each_market_to_its_pick(self) -> None:
        odds = {"home": 1.5, "draw": 4.0, "away": 6.0, "yes": 1.8, "no": 2.0,
                "over": 1.9, "under": 1.95}
        assert extract._target_odds("ONE_X_TWO", "AWAY", odds) == 6.0
        assert extract._target_odds("BTTS", "NO", odds) == 2.0
        assert extract._target_odds("OVER_UNDER", "UNDER", odds) == 1.95
        assert extract._target_odds("UNKNOWN_MARKET", "X", odds) is None


# ── _build_row end-to-end on a synthetic raw record ─────────────────────────────


class TestBuildRow:
    def _raw(self, **over: object) -> dict:
        base = {
            "analyzed_at": "2026-06-01T12:00:00Z",
            "deterministic_score": 0.62,
            "features": {
                "recentForm": 0.5,
                "xg": 0.55,
                "performanceDomExt": 0.6,
                "volatiliteLigue": 0.4,
                "probabilities": {"home": 0.5, "draw": 0.3, "away": 0.2},
            },
            "market": "ONE_X_TWO",
            "pick": "HOME",
            "canal": "EV",
            "prob_estimated": 0.55,
            "odds_bet": 2.0,
            "ev": 0.10,
            "competition_code": "PL",
            "pinnacle_home": 1.9,
            "pinnacle_draw": 3.5,
            "pinnacle_away": 4.0,
            "pinnacle_yes": None,
            "pinnacle_no": None,
            "pinnacle_over": None,
            "pinnacle_under": None,
            "outcome_correct": True,
        }
        base.update(over)
        return base

    def test_delta_p_present_when_pinnacle_available(self) -> None:
        row = extract._build_row(self._raw())
        assert row["p_pinnacle"] is not None
        assert row["delta_p"] == pytest.approx(row["prob_estimated"] - row["p_pinnacle"])
        assert row["outcome_correct"] == 1

    def test_delta_p_none_when_pinnacle_missing(self) -> None:
        row = extract._build_row(
            self._raw(pinnacle_home=None, pinnacle_draw=None, pinnacle_away=None)
        )
        assert row["p_pinnacle"] is None
        assert row["delta_p"] is None

    def test_ev_derived_when_absent(self) -> None:
        row = extract._build_row(self._raw(ev=None))
        # ev = prob_estimated * odds_bet - 1 = 0.55 * 2.0 - 1 = 0.10
        assert row["ev"] == pytest.approx(0.10)

    def test_outcome_false_maps_to_zero(self) -> None:
        row = extract._build_row(self._raw(outcome_correct=False))
        assert row["outcome_correct"] == 0
