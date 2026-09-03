import {
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
} from '../../common/enums/payment.enum';

export class CreatePaymentDto {
  @IsInt()
  customerId: number;

  @IsEnum(PaymentKind)
  kind: PaymentKind;

  /** Decimal string, e.g. "1250.00". Negative only allowed for ADJUSTMENT. */
  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  referenceNo?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'paymentDate must be YYYY-MM-DD' })
  paymentDate: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
