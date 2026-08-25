import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { QcTestName } from '../../common/enums/qc.enum';

export class AddTestDto {
  @IsUUID()
  sampleId: string;

  @IsEnum(QcTestName)
  testName: QcTestName;

  @IsString()
  specificationText: string;

  @IsOptional()
  @IsNumber()
  specMin?: number;

  @IsOptional()
  @IsNumber()
  specMax?: number;
}
