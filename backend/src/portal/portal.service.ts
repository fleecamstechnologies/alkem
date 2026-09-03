import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmployeesService } from '../employees/employees.service';
import { PayrollService } from '../payroll/payroll.service';
import { StatutoryConfigService } from '../payroll/statutory-config.service';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveService } from '../attendance/leave.service';
import { PunchService } from '../attendance/punch.service';
import { RegularizationService } from '../attendance/regularization.service';
import type { UpdateEmployeeDto } from '../employees/dto/update-employee.dto';
import type { UpsertTaxDeclarationDto } from '../payroll/dto/statutory.dto';
import type {
  CreateRegularizationDto,
  DecideRegularizationDto,
  PunchDto,
} from '../attendance/dto/punch.dto';
import {
  PortalDecideDto,
  PortalLeaveRequestDto,
  PortalProfileDto,
} from './portal.dto';
import { LeaveRequestStatus } from '../common/enums/attendance.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class PortalService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly employeesService: EmployeesService,
    private readonly payrollService: PayrollService,
    private readonly attendanceService: AttendanceService,
    private readonly leaveService: LeaveService,
    private readonly punchService: PunchService,
    private readonly regularizationService: RegularizationService,
  ) {}

  profile(employeeId: string) {
    return this.employeesService.findById(employeeId);
  }

  updateProfile(
    employeeId: string,
    dto: PortalProfileDto,
    actor: AuthenticatedUser,
  ) {
    return this.employeesService.update(
      employeeId,
      dto as UpdateEmployeeDto,
      actor,
    );
  }

  payslips(employeeId: string) {
    return this.payrollService.employeePayslips(employeeId);
  }

  async payslip(employeeId: string, id: string) {
    const slip = await this.payrollService.getPayslip(id);
    if (String(slip.employeeId) !== String(employeeId)) {
      throw new ForbiddenException('Not your payslip');
    }
    return slip;
  }

  private resolveFy(fy: string): string {
    return /^\d{4}-\d{4}$/.test(fy)
      ? fy
      : StatutoryConfigService.financialYearOf(
          new Date().toISOString().slice(0, 7),
        );
  }

  taxDeclaration(employeeId: string, fy: string) {
    return this.payrollService.getTaxDeclaration(employeeId, this.resolveFy(fy));
  }

  saveTaxDeclaration(
    employeeId: string,
    fy: string,
    dto: UpsertTaxDeclarationDto,
    actor: AuthenticatedUser,
  ) {
    // Employees may submit but never LOCK — allowLock = false.
    return this.payrollService.upsertTaxDeclaration(
      employeeId,
      this.resolveFy(fy),
      dto,
      actor,
      false,
    );
  }

  attendance(employeeId: string, periodMonth: string) {
    const month = /^\d{4}-\d{2}$/.test(periodMonth)
      ? periodMonth
      : new Date().toISOString().slice(0, 7);
    return this.attendanceService.monthGrid(employeeId, month);
  }

  // ---- punch in / out + breaks ----------------------------

  punchStatus(employeeId: string, date?: string) {
    return this.punchService.status(employeeId, date || undefined);
  }

  punch(employeeId: string, dto: PunchDto, actor: AuthenticatedUser) {
    return this.punchService.punch(employeeId, dto, actor);
  }

  // ---- regularization ------------------------------------

  regularizations(employeeId: string) {
    return this.regularizationService.listMine(employeeId);
  }

  requestRegularization(
    employeeId: string,
    dto: CreateRegularizationDto,
    actor: AuthenticatedUser,
  ) {
    return this.regularizationService.request(employeeId, dto, actor);
  }

  cancelRegularization(employeeId: string, id: string) {
    return this.regularizationService.cancel(employeeId, id);
  }

  regularizationApprovals(managerEmployeeId: string) {
    return this.regularizationService.approvalsFor(managerEmployeeId);
  }

  async decideRegularization(
    managerEmployeeId: string,
    id: string,
    dto: DecideRegularizationDto,
    actor: AuthenticatedUser,
  ) {
    const request = await this.regularizationService.findById(id);
    await this.assertReportsTo(
      managerEmployeeId,
      String(request.employeeId),
    );
    return this.regularizationService.decide(id, dto, actor);
  }

  leaveBalances(employeeId: string, year?: number) {
    return this.leaveService.balancesFor(
      employeeId,
      year ?? new Date().getUTCFullYear(),
    );
  }

  leaveRequests(employeeId: string) {
    return this.leaveService.listRequests({ employeeId: Number(employeeId) });
  }

  requestLeave(
    employeeId: string,
    dto: PortalLeaveRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.leaveService.requestLeave(
      { ...dto, employeeId: Number(employeeId) },
      actor,
    );
  }

  async cancelLeave(
    employeeId: string,
    requestId: string,
    actor: AuthenticatedUser,
  ) {
    const [row] = await this.ds.query(
      `SELECT employeeId FROM leave_requests WHERE id = ?`,
      [requestId],
    );
    if (!row) throw new NotFoundException(`Leave request ${requestId} not found`);
    if (String(row.employeeId) !== String(employeeId)) {
      throw new ForbiddenException('Not your leave request');
    }
    return this.leaveService.decideLeave(
      requestId,
      { decision: LeaveRequestStatus.CANCELLED },
      actor,
    );
  }

  team(managerEmployeeId: string) {
    return this.ds.query(
      `SELECT id, code, firstName, lastName, designation, status, departmentId
       FROM employees
       WHERE reportingManagerId = ? AND deletedAt IS NULL
       ORDER BY code`,
      [managerEmployeeId],
    );
  }

  approvals(managerEmployeeId: string) {
    return this.ds.query(
      `SELECT lr.id, lr.employeeId, lr.leaveTypeId, lr.fromDate, lr.toDate,
              lr.days, lr.halfDay, lr.reason, lr.status, lr.createdAt,
              e.code AS employeeCode,
              CONCAT(e.firstName,' ',e.lastName) AS employeeName,
              lt.code AS leaveTypeCode
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employeeId
       JOIN leave_types lt ON lt.id = lr.leaveTypeId
       WHERE e.reportingManagerId = ? AND lr.status = 'PENDING'
       ORDER BY lr.createdAt`,
      [managerEmployeeId],
    );
  }

  private async assertReportsTo(
    managerEmployeeId: string,
    memberEmployeeId: string,
  ): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT reportingManagerId FROM employees WHERE id = ?`,
      [memberEmployeeId],
    );
    if (!row || String(row.reportingManagerId) !== String(managerEmployeeId)) {
      throw new ForbiddenException('That employee is not in your team');
    }
  }

  async decideApproval(
    managerEmployeeId: string,
    requestId: string,
    dto: PortalDecideDto,
    actor: AuthenticatedUser,
  ) {
    const [row] = await this.ds.query(
      `SELECT employeeId FROM leave_requests WHERE id = ?`,
      [requestId],
    );
    if (!row) throw new NotFoundException(`Leave request ${requestId} not found`);
    await this.assertReportsTo(managerEmployeeId, String(row.employeeId));
    return this.leaveService.decideLeave(requestId, dto, actor);
  }

  async teamMemberAttendance(
    managerEmployeeId: string,
    memberEmployeeId: string,
    periodMonth: string,
  ) {
    await this.assertReportsTo(managerEmployeeId, memberEmployeeId);
    const month = /^\d{4}-\d{2}$/.test(periodMonth)
      ? periodMonth
      : new Date().toISOString().slice(0, 7);
    return this.attendanceService.monthGrid(memberEmployeeId, month);
  }
}
