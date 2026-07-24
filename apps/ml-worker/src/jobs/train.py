"""
Training job handler — scaffold for Étape 4-5.

Current behaviour: validates the payload and logs receipt.
Real training (dataset extraction, model fit, serialisation) added in Étape 4-5.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import uuid

from ..config import Config
from ..data.extract import extract_dataset
from ..models import correction, persist

logger = logging.getLogger(__name__)

# Canal names mirror the `StrategyChannel` Prisma enum (EV→VALUE, CONF→DOMINANT
# renamed 2026-07; see docs/ml-worker-sync.md). Each entry needs >=50 settled
# channel_selection rows to actually train (ML_RETRAIN_MIN_NEW_BETS).
# CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF added 2026-07-24 (real settled
# volume + Pinnacle/Bet365 odds coverage confirmed — see extract.py).
# CORRECT_SCORE is excluded: de-vigging a ~50-scoreline market needs different
# logic than the two/three-way markets extract.py handles — deferred.
VALID_SEGMENTS = frozenset([
    "ALL",
    "VALUE:ONE_X_TWO",
    "VALUE:OVER_UNDER",
    "VALUE:BTTS",
    "VALUE:FIRST_HALF_WINNER",
    "SAFE:ONE_X_TWO",
    "SAFE:OVER_UNDER",
    "DOMINANT:ONE_X_TWO",
    "BTTS:BTTS",
    "DRAW:ONE_X_TWO",
    "GOALS:OVER_UNDER",
    "CLEAN_SHEET:CLEAN_SHEET_HOME",
    "CLEAN_SHEET:CLEAN_SHEET_AWAY",
    "TEAM_TOTAL:TEAM_TOTAL_HOME",
    "TEAM_TOTAL:TEAM_TOTAL_AWAY",
    "WIN_EITHER_HALF:TO_WIN_EITHER_HALF",
])

VALID_ALGORITHMS = frozenset(["auto", "logistic_regression", "xgboost"])


@dataclass(frozen=True)
class TrainJobPayload:
    segment: str
    triggered_by: str
    algorithm: str = "auto"


def _parse(raw: dict[str, Any]) -> TrainJobPayload:
    segment = raw.get("segment", "ALL")
    if segment not in VALID_SEGMENTS:
        raise ValueError(f"Unknown segment: {segment!r}")
    algorithm = raw.get("algorithm", "auto")
    if algorithm not in VALID_ALGORITHMS:
        raise ValueError(f"Unknown algorithm: {algorithm!r}")
    return TrainJobPayload(
        segment=segment,
        triggered_by=str(raw.get("triggeredBy", "unknown")),
        algorithm=algorithm,
    )


async def handle(data: dict[str, Any], config: Config) -> dict[str, Any]:
    payload = _parse(data)
    logger.info(
        "training job received",
        extra={"segment": payload.segment, "triggered_by": payload.triggered_by},
    )

    df = await extract_dataset(config.database_url, payload.segment)

    if len(df) == 0:
        logger.warning("empty dataset, aborting", extra={"segment": payload.segment})
        return {"status": "aborted", "reason": "empty_dataset", "segment": payload.segment}

    with_pinnacle = int(df["p_pinnacle"].notna().sum())
    logger.info(
        "dataset extracted",
        extra={
            "segment": payload.segment,
            "total_rows": len(df),
            "with_pinnacle": with_pinnacle,
            "won": int((df["outcome_correct"] == 1).sum()),
        },
    )

    try:
        result = correction.train(df, payload.algorithm)
    except ValueError as exc:
        logger.warning("training aborted", extra={"reason": str(exc), "segment": payload.segment})
        return {"status": "aborted", "reason": str(exc), "segment": payload.segment}

    model_id = str(uuid.uuid4())
    version_id = await persist.persist({
        "database_url": config.database_url,
        "result": result,
        "segment": payload.segment,
        "model_id": model_id,
    })

    logger.info(
        "training job done",
        extra={
            "version_id": version_id,
            "segment": payload.segment,
            "brier_score": round(result.brier_score, 4),
            "roi_simulated": round(result.roi_simulated, 4),
        },
    )
    return {
        "status": "done",
        "version_id": version_id,
        "segment": payload.segment,
        "algorithm": result.algorithm,
        "brier_score": result.brier_score,
        "calibration_error": result.calibration_error,
        "roi_simulated": result.roi_simulated,
        "sample_size": result.sample_size,
    }
