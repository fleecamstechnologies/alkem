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
import { DoctorsService } from './doctors.service';
import {
  CreateDoctorDto,
  QueryDoctorsDto,
  UpdateDoctorDto,
} from './dto/doctor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { READ_ROLES, WRITE_ROLES } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @Roles(...READ_ROLES)
  findPage(@Query() query: QueryDoctorsDto) {
    return this.doctorsService.findPage(query);
  }

  @Get('search')
  @Roles(...READ_ROLES)
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.doctorsService.search(q ?? '', limit ? Number(limit) : 10);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findById(@Param('id') id: string) {
    return this.doctorsService.findById(id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  create(
    @Body() dto: CreateDoctorDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.doctorsService.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.doctorsService.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...WRITE_ROLES)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.doctorsService.softRemove(id, actor);
  }
}
