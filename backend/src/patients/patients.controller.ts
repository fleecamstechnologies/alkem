import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { EncountersService } from './encounters.service';
import { AppointmentsService } from './appointments.service';
import { PatientBillingService } from './patient-billing.service';
import {
  CreateChargeDto,
  CreatePatientDto,
  QueryAppointmentsDto,
  QueryPatientsDto,
  StatementQueryDto,
  UpdatePatientDto,
} from './patients.dto';
import { PaginationQuery } from '../common/dto/pagination';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CLINIC_DESK_ROLES,
  CLINIC_READ_ROLES,
} from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly encounters: EncountersService,
    private readonly appointments: AppointmentsService,
    private readonly billing: PatientBillingService,
  ) {}

  @Get()
  @Roles(...CLINIC_READ_ROLES)
  findPage(@Query() query: QueryPatientsDto) {
    return this.patients.findPage(query);
  }

  @Get('search')
  @Roles(...CLINIC_READ_ROLES)
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.patients.search(q ?? '', limit ? Number(limit) : 10);
  }

  @Get(':id')
  @Roles(...CLINIC_READ_ROLES)
  findById(@Param('id') id: string) {
    return this.patients.findById(id);
  }

  @Get(':id/medical-history')
  @Roles(...CLINIC_READ_ROLES)
  history(@Param('id') id: string) {
    return this.patients.medicalHistory(id);
  }

  @Get(':id/appointments')
  @Roles(...CLINIC_READ_ROLES)
  appts(@Param('id') id: string, @Query() query: QueryAppointmentsDto) {
    return this.appointments.list({ ...query, patientId: Number(id) });
  }

  @Get(':id/visits')
  @Roles(...CLINIC_READ_ROLES)
  visits(@Param('id') id: string, @Query() query: PaginationQuery) {
    return this.encounters.listVisits(id, query);
  }

  @Get(':id/prescriptions')
  @Roles(...CLINIC_READ_ROLES)
  prescriptions(@Param('id') id: string) {
    return this.encounters.patientPrescriptions(id);
  }

  @Get(':id/labs')
  @Roles(...CLINIC_READ_ROLES)
  labs(@Param('id') id: string) {
    return this.encounters.patientLabs(id);
  }

  @Get(':id/charges')
  @Roles(...CLINIC_READ_ROLES)
  charges(@Param('id') id: string, @Query() query: PaginationQuery) {
    return this.billing.listCharges(id, query);
  }

  @Get(':id/statement')
  @Roles(...CLINIC_READ_ROLES)
  statement(@Param('id') id: string, @Query() query: StatementQueryDto) {
    return this.billing.statement(id, query.from, query.to);
  }

  @Post()
  @Roles(...CLINIC_DESK_ROLES)
  create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.patients.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...CLINIC_DESK_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.patients.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...CLINIC_DESK_ROLES)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.patients.softRemove(id, actor);
  }

  @Post(':id/charges')
  @Roles(...CLINIC_DESK_ROLES)
  addCharge(
    @Param('id') id: string,
    @Body() dto: CreateChargeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.billing.addCharge(id, dto, actor);
  }
}
