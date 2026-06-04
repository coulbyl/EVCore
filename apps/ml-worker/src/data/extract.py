"""
Dataset extraction for the ML correction layer.

Joins ModelRun × Bet × Fixture × Competition × OddsSnapshot(Pinnacle)
and returns a feature-engineered DataFrame ready for model training.
Each row is one settled bet (WON or LOST).
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
import psycopg
import psycopg.rows

logger = logging.getLogger(__name__)

# ── SQL ────────────────────────────────────────────────────────────────────────

_SQL = """
SELECT
    mr."analyzedAt"                 AS analyzed_at,
    mr."deterministicScore"         AS deterministic_score,
    mr.features                     AS features,
    b.market,
    b.pick,
    b."probEstimated"               AS prob_estimated,
    b."oddsSnapshot"                AS odds_bet,
    b.ev,
    b."isSafeValue"                 AS is_safe_value,
    b.status,
    c.code                          AS competition_code,
    os."homeOdds"                   AS pinnacle_home,
    os."drawOdds"                   AS pinnacle_draw,
    os."awayOdds"                   AS pinnacle_away
FROM model_run mr
JOIN bet b         ON b."modelRunId"  = mr.id
JOIN fixture f     ON f.id            = mr."fixtureId"
JOIN season s      ON s.id            = f."seasonId"
JOIN competition c ON c.id            = s."competitionId"
LEFT JOIN LATERAL (
    SELECT "homeOdds", "drawOdds", "awayOdds"
    FROM odds_snapshot
    WHERE "fixtureId" = f.id
      AND bookmaker   = 'Pinnacle'
      AND market      = b.market
    ORDER BY "snapshotAt" DESC
    LIMIT 1
) os ON TRUE
WHERE b.status IN ('WON', 'LOST')
ORDER BY mr."analyzedAt"
"""

# ── Feature engineering ────────────────────────────────────────────────────────

_TOP5_COMPETITIONS = frozenset(["PL", "SA", "LL", "BL1", "L1"])
_INTERNATIONAL = frozenset(["WC", "UCL", "UEL", "UECL", "FRI"])


def _league_tier(code: str) -> str:
    if code in _TOP5_COMPETITIONS:
        return "top5"
    if code in _INTERNATIONAL:
        return "international"
    return "secondary"


def _odds_segment(odds: float | None) -> str:
    if odds is None:
        return "unknown"
    if odds < 1.5:
        return "low"
    if odds <= 2.5:
        return "mid"
    return "high"


def _devig_pinnacle(opts: dict[str, float | None]) -> float | None:
    """De-vig Pinnacle odds for the target pick. Returns None if odds missing."""
    target = opts.get("target")
    available = [v for v in [opts.get("home"), opts.get("draw"), opts.get("away")] if v]
    if not target or not available:
        return None
    overround = sum(1.0 / o for o in available)
    return (1.0 / target) / overround


def _pinnacle_prob_for_pick(
    pick: str,
    home: float | None,
    draw: float | None,
    away: float | None,
) -> float | None:
    mapping = {"HOME": home, "DRAW": draw, "AWAY": away, "OVER": home, "YES": home, "NO": away, "UNDER": away}
    return _devig_pinnacle({"target": mapping.get(pick), "home": home, "draw": draw, "away": away})


def _extract_poisson(features: dict[str, Any], pick: str) -> dict[str, float | None]:
    probs = features.get("probabilities") or {}
    return {
        "p_poisson_home": probs.get("home"),
        "p_poisson_draw": probs.get("draw"),
        "p_poisson_away": probs.get("away"),
        "p_poisson_pick": {
            "HOME": probs.get("home"),
            "DRAW": probs.get("draw"),
            "AWAY": probs.get("away"),
            "OVER": probs.get("over25"),
            "UNDER": probs.get("under25"),
            "YES": probs.get("bttsYes"),
            "NO": probs.get("bttsNo"),
        }.get(pick),
    }


def _build_row(raw: dict[str, Any]) -> dict[str, Any]:
    features: dict[str, Any] = raw["features"] or {}
    pick: str = raw["pick"]
    prob_estimated = float(raw["prob_estimated"])
    home = float(raw["pinnacle_home"]) if raw["pinnacle_home"] else None
    draw = float(raw["pinnacle_draw"]) if raw["pinnacle_draw"] else None
    away = float(raw["pinnacle_away"]) if raw["pinnacle_away"] else None
    p_pinnacle = _pinnacle_prob_for_pick(pick, home, draw, away)
    poisson = _extract_poisson(features, pick)

    return {
        "analyzed_at": raw["analyzed_at"],
        "market": raw["market"],
        "pick": pick,
        "canal": "SV" if raw["is_safe_value"] else "EV",
        "competition_code": raw["competition_code"],
        "league_tier": _league_tier(raw["competition_code"]),
        "odds_segment": _odds_segment(float(raw["odds_bet"]) if raw["odds_bet"] else None),
        # Model probabilities
        "prob_estimated": prob_estimated,
        "deterministic_score": float(raw["deterministic_score"]),
        "ev": float(raw["ev"]),
        # Poisson features
        "p_poisson_home": poisson["p_poisson_home"],
        "p_poisson_draw": poisson["p_poisson_draw"],
        "p_poisson_away": poisson["p_poisson_away"],
        "p_poisson_pick": poisson["p_poisson_pick"],
        "recent_form": features.get("recentForm"),
        "xg": features.get("xg"),
        "performance_dom_ext": features.get("performanceDomExt"),
        "volatilite_ligue": features.get("volatiliteLigue"),
        # Pinnacle comparison (None when Pinnacle odds missing)
        "p_pinnacle": p_pinnacle,
        "delta_p": (prob_estimated - p_pinnacle) if p_pinnacle else None,
        "pinnacle_home_odds": home,
        "pinnacle_draw_odds": draw,
        "pinnacle_away_odds": away,
        # Target
        "outcome_correct": 1 if raw["status"] == "WON" else 0,
    }


# ── Public API ─────────────────────────────────────────────────────────────────


async def extract_dataset(database_url: str, segment: str) -> pd.DataFrame:
    """
    Extract and engineer the training dataset from PostgreSQL.

    Returns a DataFrame sorted by analyzed_at (temporal order preserved).
    Rows without Pinnacle odds have None in delta_p / p_pinnacle columns
    — callers must decide whether to drop or impute them.
    """
    logger.info("extracting dataset", extra={"segment": segment})

    async with await psycopg.AsyncConnection.connect(database_url) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(_SQL)
            rows = await cur.fetchall()

    logger.info("raw rows fetched", extra={"count": len(rows)})

    records = [_build_row(dict(row)) for row in rows]
    df = pd.DataFrame(records)

    df = _apply_segment_filter(df, segment)
    df = df.sort_values("analyzed_at").reset_index(drop=True)

    logger.info(
        "dataset ready",
        extra={
            "rows": len(df),
            "with_pinnacle": int(df["p_pinnacle"].notna().sum()),
            "won": int((df["outcome_correct"] == 1).sum()),
        },
    )
    return df


def _apply_segment_filter(df: pd.DataFrame, segment: str) -> pd.DataFrame:
    if segment == "ALL":
        return df
    parts = segment.split(":", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid segment format: {segment!r}. Expected 'CANAL:MARKET'.")
    canal, market = parts
    mask = (df["canal"] == canal) & (df["market"] == market)
    return df[mask].copy()


def temporal_split(df: pd.DataFrame, train_ratio: float = 0.8) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split by time order to avoid data leakage.
    Returns (train_df, test_df).
    """
    cutoff = int(len(df) * train_ratio)
    return df.iloc[:cutoff].copy(), df.iloc[cutoff:].copy()
