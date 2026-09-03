import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CalculationType,
  ComponentType,
} from '../../common/enums/payroll.enum';

export class CreateComponentDto {
  @IsString()
  @Length(1, 30)
  code: string;

  @IsString()
  @Length(1, 80)
  name: string;

  @IsEnum(ComponentType)
  type: ComponentType;

  @IsEnum(CalculationType)
  calculationType: CalculationType;

  @IsOptional()
  @IsNumberString()
  defaultValue?: string;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateComponentDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsNumberString()
  defaultValue?: string;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class StructureLineDto {
  @IsInt()
  componentId: number;

  @IsEnum(CalculationType)
  calculationType: CalculationType;

  @IsNumberString()
  value: string;
}

export class AssignStructureDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveFrom must be YYYY-MM-DD' })
  effectiveFrom: string;

  @IsNumberString()
  basicMonthly: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructureLineDto)
  lines: StructureLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class CreatePayRunDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'periodMonth must be YYYY-MM' })
  periodMonth: string;
}
