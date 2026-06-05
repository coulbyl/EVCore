"""
Dataset extraction for the ML correction layer.

Joins ModelRun × Bet/Prediction × Fixture × Competition × OddsSnapshot(Pinnacle)
and returns a feature-engineered DataFrame ready for model training.
Each row is one settled bet (WON/LOST) or settled prediction (correct true/false).
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

_ODDS_LATERAL_SQL = """
LEFT JOIN LATERAL (
    SELECT
        MAX("homeOdds") AS "homeOdds",
        MAX("drawOdds") AS "drawOdds",
        MAX("awayOdds") AS "awayOdds",
        MAX(odds) FILTER (WHERE pick = 'HOME') AS "pickHomeOdds",
        MAX(odds) FILTER (WHERE pick = 'DRAW') AS "pickDrawOdds",
        MAX(odds) FILTER (WHERE pick = 'AWAY') AS "pickAwayOdds",
        MAX(odds) FILTER (WHERE pick = 'YES') AS "yesOdds",
        MAX(odds) FILTER (WHERE pick = 'NO') AS "noOdds",
        MAX(odds) FILTER (WHERE pick IN ('OVER', 'OVER_2_5')) AS "overOdds",
        MAX(odds) FILTER (WHERE pick IN ('UNDER', 'UNDER_2_5')) AS "underOdds"
    FROM (
        SELECT DISTINCT ON (pick)
            pick,
            odds,
            "homeOdds",
            "drawOdds",
            "awayOdds",
            "snapshotAt"
        FROM odds_snapshot
        WHERE "fixtureId" = f.id
          AND bookmaker   = 'Pinnacle'
          AND market      = {market_ref}
        ORDER BY pick, "snapshotAt" DESC
    ) latest
) os ON TRUE
"""

_BET_SQL = f"""
SELECT
    mr."analyzedAt"                 AS analyzed_at,
    mr."deterministicScore"         AS deterministic_score,
    mr.features                     AS features,
    b.market::text                  AS market,
    b.pick,
    CASE WHEN b."isSafeValue" THEN 'SV' ELSE 'EV' END AS canal,
    b."probEstimated"               AS prob_estimated,
    b."oddsSnapshot"                AS odds_bet,
    b.ev,
    (b.status = 'WON')              AS outcome_correct,
    c.code                          AS competition_code,
    COALESCE(os."homeOdds", os."pickHomeOdds") AS pinnacle_home,
    COALESCE(os."drawOdds", os."pickDrawOdds") AS pinnacle_draw,
    COALESCE(os."awayOdds", os."pickAwayOdds") AS pinnacle_away,
    os."yesOdds"                    AS pinnacle_yes,
    os."noOdds"                     AS pinnacle_no,
    os."overOdds"                   AS pinnacle_over,
    os."underOdds"                  AS pinnacle_under
FROM model_run mr
JOIN bet b         ON b."modelRunId"  = mr.id
JOIN fixture f     ON f.id            = mr."fixtureId"
JOIN season s      ON s.id            = f."seasonId"
JOIN competition c ON c.id            = s."competitionId"
{_ODDS_LATERAL_SQL.format(market_ref="b.market")}
WHERE b.status IN ('WON', 'LOST')
  AND (%s::boolean IS NULL OR mr."isBackfill" = %s::boolean)
ORDER BY mr."analyzedAt"
"""

_PREDICTION_SQL = f"""
SELECT
    mr."analyzedAt"                 AS analyzed_at,
    mr."deterministicScore"         AS deterministic_score,
    mr.features                     AS features,
    p.market::text                  AS market,
    p.pick,
    p.channel::text                 AS canal,
    p.probability                   AS prob_estimated,
    NULL::numeric                   AS odds_bet,
    NULL::numeric                   AS ev,
    p.correct                       AS outcome_correct,
    c.code                          AS competition_code,
    COALESCE(os."homeOdds", os."pickHomeOdds") AS pinnacle_home,
    COALESCE(os."drawOdds", os."pickDrawOdds") AS pinnacle_draw,
    COALESCE(os."awayOdds", os."pickAwayOdds") AS pinnacle_away,
    os."yesOdds"                    AS pinnacle_yes,
    os."noOdds"                     AS pinnacle_no,
    os."overOdds"                   AS pinnacle_over,
    os."underOdds"                  AS pinnacle_under
FROM model_run mr
JOIN prediction p  ON p."modelRunId"  = mr.id
JOIN fixture f     ON f.id            = mr."fixtureId"
JOIN season s      ON s.id            = f."seasonId"
JOIN competition c ON c.id            = s."competitionId"
{_ODDS_LATERAL_SQL.format(market_ref="p.market")}
WHERE p.correct IS NOT NULL
  AND (%s::boolean IS NULL OR mr."isBackfill" = %s::boolean)
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


