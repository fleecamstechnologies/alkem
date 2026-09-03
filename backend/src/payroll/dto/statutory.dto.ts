import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DeclarationStatus, TaxRegime } from '../../common/enums/payroll.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FY = /^\d{4}-\d{4}$/;

// ---- statutory config -------------------------------------------------

export class UpdateStatutoryConfigDto {
  @IsOptional() @Matches(FY, { message: 'financialYear must be YYYY-YYYY' })
  financialYear?: string;
  @IsOptional() @Matches(DATE) effectiveFrom?: string;

  @IsOptional() @IsNumberString() pfWageCeiling?: string;
  @IsOptional() @IsNumberString() pfEmployeeRate?: string;
  @IsOptional() @IsNumberString() pfEmployerRate?: string;
  @IsOptional() @IsNumberString() epsRate?: string;
  @IsOptional() @IsNumberString() epsWageCeiling?: string;
  @IsOptional() @IsNumberString() edliRate?: string;
  @IsOptional() @IsNumberString() pfAdminRate?: string;
  @IsOptional() @IsBoolean() pfCapAtCeilingDefault?: boolean;

  @IsOptional() @IsNumberString() esiWageCeiling?: string;
  @IsOptional() @IsNumberString() esiEmployeeRate?: string;
  @IsOptional() @IsNumberString() esiEmployerRate?: string;

  @IsOptional() @IsNumberString() stdDeductionOld?: string;
  @IsOptional() @IsNumberString() stdDeductionNew?: string;
  @IsOptional() @IsNumberString() cessRate?: string;
  @IsOptional() @IsNumberString() rebate87aOldLimit?: string;
  @IsOptional() @IsNumberString() rebate87aNewLimit?: string;
}

// ---- PT slabs -------------------------------------------------

export class CreatePtSlabDto {
  @IsString() @Length(2, 4) stateCode: string;
  @IsString() @Length(1, 60) stateName: string;
  @Matches(DATE, { message: 'effectiveFrom must be YYYY-MM-DD' })
  effectiveFrom: string;
  @IsNumberString() minGross: string;
  @IsOptional() @IsNumberString() maxGross?: string | null;
  @IsNumberString() monthlyAmount: string;
  @IsOptional() @IsNumberString() februaryAmount?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdatePtSlabDto {
  @IsOptional() @IsString() @Length(1, 60) stateName?: string;
  @IsOptional() @Matches(DATE) effectiveFrom?: string;
  @IsOptional() @IsNumberString() minGross?: string;
  @IsOptional() @IsNumberString() maxGross?: string | null;
  @IsOptional() @IsNumberString() monthlyAmount?: string;
  @IsOptional() @IsNumberString() februaryAmount?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ---- income-tax slabs ------------------------------------------

export class ItSlabRowDto {
  @IsNumberString() minAnnual: string;
  @IsOptional() @IsNumberString() maxAnnual?: string | null;
  @IsNumberString() ratePercent: string;
}

export class ReplaceItSlabsDto {
  @IsEnum(TaxRegime) regime: TaxRegime;
  @Matches(FY, { message: 'financialYear must be YYYY-YYYY' })
  financialYear: string;
  @Matches(DATE) effectiveFrom: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItSlabRowDto)
  rows: ItSlabRowDto[];
}

// ---- employee statutory profile ------------------------------

export class UpdateEmployeeStatutoryDto {
  @IsOptional() @IsBoolean() pfApplicable?: boolean;
  @IsOptional() @IsBoolean() pfUsesActualWage?: boolean;
  @IsOptional() @IsBoolean() esiApplicable?: boolean | null;
  @IsOptional() @IsString() @Length(2, 4) ptStateCode?: string;
  @IsOptional() @IsString() @MaxLength(30) uanNumber?: string;
  @IsOptional() @IsString() @MaxLength(40) pfAccountNumber?: string;
  @IsOptional() @IsString() @MaxLength(30) esiIpNumber?: string;
}

// ---- tax declaration -------------------------------------------

export class UpsertTaxDeclarationDto {
  @IsOptional() @IsEnum(TaxRegime) regime?: TaxRegime;
  @IsOptional() @IsNumberString() deduction80C?: string;
  @IsOptional() @IsNumberString() deduction80D?: string;
  @IsOptional() @IsNumberString() deduction80CCD1B?: string;
  @IsOptional() @IsNumberString() hraRentPaid?: string;
  @IsOptional() @IsNumberString() homeLoanInterest?: string;
  @IsOptional() @IsNumberString() otherExemptAllowances?: string;
  @IsOptional() @IsNumberString() otherChapterVIA?: string;
  @IsOptional() @IsBoolean() metroCity?: boolean;
  /** HR only: SUBMITTED or LOCKED. Employees always write DRAFT/SUBMITTED. */
  @IsOptional() @IsIn([DeclarationStatus.SUBMITTED, DeclarationStatus.LOCKED])
  status?: DeclarationStatus;
}
