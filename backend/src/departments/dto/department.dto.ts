import { IsInt, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateDepartmentDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;

  @IsOptional()
  @IsInt()
  headEmployeeId?: number;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}
