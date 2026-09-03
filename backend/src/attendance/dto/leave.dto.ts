import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeaveRequestStatus } from '../../common/enums/attendance.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLeaveTypeDto {
  @IsString()
  @Length(1, 20)
  code: string;

  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsNumberString()
  annualQuota?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsNumberString()
  annualQuota?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateLeaveRequestDto {
  @IsInt()
  employeeId: number;

  @IsInt()
  leaveTypeId: number;

  @Matches(DATE, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate: string;

  @Matches(DATE, { message: 'toDate must be YYYY-MM-DD' })
  toDate: string;

  @IsOptional()
  @IsBoolean()
  halfDay?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class DecideLeaveDto {
  @IsEnum(LeaveRequestStatus)
  decision: LeaveRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class QueryLeaveRequestsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

export class GrantQuotaDto {
  @Type(() => Number)
  @IsInt()
  year: number;
}
