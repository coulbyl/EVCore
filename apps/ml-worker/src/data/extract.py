"""Dataset extraction for the ML correction layer.

Joins ModelRun x ChannelSelection x Fixture x Competition x OddsSnapshot and
returns a feature-engineered DataFrame ready for model training.
Each row is one settled selection (WON/LOST).
"""

from __future__ import annotations

import logging
import math
from typing import Any

import pandas as pd
import psycopg
import psycopg.rows

logger = logging.getLogger(__name__)

ENGINE_CONFIG_VERSION = "betting-engine-2026-09-14.1"

# ── SQL ────────────────────────────────────────────────────────────────────────

# One JSON object per (fixture, market), e.g. {"HOME": 1.9, "DRAW": 3.5,
# "AWAY": 4.2} or {"OVER_1_5": 1.5, "UNDER_1_5": 2.6}. Prefers Pinnacle (the
# "sharp" reference used across the codebase) but falls back to Bet365 when
# Pinnacle has no coverage at all for that market (CLEAN_SHEET/WIN_EITHER_HALF,
# 2026-07-24 — see docs/ml-worker-sync.md). Generic pick-keyed map instead of
# fixed named columns (old homeOdds/yesOdds/overOdds/... columns) so any
# market's arbitrary pick strings (TEAM_TOTAL's "OVER_1_5", etc.) work without
# a new column per market family.
#
# ONE_X_TWO is a special case: every Pinnacle/Bet365 row for that market has
# `pick IS NULL` (confirmed live 2026-07-24, 64928/64928 rows) — the 1X2 price
# lives in the dedicated homeOdds/drawOdds/awayOdds columns instead, never in
# pick/odds. `jsonb_object_agg` hard-errors ("null value not allowed for
# object key") the moment it aggregates a NULL key, which is what took down
# training for every segment (ONE_X_TWO is shared by VALUE/DOMINANT/DRAW/SAFE)
# after the picks_odds rewrite — `pick IS NOT NULL` below is the fix. The
# home/draw/away MAX(...) columns restore the 1X2 price from its real column
# (merged into the same picks_odds dict, keyed HOME/DRAW/AWAY, in Python).
_ODDS_LATERAL_SQL = """
LEFT JOIN LATERAL (
    SELECT
        jsonb_object_agg(pick, odds) FILTER (WHERE pick IS NOT NULL) AS picks_odds,
        MAX("homeOdds") AS home_odds,
        MAX("drawOdds") AS draw_odds,
        MAX("awayOdds") AS away_odds
    FROM (
        SELECT DISTINCT ON (COALESCE(pick, '__1x2__'))
            pick,
            odds,
            "homeOdds",
            "drawOdds",
            "awayOdds"
        FROM odds_snapshot
        WHERE "fixtureId" = f.id
          AND bookmaker IN ('Pinnacle', 'Bet365')
          AND market = cs.market
          AND "snapshotAt" < mr."analyzedAt"
          AND "createdAt" < mr."analyzedAt"
        ORDER BY COALESCE(pick, '__1x2__'), (bookmaker = 'Pinnacle') DESC, "snapshotAt" DESC
    ) latest
) os ON TRUE
"""

