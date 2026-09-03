import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { HR_READ_ROLES } from '../common/enums/user-role.enum';

/** Attendance / leave views scoped to one employee. */
@Controller('employees/:employeeId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeHrController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly leaveService: LeaveService,
  ) {}

  @Get('attendance')
  @Roles(...HR_READ_ROLES)
  monthGrid(
    @Param('employeeId') employeeId: string,
    @Query('periodMonth') periodMonth: string,
  ) {
    const month =
      periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)
        ? periodMonth
        : new Date().toISOString().slice(0, 7);
    return this.attendanceService.monthGrid(employeeId, month);
  }

  @Get('leave-balances')
  @Roles(...HR_READ_ROLES)
  balances(
    @Param('employeeId') employeeId: string,
    @Query('year') year?: string,
  ) {
    return this.leaveService.balancesFor(
      employeeId,
      year ? Number(year) : new Date().getUTCFullYear(),
    );
  }
}
