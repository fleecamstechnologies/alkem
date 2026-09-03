import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EncountersService } from './encounters.service';
import {
  AddPrescriptionDto,
  CreateVisitDto,
  LabResultDto,
  OrderLabDto,
} from './patients.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CLINIC_READ_ROLES,
  CLINIC_WRITE_ROLES,
} from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EncountersController {
  constructor(private readonly encounters: EncountersService) {}

  @Get('visits/:id')
  @Roles(...CLINIC_READ_ROLES)
  getVisit(@Param('id') id: string) {
    return this.encounters.getVisit(id);
  }

  @Post('visits')
  @Roles(...CLINIC_WRITE_ROLES)
  createVisit(
    @Body() dto: CreateVisitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.encounters.createVisit(dto, actor);
  }

  @Post('visits/:id/prescriptions')
  @Roles(...CLINIC_WRITE_ROLES)
  addPrescription(
    @Param('id') id: string,
    @Body() dto: AddPrescriptionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.encounters.addPrescription(id, dto, actor);
  }

  @Post('labs')
  @Roles(...CLINIC_WRITE_ROLES)
  orderLab(
    @Body() dto: OrderLabDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.encounters.orderLab(dto, actor);
  }

  @Patch('labs/:id/result')
  @Roles(...CLINIC_WRITE_ROLES)
  labResult(@Param('id') id: string, @Body() dto: LabResultDto) {
    return this.encounters.updateLabResult(id, dto);
  }
}
