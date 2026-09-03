import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportJobRegistry } from './import-job.registry';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImportJobRegistry],
})
export class ImportsModule {}
