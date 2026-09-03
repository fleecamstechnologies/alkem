import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PaginationQuery } from '../common/dto/pagination';
import { StockMovementKind } from '../common/enums/field.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { FieldScopeService } from './field-scope.service';
import { FieldRepsService } from './field-reps.service';
import { StockService } from './stock.service';
import { TourPlansService } from './tour-plans.service';
import { CallReportsService } from './call-reports.service';
import {
  AssignDto,
  CreateCallReportDto,
  CreatePromoItemDto,
  CreateTourPlanDto,
  DecideTourPlanDto,
  RepProfileDto,
  SetTourPlanDaysDto,
  StockIssueDto,
  UpdatePromoItemDto,
} from './field.dto';

const ADMIN: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.SALES_MANAGER];

@Controller('field')
@UseGuards(JwtAuthGuard)
export class FieldController {
  constructor(
    private readonly scope: FieldScopeService,
    private readonly reps: FieldRepsService,
    private readonly stock: StockService,
    private readonly tourPlans: TourPlansService,
    private readonly callReports: CallReportsService,
  ) {}

  // ---- reps ------------------------------------------------------

  @Get('reps')
  @UseGuards(RolesGuard)
  @Roles(...ADMIN, UserRole.HR_ADMIN)
  listReps() {
    return this.reps.list();
  }

  @Get('reps/me')
  myRep(@CurrentUser() user: AuthenticatedUser) {
    if (!user.employeeId) throw new ForbiddenException('No linked employee');
    return this.reps.myProfile(user.employeeId);
  }

  @Put('reps/:employeeId')
  @UseGuards(RolesGuard)
  @Roles(...ADMIN, UserRole.HR_ADMIN)
  upsertRep(
    @Param('employeeId') employeeId: string,
    @Body() dto: RepProfileDto,
  ) {
    return this.reps.upsertProfile(employeeId, dto);
  }

  @Post('reps/assign')
  @UseGuards(RolesGuard)
  @Roles(...ADMIN)
  assign(@Body() dto: AssignDto) {
    return this.reps.assign(
      dto.entityType,
      String(dto.entityId),
      String(dto.repEmployeeId),
    );
  }

  // ---- promo items --------------------------------------------

  @Get('promo-items')
  promoItems() {
    return this.stock.promoItems();
  }

  @Post('promo-items')
  @UseGuards(RolesGuard)
  @Roles(...ADMIN)
  createPromoItem(@Body() dto: CreatePromoItemDto) {
    return this.stock.createPromoItem(dto);
  }

  @Patch('promo-items/:id')
  @UseGuards(RolesGuard)
  @Roles(...ADMIN)
  updatePromoItem(
    @Param('id') id: string,
    @Body() dto: UpdatePromoItemDto,
  ) {
    return this.stock.updatePromoItem(id, dto);
  }

  // ---- stock ---------------------------------------------------

  @Get('stock')
  async stockBalances(
    @Query('repEmployeeId') repEmployeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const s = await this.scope.resolve(user, repEmployeeId);
    if (!s.repEmployeeId) {
      throw new ForbiddenException('repEmployeeId is required');
    }
    return this.stock.balances(s.repEmployeeId);
  }

  @Get('stock/movements')
  async stockMovements(
    @Query('repEmployeeId') repEmployeeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const s = await this.scope.resolve(user, repEmployeeId);
    if (!s.repEmployeeId) {
      throw new ForbiddenException('repEmployeeId is required');
    }
    return this.stock.movements({ repEmployeeId: s.repEmployeeId, from, to });
  }

  @Post('stock/issue')
  @UseGuards(RolesGuard)
  @Roles(...ADMIN)
  issueStock(
    @Body() dto: StockIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stock.issue(
      String(dto.repEmployeeId),
      dto.kind ?? StockMovementKind.ISSUE,
      dto.movementDate ?? new Date().toISOString().slice(0, 10),
      dto.lines,
      dto.note ?? null,
      user,
    );
  }

