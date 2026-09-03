import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  department?: string;

  /** Link this login to an employee record (self-service portal). */
  @IsOptional()
  @IsInt()
  employeeId?: number;

  /** Link this login to a doctor record (clinician view). */
  @IsOptional()
  @IsInt()
  doctorId?: number;
}

export class LinkEmployeeDto {
  @IsInt()
  employeeId: number;
}

export class LinkDoctorDto {
  @IsInt()
  doctorId: number;
}
