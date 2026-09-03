import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { LeaveRequestStatus } from '../common/enums/attendance.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class PortalLeaveRequestDto {
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

export class PortalDecideDto {
  @IsEnum(LeaveRequestStatus)
  decision: LeaveRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

/** Fields an employee may edit about themselves. Everything else is HR-owned. */
export class PortalProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankIfsc?: string;
}
