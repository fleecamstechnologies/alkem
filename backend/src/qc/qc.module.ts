import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QcSample } from './entities/qc-sample.entity';
import { QcTest } from './entities/qc-test.entity';
import { QcService } from './qc.service';
import { QcController } from './qc.controller';
import { AuditModule } from '../audit/audit.module';
import { BatchesModule } from '../batches/batches.module';

@Module({
  imports: [TypeOrmModule.forFeature([QcSample, QcTest]), AuditModule, BatchesModule],
  controllers: [QcController],
  providers: [QcService],
  exports: [QcService],
})
export class QcModule {}
