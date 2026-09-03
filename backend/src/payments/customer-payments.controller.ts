import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { StatementQueryDto } from './dto/statement-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { READ_ROLES } from '../common/enums/user-role.enum';

/** Payment views scoped to one customer: /api/customers/:customerId/... */
@Controller('customers/:customerId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payments')
  @Roles(...READ_ROLES)
  list(
    @Param('customerId') customerId: string,
    @Query() query: QueryPaymentsDto,
  ) {
    return this.paymentsService.listForCustomer(customerId, query);
  }

  @Get('statement')
  @Roles(...READ_ROLES)
  statement(
    @Param('customerId') customerId: string,
    @Query() query: StatementQueryDto,
  ) {
    return this.paymentsService.statement(customerId, query.from, query.to);
  }
}
