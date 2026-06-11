"""Tests for the inference HTTP server — /infer and /reload."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

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

    async def reload(self) -> None:
        self.reload_calls += 1


def test_infer_returns_corrected_probability() -> None:
    client = TestClient(create_app(_FakeRegistry(prob=0.73)))
    res = client.post("/infer", json={"segment": "ALL", "features": {"x": 1}})
    assert res.status_code == 200
    body = res.json()
    assert body["corrected_probability"] == 0.73
    assert body["model_found"] is True


def test_infer_reports_missing_model() -> None:
    client = TestClient(create_app(_FakeRegistry(prob=None)))
    res = client.post("/infer", json={"segment": "EV:ONE_X_TWO", "features": {}})
    assert res.status_code == 200
    assert res.json()["model_found"] is False


def test_reload_endpoint_triggers_registry_reload() -> None:
    registry = _FakeRegistry()
    client = TestClient(create_app(registry))
    res = client.post("/reload")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert registry.reload_calls == 1


def test_health_lists_active_segments() -> None:
    client = TestClient(create_app(_FakeRegistry()))
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["active_segments"] == ["ALL"]
