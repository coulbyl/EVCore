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


# ── _complement_picks — which legs to de-vig a pick against ─────────────────────


class TestComplementPicks:
    def test_one_x_two_and_first_half_winner_are_three_way(self) -> None:
        assert extract._complement_picks("ONE_X_TWO", "AWAY") == ["HOME", "DRAW", "AWAY"]
        assert extract._complement_picks("FIRST_HALF_WINNER", "HOME") == [
            "HOME", "DRAW", "AWAY",
        ]

    def test_btts_and_yes_no_style_markets_are_two_way(self) -> None:
        for market in [
            "BTTS",
            "CLEAN_SHEET_HOME",
            "CLEAN_SHEET_AWAY",
            "WIN_TO_NIL_HOME",
            "WIN_TO_NIL_AWAY",
        ]:
            assert extract._complement_picks(market, "YES") == ["YES", "NO"]

    def test_win_either_half_is_home_away(self) -> None:
        assert extract._complement_picks("TO_WIN_EITHER_HALF", "HOME") == ["HOME", "AWAY"]

    def test_bare_over_under_pick(self) -> None:
        assert extract._complement_picks("OVER_UNDER", "OVER") == ["OVER", "UNDER"]

    def test_lined_over_under_pick_swaps_prefix_same_line(self) -> None:
        assert extract._complement_picks("OVER_UNDER", "OVER_3_5") == [
            "OVER_3_5", "UNDER_3_5",
        ]
        assert extract._complement_picks("TEAM_TOTAL_HOME", "UNDER_1_5") == [
            "OVER_1_5", "UNDER_1_5",
        ]

    def test_unknown_market_returns_empty(self) -> None:
        assert extract._complement_picks("CORRECT_SCORE", "2:1") == []


# ── _devig_pick (degenerate one-leg case must not produce a fake 1.0) ───────────


