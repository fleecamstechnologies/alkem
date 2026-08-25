import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class RecordResultDto {
  @IsOptional()
  @IsNumber()
  actualResultValue?: number;

  @IsOptional()
  @IsString()
  actualResultText?: string;

  @IsOptional()
  @IsBoolean()
  manualPass?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}
