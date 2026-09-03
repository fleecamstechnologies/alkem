import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldRep } from './entities/field-rep.entity';
import { PromoItem } from './entities/promo-item.entity';
import { RepStock } from './entities/rep-stock.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { TourPlan } from './entities/tour-plan.entity';
import { TourPlanDay } from './entities/tour-plan-day.entity';
import { CallReport } from './entities/call-report.entity';
import { CallProduct } from './entities/call-product.entity';
import { CallRcpa } from './entities/call-rcpa.entity';
import { CallRx } from './entities/call-rx.entity';
import { FieldScopeService } from './field-scope.service';
import { FieldRepsService } from './field-reps.service';
import { StockService } from './stock.service';
import { TourPlansService } from './tour-plans.service';
import { CallReportsService } from './call-reports.service';
import { FieldController } from './field.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FieldRep,
      PromoItem,
      RepStock,
      StockMovement,
      TourPlan,
      TourPlanDay,
      CallReport,
      CallProduct,
      CallRcpa,
      CallRx,
    ]),
    AuditModule,
  ],
  controllers: [FieldController],
  providers: [
    FieldScopeService,
    FieldRepsService,
    StockService,
    TourPlansService,
    CallReportsService,
  ],
})
export class FieldModule {}
