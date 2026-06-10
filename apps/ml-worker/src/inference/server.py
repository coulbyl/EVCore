"""
FastAPI inference server — exposes /infer for NestJS shadow mode.
Loaded models are served from the ModelRegistry (populated at startup).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from .registry import ModelRegistry

logger = logging.getLogger(__name__)


class InferRequest(BaseModel):
    segment: str
    features: dict[str, Any]


class InferResponse(BaseModel):
    segment: str
    corrected_probability: float | None
    model_found: bool


def create_app(registry: ModelRegistry) -> FastAPI:
    app = FastAPI(title="EVCore ML inference", version="1.0.0")

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {"status": "ok", "active_segments": registry.active_segments()}

    @app.post("/infer", response_model=InferResponse)
    async def infer(req: InferRequest) -> InferResponse:
        prob = registry.predict(req.segment, req.features)
        return InferResponse(
            segment=req.segment,
            corrected_probability=prob,
            model_found=prob is not None,
        )

    return app
