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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HR_READ_ROLES, HR_WRITE_ROLES } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles(...HR_READ_ROLES)
  findPage(@Query() query: QueryEmployeesDto) {
    return this.employeesService.findPage(query);
  }

  @Get('search')
  @Roles(...HR_READ_ROLES)
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.employeesService.search(q ?? '', limit ? Number(limit) : 10);
  }

  @Get(':id')
  @Roles(...HR_READ_ROLES)
  findById(@Param('id') id: string) {
    return this.employeesService.findById(id);
  }

  @Post()
  @Roles(...HR_WRITE_ROLES)
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeesService.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...HR_WRITE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeesService.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...HR_WRITE_ROLES)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.employeesService.softRemove(id, actor);
  }
}
