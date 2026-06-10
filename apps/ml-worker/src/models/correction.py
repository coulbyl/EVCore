"""
Correction layer model — logistic regression (v1) and XGBoost (v2).

Learns where the Poisson baseline over/under-estimates probabilities
and produces a corrected probability for each pick.

Training only on rows that have Pinnacle odds (delta_p is the key feature).
XGBoost is used automatically when segment volumes reach _MIN_XGBOOST_SAMPLES.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

logger = logging.getLogger(__name__)

NUMERICAL_FEATURES = [
    "prob_estimated",
    "deterministic_score",
    "ev",
    "delta_p",
    "p_poisson_home",
    "p_poisson_draw",
    "p_poisson_away",
    "recent_form",
    "xg",
    "performance_dom_ext",
    "volatilite_ligue",
]

CATEGORICAL_FEATURES = ["market", "canal", "league_tier", "odds_segment"]

ALL_FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES

_MIN_CLASS_SAMPLES = 20
_MIN_XGBOOST_SAMPLES = 200


@dataclass
class TrainingResult:
    pipeline: Pipeline
    algorithm: str
    brier_score: float
    calibration_error: float
    roi_simulated: float
    sample_size: int
    train_size: int
    test_size: int


def _build_logreg_pipeline() -> Pipeline:
    num_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    preprocessor = ColumnTransformer([
        ("num", num_pipe, NUMERICAL_FEATURES),
        ("cat", cat_pipe, CATEGORICAL_FEATURES),
    ])
    return Pipeline([
        ("prep", preprocessor),
        ("clf", LogisticRegression(max_iter=1000, C=1.0, class_weight="balanced")),
    ])


def _build_xgboost_pipeline(scale_pos_weight: float = 1.0) -> Pipeline:
    num_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
    ])
    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    preprocessor = ColumnTransformer([
        ("num", num_pipe, NUMERICAL_FEATURES),
        ("cat", cat_pipe, CATEGORICAL_FEATURES),
    ])
    return Pipeline([
        ("prep", preprocessor),
        ("clf", XGBClassifier(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            eval_metric="logloss",
            random_state=42,
        )),
    ])


def _resolve_algorithm(algorithm: str, n_samples: int) -> str:
    if algorithm == "auto":
        return "xgboost" if n_samples >= _MIN_XGBOOST_SAMPLES else "logistic_regression"
    return algorithm


def _calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    """Mean absolute calibration error across probability bins."""
    fraction_pos, mean_predicted = calibration_curve(y_true, y_prob, n_bins=n_bins)
    return float(np.mean(np.abs(fraction_pos - mean_predicted)))


def _roi_simulated(df_test: pd.DataFrame, y_prob: np.ndarray) -> float:
    """
    Simulated ROI if we bet every pick in the test set (at modeled probability).
    Uses actual bet odds from oddsSnapshot.
    """
    if "odds_bet" not in df_test.columns:
        return 0.0
    odds = pd.to_numeric(df_test["odds_bet"], errors="coerce").fillna(1.0).values
    outcomes = df_test["outcome_correct"].values
    # Simulate: stake 1 unit per pick, collect odds if WON
    profits = np.where(outcomes == 1, odds - 1.0, -1.0)
    return float(profits.mean())


def train(df: pd.DataFrame, algorithm: str = "auto") -> TrainingResult:
    """
    Train the correction layer on rows that have Pinnacle odds (delta_p present).

    Uses a 70/30 temporal split — older data trains, recent data evaluates.
    algorithm: "auto" picks XGBoost if ≥200 Pinnacle samples, else LogReg.
    Raises ValueError if class balance is insufficient.
    """
    df_pinnacle = df[df["delta_p"].notna()].copy()
    resolved = _resolve_algorithm(algorithm, len(df_pinnacle))
    logger.info(
        "training on rows with Pinnacle",
        extra={"count": len(df_pinnacle), "algorithm": resolved},
    )

    cutoff = int(len(df_pinnacle) * 0.70)
    df_train = df_pinnacle.iloc[:cutoff]
    df_test = df_pinnacle.iloc[cutoff:]

    _assert_class_balance(df_train, "train")
    _assert_class_balance(df_test, "test")

    X_train = df_train[ALL_FEATURES]
    y_train = df_train["outcome_correct"].values
    X_test = df_test[ALL_FEATURES]
    y_test = df_test["outcome_correct"].values

    if resolved == "xgboost":
        n_neg = int((y_train == 0).sum())
        n_pos = int((y_train == 1).sum())
        pipeline = _build_xgboost_pipeline(scale_pos_weight=n_neg / max(n_pos, 1))
    else:
        pipeline = _build_logreg_pipeline()

    pipeline.fit(X_train, y_train)

    y_prob_test = pipeline.predict_proba(X_test)[:, 1]

    brier = float(brier_score_loss(y_test, y_prob_test))
    cal_err = _calibration_error(y_test, y_prob_test)
    roi = _roi_simulated(df_test, y_prob_test)

    logger.info(
        "training complete",
        extra={
            "algorithm": resolved,
            "brier_score": round(brier, 4),
            "calibration_error": round(cal_err, 4),
            "roi_simulated": round(roi, 4),
            "train_size": len(df_train),
            "test_size": len(df_test),
        },
    )

    return TrainingResult(
        pipeline=pipeline,
        algorithm=resolved,
        brier_score=brier,
        calibration_error=cal_err,
        roi_simulated=roi,
        sample_size=len(df_pinnacle),
        train_size=len(df_train),
        test_size=len(df_test),
    )


def _assert_class_balance(df: pd.DataFrame, split_name: str) -> None:
    n_pos = int((df["outcome_correct"] == 1).sum())
    n_neg = int((df["outcome_correct"] == 0).sum())
    if n_pos < _MIN_CLASS_SAMPLES or n_neg < _MIN_CLASS_SAMPLES:
        raise ValueError(
            f"Insufficient class balance in {split_name} split: "
            f"{n_pos} positives, {n_neg} negatives (min {_MIN_CLASS_SAMPLES} each)."
        )
