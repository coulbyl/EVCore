"""
Model registry — loads active ML models from DB into memory at startup.
Provides synchronous predict() for use in the inference HTTP server.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import psycopg
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, Pipeline] = {}
        self._model_ids: dict[str, str] = {}
        self._database_url: str | None = None

    async def load(self, database_url: str) -> None:
        """Load all active models from ml_model_version into memory."""
        self._database_url = database_url
        try:
            async with await psycopg.AsyncConnection.connect(database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        'SELECT segment, "modelPath", id FROM ml_model_version WHERE "isActive" = true'
                    )
                    rows = await cur.fetchall()
        except Exception as exc:
            logger.error("failed to query active models", extra={"error": str(exc)})
            return

        # Build a fresh mapping then swap atomically — evicts models that were
        # deactivated or rolled back since the last load.
        models: dict[str, Pipeline] = {}
        model_ids: dict[str, str] = {}
        loaded = 0
        for row in rows:
            segment, model_path = row[:2]
            model_id = str(row[2]) if len(row) > 2 else "UNKNOWN"
            if not model_path:
                logger.warning("no model path", extra={"segment": segment})
                continue
            path = Path(model_path)
            if not path.exists():
                logger.warning("model file missing", extra={"segment": segment, "path": str(path)})
                continue
            try:
                models[segment] = joblib.load(path)
                model_ids[segment] = str(model_id)
                loaded += 1
                logger.info("model loaded", extra={"segment": segment})
            except Exception as exc:
                logger.error("failed to load model", extra={"segment": segment, "error": str(exc)})

        self._models, self._model_ids = models, model_ids
        logger.info(
            "registry ready",
            extra={"loaded": loaded, "segments": list(self._models.keys())},
        )

    async def reload(self) -> None:
        """Re-sync with ml_model_version — called when the backend activates,
        auto-switches or rolls back a model. Without this the in-memory models
        only changed on container restart."""
        if self._database_url is None:
            logger.warning("reload requested before initial load — skipped")
            return
        await self.load(self._database_url)

    def active_segments(self) -> list[str]:
        return list(self._models.keys())

    def model_id(self, segment: str) -> str | None:
        return self._model_ids.get(segment) or self._model_ids.get("ALL")

    def predict(self, segment: str, features: dict[str, Any]) -> float | None:
        """
        Return corrected probability for the given segment.
        Falls back to the ALL model if no segment-specific model is active.
        Returns None if no model is available.
        """
        if features.get("delta_p") is None:
            return None
        model = self._models.get(segment) or self._models.get("ALL")
        if model is None:
            return None
        try:
            df = pd.DataFrame([features])
            return float(model.predict_proba(df)[:, 1][0])
        except Exception as exc:
            logger.error("prediction failed", extra={"segment": segment, "error": str(exc)})
            return None
