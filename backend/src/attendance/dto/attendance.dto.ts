import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '../../common/enums/attendance.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export class MarkAttendanceDto {
  @IsInt()
  employeeId: number;

  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsInt()
  leaveTypeId?: number;

  @IsOptional()
  @IsString()
  workedHours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class QueryAttendanceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;
}

export class AttendanceSummaryDto {
  @Matches(MONTH, { message: 'periodMonth must be YYYY-MM' })
  periodMonth: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;
}
