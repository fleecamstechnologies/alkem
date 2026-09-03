import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PortalService } from './portal.service';
import {
  PortalDecideDto,
  PortalLeaveRequestDto,
  PortalProfileDto,
} from './portal.dto';
import { UpsertTaxDeclarationDto } from '../payroll/dto/statutory.dto';
import {
  CreateRegularizationDto,
  DecideRegularizationDto,
  PunchDto,
  PunchStatusQueryDto,
} from '../attendance/dto/punch.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmployeeLinkedGuard } from './employee-linked.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('me')
@UseGuards(JwtAuthGuard, EmployeeLinkedGuard)
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  private eid(user: AuthenticatedUser): string {
    return user.employeeId as string;
  }

  @Get()
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.profile(this.eid(user));
  }

  @Patch('profile')
  updateProfile(
    @Body() dto: PortalProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.updateProfile(this.eid(user), dto, user);
  }

  @Get('payslips')
  payslips(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.payslips(this.eid(user));
  }

  @Get('payslips/:id')
  payslip(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.payslip(this.eid(user), id);
  }

  @Get('attendance')
  attendance(
    @Query('periodMonth') periodMonth: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.attendance(this.eid(user), periodMonth ?? '');
  }

  // ---- punch in / out + breaks ----------------------------
  @Get('punch/status')
  punchStatus(
    @Query() query: PunchStatusQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.punchStatus(this.eid(user), query.date);
  }

  @Post('punch')
  punch(@Body() dto: PunchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.portal.punch(this.eid(user), dto, user);
  }

  // ---- attendance regularization -------------------------
  @Get('regularizations')
  regularizations(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.regularizations(this.eid(user));
  }

  @Post('regularizations')
  requestRegularization(
    @Body() dto: CreateRegularizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.requestRegularization(this.eid(user), dto, user);
  }

  @Post('regularizations/:id/cancel')
  cancelRegularization(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.cancelRegularization(this.eid(user), id);
  }

  @Get('regularization-approvals')
  regularizationApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.regularizationApprovals(this.eid(user));
  }

  @Post('regularizations/:id/decide')
  decideRegularization(
    @Param('id') id: string,
    @Body() dto: DecideRegularizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.decideRegularization(this.eid(user), id, dto, user);
  }

  @Get('tax-declaration')
  taxDeclaration(
    @Query('fy') fy: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.taxDeclaration(this.eid(user), fy ?? '');
  }

  @Put('tax-declaration')
  saveTaxDeclaration(
    @Body() dto: UpsertTaxDeclarationDto,
    @Query('fy') fy: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.saveTaxDeclaration(this.eid(user), fy ?? '', dto, user);
  }

  @Get('leave-balances')
  leaveBalances(
    @Query('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.leaveBalances(
      this.eid(user),
      year ? Number(year) : undefined,
    );
  }

  @Get('leave-requests')
  leaveRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.leaveRequests(this.eid(user));
  }

  @Post('leave-requests')
  requestLeave(
    @Body() dto: PortalLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.requestLeave(this.eid(user), dto, user);
  }

  @Post('leave-requests/:id/cancel')
  cancelLeave(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.cancelLeave(this.eid(user), id, user);
  }

  @Get('team')
  team(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.team(this.eid(user));
  }

  @Get('approvals')
  approvals(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.approvals(this.eid(user));
  }

  @Post('approvals/:id/decide')
  decide(
    @Param('id') id: string,
    @Body() dto: PortalDecideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.decideApproval(this.eid(user), id, dto, user);
  }

  @Get('team/:employeeId/attendance')
  teamAttendance(
    @Param('employeeId') employeeId: string,
    @Query('periodMonth') periodMonth: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.portal.teamMemberAttendance(
      this.eid(user),
      employeeId,
      periodMonth ?? '',
    );
  }
}
