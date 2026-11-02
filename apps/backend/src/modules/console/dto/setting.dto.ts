import { IsDefined, IsIn, IsOptional, IsUUID } from 'class-validator';

/** A setting's new value; its shape is checked by parseAppSetting. */
export class SetSettingDto {
  @IsDefined()
  value!: unknown;
}

/** The journal, optionally one person's actions. */
export class JournalQueryDto {
  @IsOptional()
  @IsUUID()
  actor?: string;

  @IsOptional()
  @IsIn(['settings', 'operations', 'accounts', 'announcements'])
  group?: 'settings' | 'operations' | 'accounts' | 'announcements';
}
