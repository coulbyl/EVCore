import { ApiProperty } from '@nestjs/swagger';

export class EtlErrorResponseDto {
  @ApiProperty({
    example: 'Unsupported league-scoped ETL sync type: odds-csv',
  })
  message!: string;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: 400 })
  statusCode!: number;
}
