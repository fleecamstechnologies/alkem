import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { LeaveRequestStatus, PunchType } from '../../common/enums/attendance.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

// ---- offices -------------------------------------------------------

export class CreateOfficeDto {
  @IsString() @MaxLength(40) code: string;
  @IsString() @MaxLength(150) name: string;
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) radiusMeters?: number;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateOfficeDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) radiusMeters?: number;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ---- settings -----------------------------------------------------

export class UpdateAttendanceSettingsDto {
  @IsOptional() @IsNumber() punchHalfDayHours?: number;
  @IsOptional() @IsNumber() punchFullDayHours?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) defaultGeofenceMeters?: number;
}

// ---- punch -------------------------------------------------------

export class PunchDto {
  @IsEnum(PunchType) type: PunchType;
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
  @IsOptional() @Type(() => Number) @IsInt() accuracyM?: number;
  @Matches(DATE, { message: 'localDate must be YYYY-MM-DD' }) localDate: string;
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}

export class PunchStatusQueryDto {
  @IsOptional() @Matches(DATE) date?: string;
}

// ---- regularization -------------------------------------------

export class CreateRegularizationDto {
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) date: string;
  @Matches(DATETIME, { message: 'inAt must be YYYY-MM-DD HH:mm' }) inAt: string;
  @Matches(DATETIME, { message: 'outAt must be YYYY-MM-DD HH:mm' }) outAt: string;
  @IsString() @MaxLength(500) reason: string;
}

export class DecideRegularizationDto {
  @IsIn([
    LeaveRequestStatus.APPROVED,
    LeaveRequestStatus.REJECTED,
    LeaveRequestStatus.CANCELLED,
  ])
  decision: LeaveRequestStatus;

  @IsOptional() @IsString() @MaxLength(255) note?: string;
}

export class QueryRegularizationsDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() employeeId?: number;
}

export class QueryPunchEventsDto {
  @IsOptional() @Type(() => Number) @IsInt() employeeId?: number;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
}
