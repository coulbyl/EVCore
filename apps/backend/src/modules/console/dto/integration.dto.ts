import { IsString, MaxLength, MinLength } from 'class-validator';

/** A field's new value; its key comes from the route. */
export class SetIntegrationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  value!: string;
}
