"""Tests for the inference ModelRegistry — regression guard for the stale-model bug."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pytest

from src.inference import registry as registry_mod
from src.inference.registry import ModelRegistry


# ── Fakes for psycopg + joblib so load() runs without a real DB or model files ──


class _FakeCursor:
    def __init__(self, rows: list[tuple[str, str]]) -> None:
        self._rows = rows

    async def execute(self, _sql: str) -> None:
        return None

    async def fetchall(self) -> list[tuple[str, str]]:
        return self._rows

    async def __aenter__(self) -> "_FakeCursor":
        return self

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _FakeConn:
    def __init__(self, rows: list[tuple[str, str]]) -> None:
        self._rows = rows

    def cursor(self) -> _FakeCursor:
        return _FakeCursor(self._rows)

    async def __aenter__(self) -> "_FakeConn":
        return self

    async def __aexit__(self, *_exc: object) -> None:
        return None


def _patch_db(monkeypatch: pytest.MonkeyPatch, rows: list[tuple[str, str]]) -> None:
    async def _connect(*_args: Any, **_kwargs: Any) -> _FakeConn:
        return _FakeConn(rows)

    monkeypatch.setattr(registry_mod.psycopg.AsyncConnection, "connect", _connect)
    # Pretend every model file exists and loads to a sentinel tagged by path.
    monkeypatch.setattr(Path, "exists", lambda self: True)
    monkeypatch.setattr(registry_mod.joblib, "load", lambda path: f"model::{path}")


class TestRegistryLoad:
    async def test_loads_active_models(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_db(monkeypatch, [("ALL", "/m/all.pkl"), ("EV:ONE_X_TWO", "/m/ev.pkl")])
        reg = ModelRegistry()
        await reg.load("postgres://x")
        assert set(reg.active_segments()) == {"ALL", "EV:ONE_X_TWO"}

    async def test_skips_rows_with_empty_path(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_db(monkeypatch, [("ALL", "/m/all.pkl"), ("EV:ONE_X_TWO", "")])
        reg = ModelRegistry()
        await reg.load("postgres://x")
        assert reg.active_segments() == ["ALL"]


class TestRegistryReload:
    async def test_reload_evicts_deactivated_models(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # First load: two active segments.
        _patch_db(monkeypatch, [("ALL", "/m/all.pkl"), ("DRAW:ONE_X_TWO", "/m/draw.pkl")])
        reg = ModelRegistry()
        await reg.load("postgres://x")
        assert set(reg.active_segments()) == {"ALL", "DRAW:ONE_X_TWO"}

        # DRAW segment is deactivated (e.g. rollback) → only ALL active now.
        _patch_db(monkeypatch, [("ALL", "/m/all.pkl")])
        await reg.reload()
        # The stale DRAW model must be gone — the bug kept it in memory forever.
        assert reg.active_segments() == ["ALL"]

    async def test_reload_before_initial_load_is_noop(self) -> None:
        reg = ModelRegistry()
        await reg.reload()  # no stored url → must not raise
        assert reg.active_segments() == []

    async def test_reload_reuses_stored_database_url(self, monkeypatch: pytest.MonkeyPatch) -> None:
        seen: list[str] = []

        async def _connect(url: str, *_a: Any, **_k: Any) -> _FakeConn:
            seen.append(url)
            return _FakeConn([("ALL", "/m/all.pkl")])

        monkeypatch.setattr(registry_mod.psycopg.AsyncConnection, "connect", _connect)
        monkeypatch.setattr(Path, "exists", lambda self: True)
        monkeypatch.setattr(registry_mod.joblib, "load", lambda path: "model")

        reg = ModelRegistry()
        await reg.load("postgres://stored")
        await reg.reload()
        assert seen == ["postgres://stored", "postgres://stored"]


class TestRegistryPredict:
    async def test_falls_back_to_all_model(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _patch_db(monkeypatch, [("ALL", "/m/all.pkl")])
        reg = ModelRegistry()
        await reg.load("postgres://x")

        class _Model:
            def predict_proba(self, _df: object) -> np.ndarray:
                # registry.predict slices [:, 1] — must be a numpy array.
                return np.array([[0.3, 0.7]])

        reg._models["ALL"] = _Model()  # type: ignore[assignment]
        # Unknown segment → ALL fallback → returns the positive-class prob.
        assert reg.predict("CONF:ONE_X_TWO", {"x": 1}) == pytest.approx(0.7)

    def test_returns_none_when_no_model(self) -> None:
        reg = ModelRegistry()
        assert reg.predict("EV:ONE_X_TWO", {"x": 1}) is None
