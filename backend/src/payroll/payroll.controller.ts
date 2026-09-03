import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { StatutoryConfigService } from './statutory-config.service';
import { EmployeeStatutoryService } from './employee-statutory.service';
import {
  AssignStructureDto,
  CreateComponentDto,
  CreatePayRunDto,
  UpdateComponentDto,
} from './dto/payroll.dto';
import {
  CreatePtSlabDto,
  ReplaceItSlabsDto,
  UpdateEmployeeStatutoryDto,
  UpdatePtSlabDto,
  UpdateStatutoryConfigDto,
  UpsertTaxDeclarationDto,
} from './dto/statutory.dto';
import { TaxRegime } from '../common/enums/payroll.enum';
import { PaginationQuery } from '../common/dto/pagination';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  HR_MANAGE_ROLES,
  HR_READ_ROLES,
  HR_WRITE_ROLES,
} from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly statutoryConfigService: StatutoryConfigService,
    private readonly employeeStatutoryService: EmployeeStatutoryService,
  ) {}

  // ---- statutory config -----------------------------------
  @Get('statutory/config')
  @Roles(...HR_READ_ROLES)
  statutoryConfig() {
    return this.statutoryConfigService.getActiveConfig();
  }

  @Put('statutory/config')
  @Roles(...HR_WRITE_ROLES)
  updateStatutoryConfig(
    @Body() dto: UpdateStatutoryConfigDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.statutoryConfigService.updateActiveConfig(dto, actor.userId);
  }

  @Get('statutory/pt-slabs')
  @Roles(...HR_READ_ROLES)
  ptSlabs() {
    return this.statutoryConfigService.listPtSlabs();
  }

  @Post('statutory/pt-slabs')
  @Roles(...HR_WRITE_ROLES)
  createPtSlab(@Body() dto: CreatePtSlabDto) {
    return this.statutoryConfigService.createPtSlab(dto);
  }

  @Patch('statutory/pt-slabs/:id')
  @Roles(...HR_WRITE_ROLES)
  updatePtSlab(@Param('id') id: string, @Body() dto: UpdatePtSlabDto) {
    return this.statutoryConfigService.updatePtSlab(id, dto);
  }

  @Delete('statutory/pt-slabs/:id')
  @HttpCode(204)
  @Roles(...HR_WRITE_ROLES)
  async deletePtSlab(@Param('id') id: string) {
    await this.statutoryConfigService.deletePtSlab(id);
  }

  @Get('statutory/it-slabs')
  @Roles(...HR_READ_ROLES)
  itSlabs(
    @Query('fy') fy?: string,
    @Query('regime') regime?: string,
  ) {
    return this.statutoryConfigService.listItSlabs(
      fy || undefined,
      regime === 'OLD' || regime === 'NEW'
        ? (regime as TaxRegime)
        : undefined,
    );
  }

  @Put('statutory/it-slabs')
  @Roles(...HR_WRITE_ROLES)
  replaceItSlabs(@Body() dto: ReplaceItSlabsDto) {
    return this.statutoryConfigService.replaceItSlabs(dto);
  }

  // ---- employee statutory profile -----------------------
  @Get('employees/:employeeId/statutory')
  @Roles(...HR_READ_ROLES)
  employeeStatutory(@Param('employeeId') employeeId: string) {
    return this.employeeStatutoryService.get(employeeId);
  }

  @Put('employees/:employeeId/statutory')
  @Roles(...HR_WRITE_ROLES)
  updateEmployeeStatutory(
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateEmployeeStatutoryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeStatutoryService.update(employeeId, dto, actor);
  }

  // ---- employee tax declaration -------------------------
  @Get('employees/:employeeId/tax-declaration')
  @Roles(...HR_READ_ROLES)
  employeeTaxDeclaration(
    @Param('employeeId') employeeId: string,
    @Query('fy') fy: string,
  ) {
    return this.payrollService.getTaxDeclaration(
      employeeId,
      fy || StatutoryConfigService.financialYearOf(new Date().toISOString().slice(0, 7)),
    );
  }

  @Put('employees/:employeeId/tax-declaration')
  @Roles(...HR_WRITE_ROLES)
  updateEmployeeTaxDeclaration(
    @Param('employeeId') employeeId: string,
    @Body() dto: UpsertTaxDeclarationDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Query('fy') fy?: string,
  ) {
    return this.payrollService.upsertTaxDeclaration(
      employeeId,
      fy || StatutoryConfigService.financialYearOf(new Date().toISOString().slice(0, 7)),
      dto,
      actor,
      true,
    );
  }

  // components
  @Get('components')
  @Roles(...HR_READ_ROLES)
  listComponents() {
    return this.payrollService.listComponents();
  }

  @Post('components')
  @Roles(...HR_WRITE_ROLES)
  createComponent(@Body() dto: CreateComponentDto) {
    return this.payrollService.createComponent(dto);
  }

  @Patch('components/:id')
  @Roles(...HR_WRITE_ROLES)
  updateComponent(@Param('id') id: string, @Body() dto: UpdateComponentDto) {
    return this.payrollService.updateComponent(id, dto);
  }

  @Delete('components/:id')
  @HttpCode(204)
  @Roles(...HR_WRITE_ROLES)
  async deleteComponent(@Param('id') id: string) {
    await this.payrollService.deleteComponent(id);
  }

  // salary structure
  @Get('employees/:employeeId/structure')
  @Roles(...HR_READ_ROLES)
  getStructure(@Param('employeeId') employeeId: string) {
    return this.payrollService.getActiveStructure(employeeId);
  }

  @Post('employees/:employeeId/structure')
  @Roles(...HR_WRITE_ROLES)
  assignStructure(
    @Param('employeeId') employeeId: string,
    @Body() dto: AssignStructureDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.payrollService.assignStructure(employeeId, dto, actor);
  }

  @Get('employees/:employeeId/payslips')
  @Roles(...HR_READ_ROLES)
  employeePayslips(@Param('employeeId') employeeId: string) {
    return this.payrollService.employeePayslips(employeeId);
  }

  // pay runs
  @Get('runs')
  @Roles(...HR_READ_ROLES)
  listRuns() {
    return this.payrollService.listRuns();
  }

  @Get('runs/:id')
  @Roles(...HR_READ_ROLES)
  getRun(@Param('id') id: string) {
    return this.payrollService.getRun(id);
  }

  @Post('runs')
  @Roles(...HR_MANAGE_ROLES)
  createRun(
    @Body() dto: CreatePayRunDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.payrollService.createRun(dto.periodMonth, actor);
  }

  @Post('runs/:id/process')
  @Roles(...HR_MANAGE_ROLES)
  processRun(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.payrollService.processRun(id, actor);
  }

  @Post('runs/:id/approve')
  @Roles(...HR_MANAGE_ROLES)
  approveRun(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.payrollService.approveRun(id, actor);
  }

  @Post('runs/:id/mark-paid')
  @Roles(...HR_MANAGE_ROLES)
  markPaid(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.payrollService.markPaid(id, actor);
  }

  @Delete('runs/:id')
  @Roles(...HR_MANAGE_ROLES)
  cancelRun(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.payrollService.cancelRun(id, actor);
  }

  @Get('runs/:id/payslips')
  @Roles(...HR_READ_ROLES)
  listPayslips(@Param('id') id: string, @Query() query: PaginationQuery) {
    return this.payrollService.listPayslips(id, query);
  }

  @Get('payslips/:id')
  @Roles(...HR_READ_ROLES)
  getPayslip(@Param('id') id: string) {
    return this.payrollService.getPayslip(id);
  }

  @Get('dashboard')
  @Roles(...HR_READ_ROLES)
  dashboard() {
    return this.payrollService.dashboard();
  }
}
