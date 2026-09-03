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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  PHARMACY_READ_ROLES,
  PHARMACY_WRITE_ROLES,
} from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { DrugsService } from './drugs.service';
import { SuppliersService } from './suppliers.service';
import { GrnsService } from './grns.service';
import { DispensesService } from './dispenses.service';
import { PharmacyDashboardService } from './pharmacy-dashboard.service';
import {
  CreateDispenseDto,
  CreateDrugDto,
  CreateGrnDto,
  CreateSupplierDto,
  MovementQueryDto,
  QueryDispensesDto,
  QueryDrugsDto,
  QueryGrnsDto,
  QuerySuppliersDto,
  SetGrnItemsDto,
  SupplierPaymentDto,
  UpdateDrugDto,
  UpdateSupplierDto,
} from './pharmacy.dto';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmacyController {
  constructor(
    private readonly drugs: DrugsService,
    private readonly suppliers: SuppliersService,
    private readonly grns: GrnsService,
    private readonly dispenses: DispensesService,
    private readonly dashboardService: PharmacyDashboardService,
  ) {}

  // ---- dashboard / alerts -------------------------------------------
  @Get('dashboard')
  @Roles(...PHARMACY_READ_ROLES)
  dashboard() {
    return this.dashboardService.dashboard();
  }

  @Get('alerts')
  @Roles(...PHARMACY_READ_ROLES)
  alerts() {
    return this.dashboardService.alerts();
  }

  // ---- drugs -------------------------------------------
  @Get('drugs')
  @Roles(...PHARMACY_READ_ROLES)
  listDrugs(@Query() query: QueryDrugsDto) {
    return this.drugs.findPage(query);
  }

  @Get('drugs/stock')
  @Roles(...PHARMACY_READ_ROLES)
  listDrugsWithStock(@Query() query: QueryDrugsDto) {
    return this.drugs.listWithStock(query);
  }

  @Get('drugs/search')
  @Roles(...PHARMACY_READ_ROLES)
  searchDrugs(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.drugs.search(q ?? '', limit ? Number(limit) : 10);
  }

  @Get('drugs/:id')
  @Roles(...PHARMACY_READ_ROLES)
  getDrug(@Param('id') id: string) {
    return this.drugs.findById(id);
  }

  @Get('drugs/:id/batches')
  @Roles(...PHARMACY_READ_ROLES)
  drugBatches(@Param('id') id: string) {
    return this.drugs.batches(id);
  }

  @Get('drugs/:id/movements')
  @Roles(...PHARMACY_READ_ROLES)
  drugMovements(@Param('id') id: string, @Query() q: MovementQueryDto) {
    return this.drugs.movements(id, q.from, q.to);
  }

  @Post('drugs')
  @Roles(...PHARMACY_WRITE_ROLES)
  createDrug(
    @Body() dto: CreateDrugDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.drugs.create(dto, actor);
  }

  @Patch('drugs/:id')
  @Roles(...PHARMACY_WRITE_ROLES)
  updateDrug(
    @Param('id') id: string,
    @Body() dto: UpdateDrugDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.drugs.update(id, dto, actor);
  }

  @Delete('drugs/:id')
  @HttpCode(204)
  @Roles(...PHARMACY_WRITE_ROLES)
  async removeDrug(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.drugs.softRemove(id, actor);
  }

  // ---- suppliers -------------------------------------------
  @Get('suppliers')
  @Roles(...PHARMACY_READ_ROLES)
  listSuppliers(@Query() query: QuerySuppliersDto) {
    return this.suppliers.findPage(query);
  }

  @Get('suppliers/:id')
  @Roles(...PHARMACY_READ_ROLES)
  getSupplier(@Param('id') id: string) {
    return this.suppliers.findById(id);
  }

  @Get('suppliers/:id/payments')
  @Roles(...PHARMACY_READ_ROLES)
  supplierPayments(@Param('id') id: string) {
    return this.suppliers.payments(id);
  }

  @Post('suppliers')
  @Roles(...PHARMACY_WRITE_ROLES)
  createSupplier(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.suppliers.create(dto, actor);
  }

  @Patch('suppliers/:id')
  @Roles(...PHARMACY_WRITE_ROLES)
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.suppliers.update(id, dto, actor);
  }

  @Post('suppliers/:id/payments')
  @Roles(...PHARMACY_WRITE_ROLES)
  addSupplierPayment(
    @Param('id') id: string,
    @Body() dto: SupplierPaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.suppliers.addPayment(id, dto, actor);
  }

  // ---- GRNs -------------------------------------------
  @Get('grns')
  @Roles(...PHARMACY_READ_ROLES)
  listGrns(@Query() query: QueryGrnsDto) {
    return this.grns.list(query);
  }

  @Get('grns/:id')
  @Roles(...PHARMACY_READ_ROLES)
  getGrn(@Param('id') id: string) {
    return this.grns.get(id);
  }

  @Post('grns')
  @Roles(...PHARMACY_WRITE_ROLES)
  createGrn(
    @Body() dto: CreateGrnDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.grns.create(dto, actor);
  }

  @Put('grns/:id/items')
  @Roles(...PHARMACY_WRITE_ROLES)
  setGrnItems(
    @Param('id') id: string,
    @Body() dto: SetGrnItemsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.grns.setItems(id, dto, actor);
  }

  @Post('grns/:id/post')
  @Roles(...PHARMACY_WRITE_ROLES)
  postGrn(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.grns.post(id, actor);
  }

  @Post('grns/:id/cancel')
  @Roles(...PHARMACY_WRITE_ROLES)
  cancelGrn(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.grns.cancel(id, actor);
  }

  // ---- dispensing -------------------------------------------
  @Get('dispenses')
  @Roles(...PHARMACY_READ_ROLES)
  listDispenses(@Query() query: QueryDispensesDto) {
    return this.dispenses.list(query);
  }

  @Get('dispenses/prescription/:rxId/items')
  @Roles(...PHARMACY_READ_ROLES)
  prescriptionItems(@Param('rxId') rxId: string) {
    return this.drugs.getPrescriptionItems(rxId);
  }

  @Get('dispenses/:id')
  @Roles(...PHARMACY_READ_ROLES)
  getDispense(@Param('id') id: string) {
    return this.dispenses.get(id);
  }

  @Post('dispenses')
  @Roles(...PHARMACY_WRITE_ROLES)
  createDispense(
    @Body() dto: CreateDispenseDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.dispenses.create(dto, actor);
  }

  @Post('dispenses/:id/cancel')
  @Roles(...PHARMACY_WRITE_ROLES)
  cancelDispense(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.dispenses.cancel(id, actor);
  }
}
