import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { Batch } from '../batches/entities/batch.entity';
import { QcSample } from '../qc/entities/qc-sample.entity';
import { Deviation } from '../qa/entities/deviation.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Batch, QcSample, Deviation])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
