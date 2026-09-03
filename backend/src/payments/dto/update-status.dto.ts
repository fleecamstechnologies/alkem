import { IsEnum } from 'class-validator';
import { PaymentStatus } from '../../common/enums/payment.enum';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  status: PaymentStatus;
}
