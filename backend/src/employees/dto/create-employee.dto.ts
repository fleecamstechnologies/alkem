import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  EmployeeStatus,
  EmploymentType,
  Gender,
} from '../../common/enums/employee.enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateEmployeeDto {
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
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @Matches(DATE, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @Matches(DATE, { message: 'dateOfJoining must be YYYY-MM-DD' })
  dateOfJoining: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateOfLeaving must be YYYY-MM-DD' })
  dateOfLeaving?: string;

  @IsOptional()
  @IsInt()
  reportingManagerId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workLocation?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  panNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  aadhaarNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  pfNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  uanNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  esiNumber?: string;

  @IsOptional()
  @IsNumberString()
  ctcAnnual?: string;
}
