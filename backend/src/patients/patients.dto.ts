import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
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
import { PaginationQuery } from '../common/dto/pagination';
import {
  AppointmentStatus,
  AppointmentType,
  ChargeKind,
  ChargeMethod,
  ChargeStatus,
  Gender,
  LabFlag,
  LabStatus,
  PatientStatus,
  ServiceKind,
  VisitType,
} from '../common/enums/patient.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

// ---- patients ----------------------------------------------------

export class CreatePatientDto {
  @IsString()
  @Length(1, 40)
  code: string;

  @IsString()
  @Length(1, 100)
  firstName: string;

  @IsString()
  @Length(1, 100)
  lastName: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @Matches(DATE, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  altPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

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
  @MaxLength(12)
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyPhone?: string;

  @IsOptional()
  @IsInt()
  assignedDoctorId?: number;

  @IsOptional()
  @Matches(DATE, { message: 'registrationDate must be YYYY-MM-DD' })
  registrationDate?: string;

  @IsOptional()
  @IsEnum(PatientStatus)
  status?: PatientStatus;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  chronicConditions?: string;
}

export class UpdatePatientDto {
  @IsOptional() @IsString() @Length(1, 100) firstName?: string;
  @IsOptional() @IsString() @Length(1, 100) lastName?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @Matches(DATE) dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(20) altPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(5) bloodGroup?: string;
  @IsOptional() @IsString() @MaxLength(20) maritalStatus?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @IsString() @MaxLength(12) pincode?: string;
  @IsOptional() @IsString() @MaxLength(120) emergencyName?: string;
  @IsOptional() @IsString() @MaxLength(20) emergencyPhone?: string;
  @IsOptional() @IsInt() assignedDoctorId?: number;
  @IsOptional() @IsEnum(PatientStatus) status?: PatientStatus;
  @IsOptional() @IsString() allergies?: string;
  @IsOptional() @IsString() chronicConditions?: string;
}

export class QueryPatientsDto extends PaginationQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() assignedDoctorId?: number;
  @IsOptional() @IsEnum(PatientStatus) status?: PatientStatus;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
}

// ---- appointments -------------------------------------------

export class BookAppointmentDto {
  @IsInt() patientId: number;
  @IsInt() doctorId: number;

  @Matches(DATETIME, { message: 'scheduledAt must be YYYY-MM-DD HH:mm' })
  scheduledAt: string;

  @IsOptional() @Type(() => Number) @IsInt() durationMin?: number;
  @IsOptional() @IsEnum(AppointmentType) type?: AppointmentType;
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
  @IsOptional() @IsString() @MaxLength(80) department?: string;
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus) status: AppointmentStatus;
  @IsOptional() @IsString() @MaxLength(255) cancelReason?: string;
}

export class QueryAppointmentsDto extends PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() doctorId?: number;
  @IsOptional() @Type(() => Number) @IsInt() patientId?: number;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
  @IsOptional() @IsString() mine?: string;
}

// ---- visits / prescriptions / labs -------------------------

export class PrescriptionItemDto {
  @IsString() @Length(1, 160) drugName: string;
  @IsOptional() @IsString() @MaxLength(60) strength?: string;
  @IsOptional() @IsString() @MaxLength(60) dosage?: string;
  @IsOptional() @IsString() @MaxLength(30) route?: string;
  @IsOptional() @IsString() @MaxLength(60) frequency?: string;
  @IsOptional() @Type(() => Number) @IsInt() durationDays?: number;
  @IsOptional() @IsString() @MaxLength(40) quantity?: string;
  @IsOptional() @IsString() @MaxLength(255) instructions?: string;
}

export class LabLineDto {
  @IsString() @Length(1, 160) testName: string;
  @IsOptional() @IsString() @MaxLength(255) notes?: string;
}

export class CreateVisitDto {
  @IsInt() patientId: number;
  @IsInt() doctorId: number;

  @IsOptional() @IsInt() appointmentId?: number;
  @IsOptional() @Matches(DATETIME) visitDate?: string;
  @IsOptional() @IsEnum(VisitType) visitType?: VisitType;
  @IsOptional() @IsString() @MaxLength(500) chiefComplaint?: string;
  @IsOptional() @Type(() => Number) @IsInt() bpSystolic?: number;
  @IsOptional() @Type(() => Number) @IsInt() bpDiastolic?: number;
  @IsOptional() @Type(() => Number) @IsInt() pulse?: number;
  @IsOptional() @IsNumberString() temperature?: string;
  @IsOptional() @IsNumberString() weightKg?: string;
  @IsOptional() @IsNumberString() heightCm?: string;
  @IsOptional() @Type(() => Number) @IsInt() spo2?: number;
  @IsOptional() @IsNumberString() bmi?: string;
  @IsOptional() @IsString() diagnosis?: string;
  @IsOptional() @IsString() @MaxLength(255) icdCodes?: string;
  @IsOptional() @IsString() clinicalNotes?: string;
  @IsOptional() @Matches(DATE) followUpDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  prescriptionNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  medicines?: PrescriptionItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabLineDto)
  labs?: LabLineDto[];
}

export class AddPrescriptionDto {
  @IsOptional() @IsString() @MaxLength(500) notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  medicines: PrescriptionItemDto[];
}

export class OrderLabDto {
  @IsInt() patientId: number;
  @IsOptional() @IsInt() visitId?: number;
  @IsString() @Length(1, 160) testName: string;
  @IsOptional() @IsString() @MaxLength(255) notes?: string;
}

export class LabResultDto {
  @IsString() @MaxLength(120) resultValue: string;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @IsString() @MaxLength(60) refRange?: string;
  @IsOptional() @IsEnum(LabFlag) flag?: LabFlag;
  @IsOptional() @IsEnum(LabStatus) status?: LabStatus;
  @IsOptional() @IsString() @MaxLength(255) notes?: string;
}

export class CompleteAppointmentDto {
  @IsOptional() @IsBoolean() createVisit?: boolean;
  @IsOptional() @IsString() @MaxLength(500) chiefComplaint?: string;
  @IsOptional() @IsString() diagnosis?: string;
  @IsOptional() @IsString() clinicalNotes?: string;
}

// ---- billing --------------------------------------------

export class CreateChargeDto {
  @IsEnum(ChargeKind) kind: ChargeKind;

  @IsNumberString() amount: string;

  @IsOptional() @IsEnum(ChargeMethod) method?: ChargeMethod;
  @IsOptional() @IsString() @MaxLength(60) reference?: string;

  @Matches(DATE, { message: 'chargeDate must be YYYY-MM-DD' })
  chargeDate: string;

  @IsOptional() @IsEnum(ServiceKind) serviceKind?: ServiceKind;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsOptional() @IsInt() visitId?: number;
  @IsOptional() @IsEnum(ChargeStatus) status?: ChargeStatus;
}

export class UpdateChargeStatusDto {
  @IsEnum(ChargeStatus) status: ChargeStatus;
}

export class StatementQueryDto {
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' }) from: string;
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' }) to: string;
}
