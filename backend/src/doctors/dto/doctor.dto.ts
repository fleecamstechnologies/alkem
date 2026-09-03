import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { PaginationQuery } from '../../common/dto/pagination';
import { DoctorStatus } from '../entities/doctor.entity';

export class CreateDoctorDto {
  @IsString()
  @Length(1, 40)
  code: string;

  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  speciality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  registrationNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  qualification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hospitalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  territory?: string;

  @IsOptional()
  @IsInt()
  linkedCustomerId?: number;

  @IsOptional()
  @IsEnum(DoctorStatus)
  status?: DoctorStatus;
}

export class UpdateDoctorDto extends PartialType(
  OmitType(CreateDoctorDto, ['code'] as const),
) {}

export class QueryDoctorsDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  speciality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  territory?: string;

  @IsOptional()
  @IsEnum(DoctorStatus)
  status?: DoctorStatus;
}
