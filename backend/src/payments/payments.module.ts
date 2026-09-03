import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CustomerPaymentsController } from './customer-payments.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Customer]), AuditModule],
  controllers: [PaymentsController, CustomerPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
