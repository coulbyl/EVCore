"""Tests for the inference HTTP server — /infer and /reload."""

from __future__ import annotations

from typing import Any

import httpx

from src.inference.server import create_app


class _FakeRegistry:
    """Duck-typed stand-in for ModelRegistry — no DB, no model files."""

    def __init__(self, prob: float | None = 0.73) -> None:
        self._prob = prob
        self.reload_calls = 0

    def predict(self, _segment: str, _features: dict[str, Any]) -> float | None:
        return self._prob

    def active_segments(self) -> list[str]:
        return ["ALL"]

    def model_id(self, _segment: str) -> str:
        return "model-v1"

    async def reload(self) -> None:
        self.reload_calls += 1


async def test_infer_returns_corrected_probability() -> None:
    app = create_app(_FakeRegistry(prob=0.73))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/infer", json={"segment": "ALL", "features": {"delta_p": 0.1}}
        )
    assert res.status_code == 200
    body = res.json()
    assert body["corrected_probability"] == 0.73
    assert body["model_found"] is True
    assert body["model_id"] == "model-v1"


async def test_infer_reports_missing_model() -> None:
    app = create_app(_FakeRegistry(prob=None))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/infer", json={"segment": "EV:ONE_X_TWO", "features": {}}
        )
    assert res.status_code == 200
    assert res.json()["model_found"] is False


async def test_reload_endpoint_triggers_registry_reload() -> None:
    registry = _FakeRegistry()
    app = create_app(registry)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post("/reload")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert registry.reload_calls == 1


async def test_health_lists_active_segments() -> None:
    app = create_app(_FakeRegistry())
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["active_segments"] == ["ALL"]
