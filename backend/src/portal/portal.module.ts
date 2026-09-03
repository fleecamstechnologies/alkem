import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { EmployeesModule } from '../employees/employees.module';
import { PayrollModule } from '../payroll/payroll.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [EmployeesModule, PayrollModule, AttendanceModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
