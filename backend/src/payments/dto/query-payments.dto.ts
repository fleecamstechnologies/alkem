import { IsEnum, IsInt, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import {
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
} from '../../common/enums/payment.enum';
import { PaginationQuery } from '../../common/dto/pagination';

export class QueryPaymentsDto extends PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsEnum(PaymentKind)
  kind?: PaymentKind;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
