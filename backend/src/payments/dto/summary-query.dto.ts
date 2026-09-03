import { IsIn, IsOptional, Matches } from 'class-validator';

export class SummaryQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy: 'day' | 'month' = 'day';
}