  // ---- tour plans -------------------------------------------

  @Get('tour-plans')
  async listTourPlans(
    @Query('repEmployeeId') repEmployeeId: string,
    @Query('periodMonth') periodMonth: string,
    @Query('status') status: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const s = await this.scope.resolve(user, repEmployeeId);
    return this.tourPlans.list({
      repEmployeeId: s.repEmployeeId,
      periodMonth: periodMonth || undefined,
      status: status || undefined,
    });
  }

  @Get('tour-plans/:id')
  getTourPlan(@Param('id') id: string) {
    return this.tourPlans.get(id);
  }

  @Post('tour-plans')
  async createTourPlan(
    @Body() dto: CreateTourPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const s = await this.scope.resolve(user, dto.repEmployeeId);
    if (!s.repEmployeeId) {
      throw new ForbiddenException('repEmployeeId is required');
    }
    return this.tourPlans.getOrCreate(s.repEmployeeId, dto.periodMonth);
  }

  @Put('tour-plans/:id/days')
  async setDays(
    @Param('id') id: string,
    @Body() dto: SetTourPlanDaysDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const plan = await this.tourPlans.get(id);
    const s = await this.scope.resolve(user, plan.repEmployeeId);
    return this.tourPlans.setDays(id, s.repEmployeeId ?? plan.repEmployeeId, dto);
  }

  @Post('tour-plans/:id/submit')
  async submitTourPlan(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const plan = await this.tourPlans.get(id);
    const s = await this.scope.resolve(user, plan.repEmployeeId);
    return this.tourPlans.submit(id, s.repEmployeeId ?? plan.repEmployeeId);
  }

  @Post('tour-plans/:id/decide')
  decideTourPlan(
    @Param('id') id: string,
    @Body() dto: DecideTourPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tourPlans.decide(id, dto, user, (repEmployeeId) =>
      this.scope.canManage(user, repEmployeeId),
    );
  }

  // ---- call reports --------------------------------------

  @Get('call-reports')
  async listCallReports(
    @Query('repEmployeeId') repEmployeeId: string,
    @Query() query: PaginationQuery & {
      from?: string;
      to?: string;
      kind?: string;
      doctorId?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const s = await this.scope.resolve(user, repEmployeeId);
    return this.callReports.list(
      {
        repEmployeeId: s.repEmployeeId,
        from: query.from,
        to: query.to,
        kind: query.kind,
        doctorId: query.doctorId,
      },
      query,
    );
  }

  @Get('call-reports/:id')
  getCallReport(@Param('id') id: string) {
    return this.callReports.get(id);
  }

  @Post('call-reports')
  async createCallReport(
    @Body() dto: CreateCallReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const s = await this.scope.resolve(user, dto.repEmployeeId);
    if (!s.repEmployeeId) {
      throw new ForbiddenException('repEmployeeId is required');
    }
    return this.callReports.create(s.repEmployeeId, dto, user);
  }

  // ---- dashboard ----------------------------------------

  @Get('dashboard')
  async dashboard(
    @Query('periodMonth') periodMonth: string,
    @Query('repEmployeeId') repEmployeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const month = /^\d{4}-\d{2}$/.test(periodMonth)
      ? periodMonth
      : new Date().toISOString().slice(0, 7);

    let repIds: string[];
    if (this.scope.isPrivileged(user)) {
      if (repEmployeeId) {
        repIds = [repEmployeeId];
      } else {
        const rows: Array<{ employeeId: string }> = await this.reps
          .list()
          .then((r) => r as Array<{ employeeId: string }>);
        repIds = rows.map((r) => String(r.employeeId));
      }
    } else {
      const s = await this.scope.resolve(user, repEmployeeId);
      repIds = repEmployeeId
        ? [s.repEmployeeId as string]
        : await this.scope.teamRepIds(user);
    }
    return this.callReports.dashboard(month, repIds);
  }
}
