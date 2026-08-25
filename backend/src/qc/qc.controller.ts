import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { QcService } from './qc.service';
import { CreateSampleDto } from './dto/create-sample.dto';
import { AddTestDto } from './dto/add-test.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('qc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QcController {
  constructor(private readonly qcService: QcService) {}

  @Get('samples')
  findAllSamples() {
    return this.qcService.findAllSamples();
  }

  @Get('samples/:id')
  findSample(@Param('id') id: string) {
    return this.qcService.findSampleById(id);
  }

  @Get('samples/:id/tests')
  findTests(@Param('id') id: string) {
    return this.qcService.findTestsForSample(id);
  }

  @Post('samples')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QC_ANALYST)
  createSample(@Body() dto: CreateSampleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.qcService.createSample(dto, actor);
  }

  @Patch('samples/:id/complete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QC_ANALYST)
  completeSample(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.qcService.completeSample(id, actor);
  }

  @Post('tests')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QC_ANALYST)
  addTest(@Body() dto: AddTestDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.qcService.addTest(dto, actor);
  }

  @Patch('tests/:id/result')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QC_ANALYST)
  recordResult(
    @Param('id') id: string,
    @Body() dto: RecordResultDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.qcService.recordResult(id, dto, actor);
  }
}
