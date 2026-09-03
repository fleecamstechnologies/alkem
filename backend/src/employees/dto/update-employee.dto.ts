import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeDto } from './create-employee.dto';

/** Everything from CreateEmployeeDto except the immutable `code`. */
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['code'] as const),
) {}
