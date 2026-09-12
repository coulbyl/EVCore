import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  ANALYSIS_SHEET_CHANNELS,
  ANALYSIS_SHEET_STATUSES,
} from '../analysis-sheet.constants';
import { TARGET_MARKETS } from '../analysis-sheet-v2.types';

/**
 * Une valeur de query string est une chaîne ou un tableau de chaînes. Tout
 * autre type est un appel malformé : on le réduit à une chaîne vide plutôt que
 * de laisser `String()` produire un "[object Object]" qui passerait la
 * validation.
 */
function stringify(value: unknown): string {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '';
}

/** "a,b,c" → ["a","b","c"]. Une chaîne vide vaut « pas de filtre ». */
function toStringArray({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map((part) => stringify(part));
  return stringify(value)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** "true"/"1" → true. Toute autre valeur explicite → false. */
function toBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = stringify(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
}

const TARGET_MARKET_KEYS = TARGET_MARKETS.map((m) => m.key);

export class AnalysisSheetQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  competitionCode?: string;

  @IsOptional()
  @IsIn(ANALYSIS_SHEET_CHANNELS)
  channel?: (typeof ANALYSIS_SHEET_CHANNELS)[number];

  @IsOptional()
  @IsIn(['txt', 'json'])
  format?: 'txt' | 'json';

  // ── Schéma v2 ──────────────────────────────────────────────────────────────

  /**
   * "2" pour la fiche enrichie. Absent ou "1" → v1 à l'identique, pour que les
   * scripts existants ne changent pas de comportement sans le demander.
   */
  @IsOptional()
  @IsIn(['1', '2'])
  schemaVersion?: '1' | '2';

  /** Statuts conservés, ex. `status=SCHEDULED`. Par défaut : tous. */
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsIn(ANALYSIS_SHEET_STATUSES, { each: true })
  status?: string[];

  /** Marchés conservés dans les picks, ex. `markets=ONE_X_TWO,BTTS`. */
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  markets?: string[];

  /** Canaux retirés, ex. `excludeChannels=CORRECT_SCORE`. */
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  excludeChannels?: string[];

  /** Retire `history` et les picks évalués hors marchés cibles (~83 % du volume). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  compact?: boolean;

  /** Bloc `context` — coûteux, coupé automatiquement au-delà de 7 jours. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeContext?: boolean;

  /** Bloc `calibration` — parcourt tout l'historique réglé (~8 s). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeCalibration?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeLegPool?: boolean;

  // ── Filtres du legPool ─────────────────────────────────────────────────────

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  @Min(1)
  legPoolMinOdds?: number;

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsIn(TARGET_MARKET_KEYS, { each: true })
  legPoolMarkets?: string[];

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  legPoolMinCoverage?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  legPoolExcludeFlags?: boolean;

  @IsOptional()
  @IsIn(ANALYSIS_SHEET_STATUSES)
  legPoolStatus?: string;
}
