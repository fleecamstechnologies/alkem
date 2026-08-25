import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { SubmitForQcDto } from './dto/submit-for-qc.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  findAll() {
    return this.batchesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.batchesService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PRODUCTION_MANAGER)
  create(@Body() dto: CreateBatchDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.batchesService.create(dto, actor);
  }

  @Patch(':id/start-manufacturing')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PRODUCTION_MANAGER)
  startManufacturing(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.batchesService.startManufacturing(id, actor);
  }

  @Patch(':id/submit-for-qc')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PRODUCTION_MANAGER)
  submitForQc(
    @Param('id') id: string,
    @Body() dto: SubmitForQcDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.batchesService.submitForQc(id, dto.productionQuantity, actor);
  }
}
