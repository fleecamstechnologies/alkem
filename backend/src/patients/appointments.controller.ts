import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { ClinicScopeService } from './clinic-scope.service';
import {
  BookAppointmentDto,
  CompleteAppointmentDto,
  QueryAppointmentsDto,
  UpdateAppointmentStatusDto,
} from './patients.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CLINIC_DESK_ROLES,
  CLINIC_READ_ROLES,
  CLINIC_WRITE_ROLES,
} from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly scope: ClinicScopeService,
  ) {}

  @Get()
  @Roles(...CLINIC_READ_ROLES)
  list(
    @Query() query: QueryAppointmentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const doctorId = this.scope.resolveDoctor(
      user,
      query.doctorId,
      query.mine,
    );
    return this.appointments.list(query, doctorId);
  }

  @Get('calendar')
  @Roles(...CLINIC_READ_ROLES)
  calendar(
    @Query('doctorId') doctorId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('mine') mine: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const resolved = this.scope.resolveDoctor(user, doctorId, mine);
    return this.appointments.calendar(resolved ?? doctorId, from, to);
  }

  @Get('dashboard')
  @Roles(...CLINIC_READ_ROLES)
  dashboard() {
    return this.appointments.dashboard();
  }

  @Get(':id')
  @Roles(...CLINIC_READ_ROLES)
  get(@Param('id') id: string) {
    return this.appointments.findById(id);
  }

  @Post()
  @Roles(...CLINIC_DESK_ROLES)
  book(
    @Body() dto: BookAppointmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointments.book(dto, actor);
  }

  @Patch(':id/status')
  @Roles(...CLINIC_DESK_ROLES, ...CLINIC_WRITE_ROLES)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointments.updateStatus(id, dto.status, dto.cancelReason);
  }

  @Post(':id/complete')
  @Roles(...CLINIC_WRITE_ROLES)
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteAppointmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointments.complete(id, dto, actor);
  }
}
