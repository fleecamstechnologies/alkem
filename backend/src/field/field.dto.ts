import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CallKind,
  CallProductAction,
  PromoItemType,
  StockMovementKind,
  TourPlanStatus,
} from '../common/enums/field.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

// ---- reps -----------------------------------------------------------

export class RepProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  hq?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  territory?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AssignDto {
  @IsIn(['DOCTOR', 'CUSTOMER'])
  entityType: 'DOCTOR' | 'CUSTOMER';

  @IsInt()
  entityId: number;

  @IsInt()
  repEmployeeId: number;
}

// ---- promo items ---------------------------------------------------

export class CreatePromoItemDto {
  @IsString()
  @Length(1, 30)
  code: string;

  @IsString()
  @Length(1, 120)
  name: string;

  @IsEnum(PromoItemType)
  type: PromoItemType;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePromoItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ---- stock -------------------------------------------------------

export class StockLineDto {
  @IsInt()
  promoItemId: number;

  @IsNumberString()
  qty: string;
}

export class StockIssueDto {
  @IsInt()
  repEmployeeId: number;

  @IsEnum(StockMovementKind)
  @IsOptional()
  kind?: StockMovementKind;

  @IsOptional()
  @Matches(DATE)
  movementDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  lines: StockLineDto[];
}

// ---- tour plans ------------------------------------------------

export class CreateTourPlanDto {
  @Matches(MONTH, { message: 'periodMonth must be YYYY-MM' })
  periodMonth: string;

  @IsOptional()
  @IsInt()
  repEmployeeId?: number;
}

export class TourPlanDayDto {
  @Matches(DATE, { message: 'planDate must be YYYY-MM-DD' })
  planDate: string;

  @IsString()
  @Length(1, 120)
  area: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedCalls?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class SetTourPlanDaysDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TourPlanDayDto)
  days: TourPlanDayDto[];
}

export class DecideTourPlanDto {
  @IsIn([TourPlanStatus.APPROVED, TourPlanStatus.REJECTED])
  decision: TourPlanStatus.APPROVED | TourPlanStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

// ---- call reports ------------------------------------------

export class CallProductLineDto {
  @IsInt()
  promoItemId: number;

  @IsEnum(CallProductAction)
  action: CallProductAction;

  @IsOptional()
  @IsNumberString()
  qty?: string;

  @IsOptional()
  @IsNumberString()
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class CallRcpaLineDto {
  @IsString()
  @Length(1, 120)
  brand: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  units?: number;

  @IsOptional()
  @IsBoolean()
  isOwn?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remarks?: string;
}

export class CallRxLineDto {
  @IsString()
  @Length(1, 120)
  brand: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rxPerDay?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remarks?: string;
}

export class CreateCallReportDto {
  @IsOptional()
  @IsInt()
  repEmployeeId?: number;

  @Matches(DATE, { message: 'callDate must be YYYY-MM-DD' })
  callDate: string;

  @IsEnum(CallKind)
  kind: CallKind;

  @IsOptional()
  @IsInt()
  doctorId?: number;

  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsBoolean()
  wasPlanned?: boolean;

  @IsOptional()
  @IsInt()
  jointWithEmployeeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallProductLineDto)
  products?: CallProductLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallRcpaLineDto)
  rcpa?: CallRcpaLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallRxLineDto)
  rx?: CallRxLineDto[];
}
