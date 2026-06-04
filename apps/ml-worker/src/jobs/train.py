"""
Training job handler — scaffold for Étape 4-5.

Current behaviour: validates the payload and logs receipt.
Real training (dataset extraction, model fit, serialisation) added in Étape 4-5.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from ..config import Config

logger = logging.getLogger(__name__)

VALID_SEGMENTS = frozenset(["EV:ONE_X_TWO", "CONF:ONE_X_TWO", "ALL"])


@dataclass(frozen=True)
class TrainJobPayload:
    segment: str
    triggered_by: str


def _parse(raw: dict[str, Any]) -> TrainJobPayload:
    segment = raw.get("segment", "ALL")
    if segment not in VALID_SEGMENTS:
        raise ValueError(f"Unknown segment: {segment!r}")
    return TrainJobPayload(
        segment=segment,
        triggered_by=str(raw.get("triggeredBy", "unknown")),
    )


async def handle(data: dict[str, Any], config: Config) -> dict[str, Any]:
    payload = _parse(data)
    logger.info(
        "training job received",
        extra={"segment": payload.segment, "triggered_by": payload.triggered_by},
    )

    # TODO Étape 4: dataset = await extract_dataset(payload.segment, config.database_url)
    # TODO Étape 5: model, metrics = train_correction_model(dataset)
    # TODO Étape 5: persist_model(model, metrics, payload.segment, config.database_url)

    logger.info("training job completed (scaffold)", extra={"segment": payload.segment})
    return {"status": "scaffold", "segment": payload.segment}
