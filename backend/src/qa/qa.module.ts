import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QaReview } from './entities/qa-review.entity';
import { Deviation } from './entities/deviation.entity';
import { QaService } from './qa.service';
import { QaController } from './qa.controller';
import { AuditModule } from '../audit/audit.module';
import { BatchesModule } from '../batches/batches.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QaReview, Deviation]),
    AuditModule,
    BatchesModule,
  ],
  controllers: [QaController],
  providers: [QaService],
  exports: [QaService],
})
export class QaModule {}