# Settlement lives on `channel_selection.result` for every canal — most
# canals never materialise a `bet` row at all (they aren't individually
# staked), so `bet` cannot be the source table. `cs.channel` doesn't exist
# either: it moved to `channel_decision.channel` in migration
# `20260617000232` (17 juin 2026) — see docs/ml-worker-sync.md.
# CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF added 2026-07-24 (real settled
# volume + Pinnacle/Bet365 odds coverage confirmed). CORRECT_SCORE excluded:
# a correct-score market has ~50 competing scorelines per fixture, so
# de-vigging it needs different logic than the two/three-way markets below —
# deferred, not a copy-paste extension.
_BET_SQL = f"""
SELECT
    f.id AS fixture_id,
    f."scheduledAt" AS scheduled_at,
    cd."configVersion" AS config_version,
    mr."analyzedAt"                 AS analyzed_at,
    mr."deterministicScore"         AS deterministic_score,
    mr.features                     AS features,
    cs.market::text                 AS market,
    cs.pick,
    cd.channel::text                AS canal,
    cs.probability                  AS prob_estimated,
    cs.odds                         AS odds_bet,
    cs.ev,
    (cs.result = 'WON')             AS outcome_correct,
    c.code                          AS competition_code,
    os.picks_odds                   AS picks_odds,
    os.home_odds                    AS home_odds,
    os.draw_odds                    AS draw_odds,
    os.away_odds                    AS away_odds
FROM channel_selection cs
JOIN channel_decision cd ON cd.id     = cs."channelDecisionId"
JOIN model_run mr         ON mr.id    = cd."modelRunId"
JOIN fixture f     ON f.id            = mr."fixtureId"
JOIN season s      ON s.id            = f."seasonId"
JOIN competition c ON c.id            = s."competitionId"
{_ODDS_LATERAL_SQL}
WHERE cs.result IN ('WON', 'LOST')
  AND f.status = 'FINISHED' AND cs.rank = 1 AND cd.status = 'SELECTED'
  AND mr."analyzedAt" < f."scheduledAt" AND mr."createdAt" < f."scheduledAt"
  AND cd."createdAt" < f."scheduledAt" AND cs."createdAt" < f."scheduledAt"
  AND NOT EXISTS (
    SELECT 1 FROM channel_decision newer
    JOIN model_run nr ON nr.id = newer."modelRunId"
    WHERE nr."fixtureId" = f.id AND newer.channel = cd.channel
      AND nr."analyzedAt" < f."scheduledAt" AND nr."createdAt" < f."scheduledAt"
      AND newer."createdAt" < f."scheduledAt"
      AND (nr."analyzedAt", newer."createdAt", newer.id) > (mr."analyzedAt", cd."createdAt", cd.id)
  )
  AND cd.channel IN ('VALUE', 'SAFE', 'DOMINANT', 'BTTS', 'DRAW', 'GOALS',
                      'CLEAN_SHEET', 'TEAM_TOTAL', 'WIN_EITHER_HALF')
  AND cd."configVersion" = '{ENGINE_CONFIG_VERSION}'
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


# The set of pick strings competing against each other for a given market —
# i.e. what to de-vig against. Two/three-way markets only; unknown markets
# (e.g. CORRECT_SCORE, not handled here) return [].
def _complement_picks(market: str, pick: str) -> list[str]:
    if market in {"ONE_X_TWO", "FIRST_HALF_WINNER"}:
        return ["HOME", "DRAW", "AWAY"]
    if market in {
        "BTTS",
        "CLEAN_SHEET_HOME",
        "CLEAN_SHEET_AWAY",
        "WIN_TO_NIL_HOME",
        "WIN_TO_NIL_AWAY",
    }:
        return ["YES", "NO"]
    if market == "TO_WIN_EITHER_HALF":
        return []  # Either team can win a half; these are not complements.
    if market in {"OVER_UNDER", "OVER_UNDER_HT", "TEAM_TOTAL_HOME", "TEAM_TOTAL_AWAY"}:
        if pick in {"OVER", "UNDER"}:
            return ["OVER", "UNDER"]
        if pick.startswith("OVER_"):
            return [pick, "UNDER_" + pick[len("OVER_") :]]
        if pick.startswith("UNDER_"):
            return ["OVER_" + pick[len("UNDER_") :], pick]
        return []
    return []


def _devig_pick(market: str, pick: str, picks_odds: dict[str, float]) -> float | None:
    """Require a complete, exclusive partition with valid prices."""
    group = _complement_picks(market, pick)
    if len(group) < 2 or pick not in group:
        return None
    available = [picks_odds.get(p) for p in group]
    if any(o is None or not math.isfinite(o) or o <= 1 for o in available):
        return None
    overround = sum(1.0 / o for o in available)
    return (1.0 / picks_odds[pick]) / overround


def _num(value: Any) -> float | None:
    return float(value) if value is not None else None


def _extract_poisson(
    features: dict[str, Any], market: str, pick: str
) -> dict[str, float | None]:
    probs = features.get("probabilities") or {}
    p_home = probs.get("home")
    p_draw = probs.get("draw")
    p_away = probs.get("away")

    if market in {"ONE_X_TWO", "FIRST_HALF_WINNER"}:
        p_pick = {"HOME": p_home, "DRAW": p_draw, "AWAY": p_away}.get(pick)
    elif market == "BTTS":
        p_pick = {"YES": probs.get("bttsYes"), "NO": probs.get("bttsNo")}.get(pick)
    elif market in {"OVER_UNDER", "OVER_UNDER_HT"}:
        # Only the 2.5 line has a dedicated Poisson field on ModelRun.features —
        # other GOALS lines (1.5/3.5/4.5) fall through to None, same limitation
        # as before this change (not something introduced here).
        p_pick = {"OVER": probs.get("over25"), "UNDER": probs.get("under25")}.get(pick)
    elif market == "CLEAN_SHEET_HOME":
        base = probs.get("cleanSheetHome")
        p_pick = base if pick == "YES" else (1 - base if base is not None else None)
    elif market == "CLEAN_SHEET_AWAY":
        base = probs.get("cleanSheetAway")
        p_pick = base if pick == "YES" else (1 - base if base is not None else None)
    elif market == "TO_WIN_EITHER_HALF":
        p_pick = {
            "HOME": probs.get("winEitherHalfHome"),
            "AWAY": probs.get("winEitherHalfAway"),
        }.get(pick)
    elif market == "TEAM_TOTAL_HOME":
        p_pick = (probs.get("teamTotalHome") or {}).get(pick)
    elif market == "TEAM_TOTAL_AWAY":
        p_pick = (probs.get("teamTotalAway") or {}).get(pick)
    else:
        p_pick = None

    return {
        "p_poisson_home": p_home,
        "p_poisson_draw": p_draw,
        "p_poisson_away": p_away,
        "p_poisson_pick": p_pick,
    }


def _build_row(raw: dict[str, Any]) -> dict[str, Any]:
    features: dict[str, Any] = raw["features"] or {}
    pick: str = raw["pick"]
    market: str = raw["market"]
    prob_estimated = float(raw["prob_estimated"])
    picks_odds: dict[str, float] = dict(raw.get("picks_odds") or {})
    # ONE_X_TWO's price lives in the dedicated homeOdds/drawOdds/awayOdds
    # columns, not pick/odds (see _ODDS_LATERAL_SQL) — merge it into the same
    # generic map so devig/target-odds lookups don't need a market special case.
    for key, raw_key in (("HOME", "home_odds"), ("DRAW", "draw_odds"), ("AWAY", "away_odds")):
        value = _num(raw.get(raw_key))
        if value is not None:
            picks_odds.setdefault(key, value)
    target_odds = _num(raw.get("odds_bet")) or _num(picks_odds.get(pick))
    p_pinnacle = _devig_pick(market, pick, picks_odds)
    poisson = _extract_poisson(features, market, pick)
    ev = _num(raw.get("ev"))
    if ev is None and target_odds is not None:
        ev = (prob_estimated * target_odds) - 1.0

    return {
        "fixture_id": raw.get("fixture_id"),
        "scheduled_at": raw.get("scheduled_at"),
        "config_version": raw.get("config_version"),
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
        # Pinnacle/Bet365 comparison (None when neither has a price)
        "p_pinnacle": p_pinnacle,
        "delta_p": (prob_estimated - p_pinnacle) if p_pinnacle else None,
        "pinnacle_home_odds": _num(picks_odds.get("HOME")),
        "pinnacle_draw_odds": _num(picks_odds.get("DRAW")),
        "pinnacle_away_odds": _num(picks_odds.get("AWAY")),
        # Target
        "outcome_correct": 1 if raw["outcome_correct"] else 0,
    }


# ── Public API ─────────────────────────────────────────────────────────────────


async def extract_dataset(
    database_url: str,
    segment: str,
) -> pd.DataFrame:
    """
    Extract and engineer the training dataset from PostgreSQL.

    Returns a DataFrame sorted by scheduled_at and fixture identity.
    Rows without Pinnacle/Bet365 odds have None in delta_p / p_pinnacle columns.
    """
    logger.info(
        "extracting dataset",
        extra={"segment": segment},
    )

    async with await psycopg.AsyncConnection.connect(
        database_url, connect_timeout=10
    ) as conn:
        async with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            await cur.execute(_BET_SQL)
            bet_rows = await cur.fetchall()

    rows = [*bet_rows]
    logger.info(
        "raw rows fetched",
        extra={"bets": len(bet_rows), "total": len(rows)},
    )

    records = [_build_row(dict(row)) for row in rows]
    df = pd.DataFrame(records)

    if df.empty:
        return df
    df = _apply_segment_filter(df, segment)
    if df.empty:
        return df
    df = df.sort_values(["scheduled_at", "fixture_id"]).reset_index(drop=True)

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
    if not 0 < train_ratio < 1:
        raise ValueError("train_ratio must be between zero and one")
    if df.empty:
        return df.copy(), df.copy()
    if "fixture_id" not in df or "scheduled_at" not in df or df["fixture_id"].isna().any():
        raise ValueError("Fixture identity and kickoff are required for temporal splitting")
    dates = sorted(df["scheduled_at"].dropna().unique())
    if len(dates) < 2:
        raise ValueError("At least two event timestamps are required")
    cutoff = dates[max(1, min(len(dates) - 1, int(len(dates) * train_ratio)))]
    before = df[df["scheduled_at"] < cutoff].copy()
    after = df[df["scheduled_at"] >= cutoff].copy()
    if set(before["fixture_id"]) & set(after["fixture_id"]):
        raise ValueError("A fixture crosses temporal partitions")
    return before, after
