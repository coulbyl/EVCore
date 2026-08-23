import { IsDateString, IsOptional } from 'class-validator';

export class CouponQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  /**
   * Dernier jour (inclus) d'une fenêtre de matchs multi-jours — p. ex. `date`
   * vendredi et `to` dimanche. Par défaut `date` (un seul jour). Seul le
   * vivier de matchs s'élargit ; `forDate` reste calé sur `date`.
   */
  @IsOptional()
  @IsDateString()
  to?: string;
}
