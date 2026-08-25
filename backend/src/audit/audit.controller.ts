import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.QA_MANAGER)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.auditService.findAll(limit ? Number(limit) : undefined);
  }

  @Get(':entityName/:entityId')
  findForEntity(
    @Param('entityName') entityName: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.findForEntity(entityName, entityId);
  }
}
