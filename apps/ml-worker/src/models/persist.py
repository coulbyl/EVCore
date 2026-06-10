"""
Model serialisation and persistence to PostgreSQL (ml_model_version).

Models are saved to a local directory (/app/models/) and the path stored in DB.
Mount this directory as a named Docker volume for persistence across restarts.
"""

from __future__ import annotations

import io
import json
import logging
import uuid
from pathlib import Path

import joblib
import psycopg
from sklearn.pipeline import Pipeline

from .correction import ALL_FEATURES, TrainingResult

logger = logging.getLogger(__name__)

MODELS_DIR = Path("/app/models")


def _model_path(model_id: str) -> Path:
    return MODELS_DIR / f"{model_id}.pkl"


def save_model(pipeline: Pipeline, model_id: str) -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    path = _model_path(model_id)
    joblib.dump(pipeline, path)
    logger.info("model saved", extra={"path": str(path)})
    return path


def load_model(model_path: str) -> Pipeline:
    return joblib.load(model_path)


async def persist(opts: dict) -> str:
    """
    Insert a new ml_model_version record and return its id.

    opts keys: database_url, result (TrainingResult), segment, model_id
    """
    database_url: str = opts["database_url"]
    result: TrainingResult = opts["result"]
    segment: str = opts["segment"]
    model_id: str = opts["model_id"]

    path = save_model(result.pipeline, model_id)

    metrics = {
        "brierScore": result.brier_score,
        "calibrationError": result.calibration_error,
        "roiShadow": result.roi_simulated,
        "sampleSize": result.sample_size,
        "trainSize": result.train_size,
        "testSize": result.test_size,
    }

    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO ml_model_version
                    (id, segment, algorithm, features, metrics, "modelPath")
                VALUES
                    (gen_random_uuid(), %s, %s, %s::jsonb, %s::jsonb, %s)
                RETURNING id::text
                """,
                (
                    segment,
                    result.algorithm,
                    json.dumps(ALL_FEATURES),
                    json.dumps(metrics),
                    str(path),
                ),
            )
            row = await cur.fetchone()
            await conn.commit()

    version_id = str(row[0])
    logger.info("version persisted", extra={"id": version_id, "segment": segment})
    return version_id
