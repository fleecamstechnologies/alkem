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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { UpdatePaymentStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { READ_ROLES, WRITE_ROLES } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(...READ_ROLES)
  findPage(@Query() query: QueryPaymentsDto) {
    return this.paymentsService.findPage(query);
  }

  @Get('summary')
  @Roles(...READ_ROLES)
  summary(@Query() query: SummaryQueryDto) {
    return this.paymentsService.periodSummary(query);
  }

  @Get('dashboard')
  @Roles(...READ_ROLES)
  dashboard() {
    return this.paymentsService.dashboardStats();
  }

  @Post()
  @Roles(...WRITE_ROLES)
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentsService.create(dto, actor);
  }

  @Patch(':id/status')
  @Roles(...WRITE_ROLES)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentsService.updateStatus(id, dto.status, actor);
  }
}
