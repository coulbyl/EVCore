"""Tests for the correction layer — regression guards for the 2026-06-11 audit."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.models import correction


# ── _roi_simulated (bug 2026-06-11: ignored y_prob, staked every pick) ──────────


def _df(odds: list[float | None], outcomes: list[int]) -> pd.DataFrame:
    return pd.DataFrame({"odds_bet": odds, "outcome_correct": outcomes})


class TestRoiSimulated:
    def test_stakes_only_positive_ev_picks(self) -> None:
        # Two picks at odds 2.0. Model is confident (0.8) on a winner and
        # unconfident (0.2) on a loser → only the first clears EV>0 and is staked.
        df = _df([2.0, 2.0], [1, 0])
        y_prob = np.array([0.8, 0.2])
        # Only pick 1 placed: profit = odds-1 = +1.0, mean over placed = +1.0
        assert correction._roi_simulated(df, y_prob) == pytest.approx(1.0)

    def test_depends_on_the_model_not_just_the_dataset(self) -> None:
        # Same dataset, two different models → different shadow ROI.
        # The old implementation returned the same value regardless of y_prob.
        df = _df([2.5, 2.5, 2.5], [1, 0, 0])
        roi_a = correction._roi_simulated(df, np.array([0.9, 0.9, 0.9]))
        roi_b = correction._roi_simulated(df, np.array([0.1, 0.1, 0.1]))
        assert roi_a != roi_b

    def test_skips_unstakeable_rows_without_odds(self) -> None:
        # Missing odds → not stakeable, even if y_prob is high.
        df = _df([None, 2.0], [0, 1])
        y_prob = np.array([0.99, 0.8])
        # Only the second row is stakeable and it wins → +1.0
        assert correction._roi_simulated(df, y_prob) == pytest.approx(1.0)

    def test_no_positive_ev_pick_returns_zero(self) -> None:
        df = _df([2.0, 2.0], [1, 0])
        y_prob = np.array([0.1, 0.1])  # 0.1*2 - 1 = -0.8 < 0 everywhere
        assert correction._roi_simulated(df, y_prob) == 0.0

    def test_losing_placed_pick_costs_one_unit(self) -> None:
        df = _df([2.0], [0])
        y_prob = np.array([0.9])  # placed (EV>0) but lost
        assert correction._roi_simulated(df, y_prob) == pytest.approx(-1.0)

    def test_no_odds_column_returns_zero(self) -> None:
        df = pd.DataFrame({"outcome_correct": [1, 0]})
        assert correction._roi_simulated(df, np.array([0.8, 0.2])) == 0.0


# ── _resolve_algorithm ──────────────────────────────────────────────────────────


class TestResolveAlgorithm:
    def test_auto_picks_logreg_below_threshold(self) -> None:
        assert correction._resolve_algorithm("auto", 199) == "logistic_regression"

    def test_auto_picks_xgboost_at_threshold(self) -> None:
        assert correction._resolve_algorithm("auto", 200) == "xgboost"

    def test_explicit_algorithm_is_respected(self) -> None:
        assert correction._resolve_algorithm("logistic_regression", 5000) == "logistic_regression"
        assert correction._resolve_algorithm("xgboost", 10) == "xgboost"


# ── _assert_class_balance ───────────────────────────────────────────────────────


class TestClassBalance:
    def test_raises_when_a_class_is_too_small(self) -> None:
        df = pd.DataFrame({"outcome_correct": [1] * 50 + [0] * 5})
        with pytest.raises(ValueError, match="Insufficient class balance"):
            correction._assert_class_balance(df, "train")

    def test_passes_with_balanced_classes(self) -> None:
        df = pd.DataFrame({"outcome_correct": [1] * 30 + [0] * 30})
        correction._assert_class_balance(df, "train")  # no raise
