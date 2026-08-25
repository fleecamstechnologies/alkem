import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DeviationSeverity } from '../../common/enums/qa.enum';

export class CreateDeviationDto {
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsString()
  department: string;

  @IsString()
  description: string;

  @IsEnum(DeviationSeverity)
  severity: DeviationSeverity;
}
