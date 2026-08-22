import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import {
  INVESTMENT_CHANNELS,
  INVESTMENT_VIEWS,
  type InvestmentView,
} from '../investment.constants';
import type { StrategyChannel } from '@modules/betting-engine/channel-strategy.types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class InvestmentQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  competitionCode?: string;

  // "assumed" (défaut) : les canaux à ROI shrinké positif, la surface de mise.
  // "watch" : tout le reste, filtrable par canal.
  // "excluded" : ce que les garde-fous ont retiré, avec la raison.
  @IsOptional()
  @IsIn([...INVESTMENT_VIEWS])
  view?: InvestmentView;

  // Colonne filtrable des vues "watch" et "excluded" — jamais un onglet, et
  // sans effet sur "assumed", qui est définie par la mesure et pas par un
  // choix d'affichage.
  @IsOptional()
  @IsIn([...INVESTMENT_CHANNELS])
  channel?: StrategyChannel;
}
