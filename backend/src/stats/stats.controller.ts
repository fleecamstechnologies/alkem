import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** Record counts across every module, for the dashboard. */
  @Get('counts')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE,
    UserRole.SALES_MANAGER,
    UserRole.DATA_ENTRY,
    UserRole.HR_ADMIN,
    UserRole.HR_MANAGER,
    UserRole.VIEWER,
    UserRole.RECEPTION,
    UserRole.CLINICIAN,
    UserRole.PHARMACIST,
  )
  counts() {
    return this.statsService.counts();
  }
}
