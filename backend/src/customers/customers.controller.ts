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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { READ_ROLES, WRITE_ROLES } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(...READ_ROLES)
  findPage(@Query() query: QueryCustomersDto) {
    return this.customersService.findPage(query);
  }

  @Get('search')
  @Roles(...READ_ROLES)
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.customersService.search(q ?? '', limit ? Number(limit) : 10);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customersService.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customersService.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...WRITE_ROLES)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.customersService.softRemove(id, actor);
  }
}
