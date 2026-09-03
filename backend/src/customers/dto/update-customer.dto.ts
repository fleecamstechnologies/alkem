import { PartialType } from '@nestjs/mapped-types';
import { OmitType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';

/** Everything from CreateCustomerDto except the immutable business key `code`. */
export class UpdateCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, ['code'] as const),
) {}
