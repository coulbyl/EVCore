import type { SelectionConfig } from '@evcore/analysis-core';
import {
  getLeagueEvThreshold,
  getValueMinEdge,
  getPickDirectionProbabilityThreshold,
  getPickEvFloor,
  getPickEvSoftCap,
  getPickMaxSelectionOdds,
  getPickMinSelectionOdds,
  getSvMinOdds,
  getSvMinProbability,
  isHtftCalibrated,
} from '../ev.constants';

// Bind the app's league/market tuning tables (ev.constants) to a single
// competition, producing the plain SelectionConfig the pure core consumes.
// This is the one place that knows about competitionCode-driven overrides.
export function buildSelectionConfig(
  competitionCode: string | null = null,
): SelectionConfig {
  return {
    leagueEvThreshold: getLeagueEvThreshold(competitionCode),
    valueMinEdge: getValueMinEdge(competitionCode),
    svMinProbability: getSvMinProbability(competitionCode),
    svMinOdds: getSvMinOdds(competitionCode),
    htftCalibrated: isHtftCalibrated(competitionCode),
    pickDirectionProbabilityThreshold: (market, pick) =>
      getPickDirectionProbabilityThreshold(competitionCode, market, pick),
    pickEvFloor: (market, pick, leagueFloor) =>
      getPickEvFloor(competitionCode, market, pick, leagueFloor),
    pickEvSoftCap: (market, pick) =>
      getPickEvSoftCap(competitionCode, market, pick),
    pickMinSelectionOdds: (market, pick) =>
      getPickMinSelectionOdds(competitionCode, market, pick),
    pickMaxSelectionOdds: (market, pick) =>
      getPickMaxSelectionOdds(competitionCode, market, pick),
  };
}