def _num(value: Any) -> float | None:
    return float(value) if value is not None else None


def _pinnacle_odds(raw: dict[str, Any]) -> dict[str, float | None]:
    return {
        "home": _num(raw.get("pinnacle_home")),
        "draw": _num(raw.get("pinnacle_draw")),
        "away": _num(raw.get("pinnacle_away")),
        "yes": _num(raw.get("pinnacle_yes")),
        "no": _num(raw.get("pinnacle_no")),
        "over": _num(raw.get("pinnacle_over")),
        "under": _num(raw.get("pinnacle_under")),
    }


def _target_odds(market: str, pick: str, odds: dict[str, float | None]) -> float | None:
    if market in {"ONE_X_TWO", "FIRST_HALF_WINNER"}:
        return {"HOME": odds["home"], "DRAW": odds["draw"], "AWAY": odds["away"]}.get(pick)
    if market == "BTTS":
        return {"YES": odds["yes"], "NO": odds["no"]}.get(pick)
    if market in {"OVER_UNDER", "OVER_UNDER_HT"}:
        return {"OVER": odds["over"], "UNDER": odds["under"]}.get(pick)
    return None


def _pinnacle_prob_for_pick(
    market: str,
    pick: str,
    odds: dict[str, float | None],
) -> float | None:
    target = _target_odds(market, pick, odds)
    if market in {"ONE_X_TWO", "FIRST_HALF_WINNER"}:
        return _devig_pinnacle({
            "target": target,
            "home": odds["home"],
            "draw": odds["draw"],
            "away": odds["away"],
        })
    if market == "BTTS":
        return _devig_pinnacle({"target": target, "home": odds["yes"], "away": odds["no"]})
    if market in {"OVER_UNDER", "OVER_UNDER_HT"}:
        return _devig_pinnacle({"target": target, "home": odds["over"], "away": odds["under"]})
    return None


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
    market: str = raw["market"]
    prob_estimated = float(raw["prob_estimated"])
    odds = _pinnacle_odds(raw)
    target_odds = _num(raw.get("odds_bet")) or _target_odds(market, pick, odds)
    p_pinnacle = _pinnacle_prob_for_pick(market, pick, odds)
    poisson = _extract_poisson(features, pick)
    ev = _num(raw.get("ev"))
    if ev is None and target_odds is not None:
        ev = (prob_estimated * target_odds) - 1.0

    return {
        "analyzed_at": raw["analyzed_at"],
        "market": market,
        "pick": pick,
        "canal": raw["canal"],
        "competition_code": raw["competition_code"],
        "league_tier": _league_tier(raw["competition_code"]),
        "odds_segment": _odds_segment(target_odds),
        "odds_bet": target_odds,
        # Model probabilities
        "prob_estimated": prob_estimated,
        "deterministic_score": float(raw["deterministic_score"]),
        "ev": ev,
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
        "pinnacle_home_odds": odds["home"],
        "pinnacle_draw_odds": odds["draw"],
        "pinnacle_away_odds": odds["away"],
        # Target
        "outcome_correct": 1 if raw["outcome_correct"] else 0,
    }


# ── Public API ─────────────────────────────────────────────────────────────────


async def extract_dataset(
    database_url: str,
    segment: str,
    include_backfill: bool = True,
) -> pd.DataFrame:
    """
    Extract and engineer the training dataset from PostgreSQL.

    include_backfill=True  → all records (prod + historical backfill)
    include_backfill=False → prod picks only (isBackfill = false)

    Returns a DataFrame sorted by analyzed_at (temporal order preserved).
    Rows without Pinnacle odds have None in delta_p / p_pinnacle columns.
    """
    logger.info(
        "extracting dataset",
        extra={"segment": segment, "include_backfill": include_backfill},
    )

    # Pass None to skip the isBackfill filter, or a boolean to filter
    backfill_filter: bool | None = None if include_backfill else False

    async with await psycopg.AsyncConnection.connect(
        database_url, connect_timeout=10
    ) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(_BET_SQL, (backfill_filter, backfill_filter))
            bet_rows = await cur.fetchall()
            await cur.execute(_PREDICTION_SQL, (backfill_filter, backfill_filter))
            prediction_rows = await cur.fetchall()

    rows = [*bet_rows, *prediction_rows]
    logger.info(
        "raw rows fetched",
        extra={"bets": len(bet_rows), "predictions": len(prediction_rows), "total": len(rows)},
    )

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
