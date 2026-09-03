import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drug } from './entities/drug.entity';
import { Supplier } from './entities/supplier.entity';
import { DrugBatch } from './entities/drug-batch.entity';
import { PharmacyStockMovement } from './entities/pharmacy-stock-movement.entity';
import { Grn } from './entities/grn.entity';
import { GrnItem } from './entities/grn-item.entity';
import { Dispense } from './entities/dispense.entity';
import { DispenseItem } from './entities/dispense-item.entity';
import { SupplierPayment } from './entities/supplier-payment.entity';
import { DrugsService } from './drugs.service';
import { SuppliersService } from './suppliers.service';
import { StockService } from './stock.service';
import { GrnsService } from './grns.service';
import { DispensesService } from './dispenses.service';
import { PharmacyDashboardService } from './pharmacy-dashboard.service';
import { PharmacyController } from './pharmacy.controller';
import { AuditModule } from '../audit/audit.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Drug,
      Supplier,
      DrugBatch,
      PharmacyStockMovement,
      Grn,
      GrnItem,
      Dispense,
      DispenseItem,
      SupplierPayment,
    ]),
    AuditModule,
    PatientsModule,
  ],
  controllers: [PharmacyController],
  providers: [
    DrugsService,
    SuppliersService,
    StockService,
    GrnsService,
    DispensesService,
    PharmacyDashboardService,
  ],
  exports: [DrugsService, StockService],
})
export class PharmacyModule {}
