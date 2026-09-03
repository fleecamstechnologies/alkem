import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PatientBillingService } from './patient-billing.service';
import { UpdateChargeStatusDto } from './patients.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CLINIC_DESK_ROLES,
  CLINIC_READ_ROLES,
} from '../common/enums/user-role.enum';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientBillingController {
  constructor(private readonly billing: PatientBillingService) {}

  @Get('patient-billing/dashboard')
  @Roles(...CLINIC_READ_ROLES)
  dashboard() {
    return this.billing.dashboard();
  }

  @Patch('patient-charges/:id/status')
  @Roles(...CLINIC_DESK_ROLES)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateChargeStatusDto,
  ) {
    return this.billing.updateChargeStatus(id, dto.status);
  }
}