class TestDevigPick:
    def test_three_way_devig_removes_overround(self) -> None:
        # Balanced 1X2 with ~5% overround → de-vigged probs sum to 1.
        odds = {"HOME": 2.1, "DRAW": 3.5, "AWAY": 3.6}
        p = extract._devig_pick("ONE_X_TWO", "HOME", odds)
        assert p is not None
        assert 0.0 < p < 1.0

    def test_one_sided_market_does_not_invent_certainty(self) -> None:
        # Only the target leg present → overround = 1/target, so de-vig = 1.0.
        # Known degenerate case (audit 2026-06-11): callers should expect a
        # meaningful result only when both legs of a two-way market are priced.
        only_target = extract._devig_pick("BTTS", "YES", {"YES": 2.0})
        assert only_target == pytest.approx(1.0)

    def test_missing_target_returns_none(self) -> None:
        assert extract._devig_pick("BTTS", "YES", {"NO": 2.0}) is None

    def test_no_odds_at_all_returns_none(self) -> None:
        assert extract._devig_pick("BTTS", "YES", {}) is None

    def test_btts_yes_uses_both_sides(self) -> None:
        p = extract._devig_pick("BTTS", "YES", {"YES": 1.8, "NO": 2.0})
        assert p is not None
        expected = (1 / 1.8) / (1 / 1.8 + 1 / 2.0)
        assert p == pytest.approx(expected)
        assert p < 1.0  # never the degenerate 1.0

    def test_over_under_uses_both_sides(self) -> None:
        p = extract._devig_pick("OVER_UNDER", "OVER", {"OVER": 1.9, "UNDER": 1.9})
        assert p == pytest.approx(0.5)

    def test_team_total_lined_pick_devigs_against_same_line_only(self) -> None:
        # OVER_1_5/UNDER_1_5 present; an unrelated OVER_2_5 price must not leak in.
        odds = {"OVER_1_5": 1.8, "UNDER_1_5": 2.0, "OVER_2_5": 3.0}
        p = extract._devig_pick("TEAM_TOTAL_HOME", "OVER_1_5", odds)
        expected = (1 / 1.8) / (1 / 1.8 + 1 / 2.0)
        assert p == pytest.approx(expected)

    def test_unknown_market_returns_none(self) -> None:
        assert extract._devig_pick("CORRECT_SCORE", "2:1", {"2:1": 8.0}) is None


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
            "canal": "VALUE",
            "prob_estimated": 0.55,
            "odds_bet": 2.0,
            "ev": 0.10,
            "competition_code": "PL",
            "picks_odds": {"HOME": 1.9, "DRAW": 3.5, "AWAY": 4.0},
            "outcome_correct": True,
        }
        base.update(over)
        return base

    def test_delta_p_present_when_pinnacle_available(self) -> None:
        row = extract._build_row(self._raw())
        assert row["p_pinnacle"] is not None
        assert row["delta_p"] == pytest.approx(row["prob_estimated"] - row["p_pinnacle"])
        assert row["outcome_correct"] == 1

    def test_delta_p_none_when_odds_missing(self) -> None:
        row = extract._build_row(self._raw(picks_odds={}))
        assert row["p_pinnacle"] is None
        assert row["delta_p"] is None

    def test_one_x_two_reads_price_from_dedicated_columns_not_picks_odds(self) -> None:
        # Regression (2026-07-24 prod incident): every Pinnacle/Bet365
        # ONE_X_TWO row has pick IS NULL in the DB — the price lives in
        # homeOdds/drawOdds/awayOdds, never in picks_odds. _build_row must
        # merge those columns into picks_odds itself so devig/target-odds
        # work without a market special case.
        row = extract._build_row(
            self._raw(
                picks_odds={},
                home_odds=1.9,
                draw_odds=3.5,
                away_odds=4.0,
            )
        )
        assert row["p_pinnacle"] is not None
        assert row["pinnacle_home_odds"] == pytest.approx(1.9)
        assert row["pinnacle_draw_odds"] == pytest.approx(3.5)
        assert row["pinnacle_away_odds"] == pytest.approx(4.0)

    def test_ev_derived_when_absent(self) -> None:
        row = extract._build_row(self._raw(ev=None))
        # ev = prob_estimated * odds_bet - 1 = 0.55 * 2.0 - 1 = 0.10
        assert row["ev"] == pytest.approx(0.10)

    def test_outcome_false_maps_to_zero(self) -> None:
        row = extract._build_row(self._raw(outcome_correct=False))
        assert row["outcome_correct"] == 0

    def test_team_total_row_reads_line_specific_poisson_probability(self) -> None:
        row = extract._build_row(
            self._raw(
                market="TEAM_TOTAL_HOME",
                pick="OVER_1_5",
                canal="TEAM_TOTAL",
                picks_odds={"OVER_1_5": 1.8, "UNDER_1_5": 2.0},
                features={
                    "recentForm": 0.5,
                    "xg": 0.55,
                    "performanceDomExt": 0.6,
                    "volatiliteLigue": 0.4,
                    "probabilities": {
                        "home": 0.5,
                        "draw": 0.3,
                        "away": 0.2,
                        "teamTotalHome": {"OVER_1_5": 0.62, "UNDER_1_5": 0.38},
                    },
                },
            )
        )
        assert row["p_poisson_pick"] == pytest.approx(0.62)
        assert row["p_pinnacle"] is not None

    def test_clean_sheet_no_pick_uses_complement_of_yes_probability(self) -> None:
        row = extract._build_row(
            self._raw(
                market="CLEAN_SHEET_HOME",
                pick="NO",
                canal="CLEAN_SHEET",
                picks_odds={"YES": 2.5, "NO": 1.5},
                features={
                    "recentForm": 0.5,
                    "xg": 0.55,
                    "performanceDomExt": 0.6,
                    "volatiliteLigue": 0.4,
                    "probabilities": {
                        "home": 0.5,
                        "draw": 0.3,
                        "away": 0.2,
                        "cleanSheetHome": 0.3,
                    },
                },
            )
        )
        assert row["p_poisson_pick"] == pytest.approx(0.7)

    def test_win_either_half_row_reads_home_away_poisson_probability(self) -> None:
        row = extract._build_row(
            self._raw(
                market="TO_WIN_EITHER_HALF",
                pick="AWAY",
                canal="WIN_EITHER_HALF",
                picks_odds={"HOME": 1.6, "AWAY": 2.3},
                features={
                    "recentForm": 0.5,
                    "xg": 0.55,
                    "performanceDomExt": 0.6,
                    "volatiliteLigue": 0.4,
                    "probabilities": {
                        "home": 0.5,
                        "draw": 0.3,
                        "away": 0.2,
                        "winEitherHalfHome": 0.55,
                        "winEitherHalfAway": 0.45,
                    },
                },
            )
        )
        assert row["p_poisson_pick"] == pytest.approx(0.45)
