import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { Holiday } from './entities/holiday.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { OfficeLocation } from './entities/office-location.entity';
import { AttendanceEvent } from './entities/attendance-event.entity';
import { AttendanceRegularization } from './entities/attendance-regularization.entity';
import { AppSettings } from './entities/app-settings.entity';
import { AttendanceService } from './attendance.service';
import { LeaveService } from './leave.service';
import { OfficeLocationsService } from './office-locations.service';
import { SettingsService } from './settings.service';
import { PunchService } from './punch.service';
import { RegularizationService } from './regularization.service';
import { AttendanceController } from './attendance.controller';
import { LeaveController } from './leave.controller';
import { EmployeeHrController } from './employee-hr.controller';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceRecord,
      Holiday,
      LeaveType,
      LeaveBalance,
      LeaveRequest,
      OfficeLocation,
      AttendanceEvent,
      AttendanceRegularization,
      AppSettings,
    ]),
    AuditModule,
    EmployeesModule,
  ],
  controllers: [AttendanceController, LeaveController, EmployeeHrController],
  providers: [
    AttendanceService,
    LeaveService,
    OfficeLocationsService,
    SettingsService,
    PunchService,
    RegularizationService,
  ],
  exports: [
    AttendanceService,
    LeaveService,
    OfficeLocationsService,
    SettingsService,
    PunchService,
    RegularizationService,
  ],
})
export class AttendanceModule {}
