import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryComponent } from './entities/salary-component.entity';
import { EmployeeSalaryStructure } from './entities/employee-salary-structure.entity';
import { SalaryStructureLine } from './entities/salary-structure-line.entity';
import { PayRun } from './entities/pay-run.entity';
import { Payslip } from './entities/payslip.entity';
import { PayslipLine } from './entities/payslip-line.entity';
import { StatutoryConfig } from './entities/statutory-config.entity';
import { PtSlab } from './entities/pt-slab.entity';
import { IncomeTaxSlab } from './entities/income-tax-slab.entity';
import { EmployeeStatutoryProfile } from './entities/employee-statutory-profile.entity';
import { TaxDeclaration } from './entities/tax-declaration.entity';
import { PayslipStatutory } from './entities/payslip-statutory.entity';
import { PayrollService } from './payroll.service';
import { StatutoryConfigService } from './statutory-config.service';
import { EmployeeStatutoryService } from './employee-statutory.service';
import { TaxService } from './tax.service';
import { StatutoryService } from './statutory.service';
import { PayrollController } from './payroll.controller';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalaryComponent,
      EmployeeSalaryStructure,
      SalaryStructureLine,
      PayRun,
      Payslip,
      PayslipLine,
      StatutoryConfig,
      PtSlab,
      IncomeTaxSlab,
      EmployeeStatutoryProfile,
      TaxDeclaration,
      PayslipStatutory,
    ]),
    AuditModule,
    EmployeesModule,
    AttendanceModule,
  ],
  controllers: [PayrollController],
  providers: [
    PayrollService,
    StatutoryConfigService,
    EmployeeStatutoryService,
    TaxService,
    StatutoryService,
  ],
  exports: [PayrollService],
})
export class PayrollModule {}
