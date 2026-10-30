import { describe, it, expect } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PausedGuard } from './paused.guard';
import { ChannelDecisionController } from '@modules/betting-engine/channel-decision.controller';
import { FixtureScoringController } from '@modules/fixture/fixture-scoring.controller';
import { AnalysisSheetController } from '@modules/analysis-sheet/analysis-sheet.controller';
import { TodayController } from '@modules/screens/today.controller';
import { MatchesController } from '@modules/screens/matches.controller';

describe('pause applies to whole suggestion controllers', () => {
  // Une route ajoutée plus tard à ces contrôleurs ne peut pas oublier la
  // pause : le garde est porté par la classe (revue du 2026-10-28).
  it.each([
    ChannelDecisionController,
    FixtureScoringController,
    AnalysisSheetController,
    TodayController,
    MatchesController,
  ])('%o carries PausedGuard at class level', (controller) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) as
      | unknown[]
      | undefined;
    expect(guards).toContain(PausedGuard);
  });
});
