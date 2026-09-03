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
import { LeaveService } from './leave.service';
import {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  DecideLeaveDto,
  GrantQuotaDto,
  QueryLeaveRequestsDto,
  UpdateLeaveTypeDto,
} from './dto/leave.dto';
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

@Controller('leave')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('types')
  @Roles(...HR_READ_ROLES)
  listTypes() {
    return this.leaveService.listTypes();
  }

  @Post('types')
  @Roles(...HR_WRITE_ROLES)
  createType(@Body() dto: CreateLeaveTypeDto) {
    return this.leaveService.createType(dto);
  }

  @Patch('types/:id')
  @Roles(...HR_WRITE_ROLES)
  updateType(@Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.leaveService.updateType(id, dto);
  }

  @Post('grant-quota')
  @Roles(...HR_WRITE_ROLES)
  grantQuota(@Body() dto: GrantQuotaDto) {
    return this.leaveService.grantAnnualQuota(dto.year);
  }

  @Get('requests')
  @Roles(...HR_READ_ROLES)
  listRequests(@Query() query: QueryLeaveRequestsDto) {
    return this.leaveService.listRequests(query);
  }

  @Post('requests')
  @Roles(...HR_MANAGE_ROLES)
  requestLeave(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leaveService.requestLeave(dto, actor);
  }

  @Post('requests/:id/decide')
  @Roles(...HR_MANAGE_ROLES)
  decide(
    @Param('id') id: string,
    @Body() dto: DecideLeaveDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leaveService.decideLeave(id, dto, actor);
  }
}
