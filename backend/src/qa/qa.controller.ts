import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { QaService } from './qa.service';
import { QaDecisionDto } from './dto/qa-decision.dto';
import { CreateDeviationDto } from './dto/create-deviation.dto';
import { CloseDeviationDto } from './dto/close-deviation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('qa')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QaController {
  constructor(private readonly qaService: QaService) {}

  @Get('batches/:batchId/reviews')
  findReviews(@Param('batchId') batchId: string) {
    return this.qaService.findReviewsForBatch(batchId);
  }

  @Patch('batches/:batchId/start-review')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QA_MANAGER)
  startReview(@Param('batchId') batchId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.qaService.startReview(batchId, actor);
  }

  @Post('batches/:batchId/decision')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QA_MANAGER)
  recordDecision(
    @Param('batchId') batchId: string,
    @Body() dto: QaDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.qaService.recordDecision(batchId, dto, actor);
  }

  @Get('deviations')
  findAllDeviations() {
    return this.qaService.findAllDeviations();
  }

  @Get('deviations/:id')
  findDeviation(@Param('id') id: string) {
    return this.qaService.findDeviationById(id);
  }

  @Post('deviations')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QA_MANAGER, UserRole.PRODUCTION_MANAGER, UserRole.QC_ANALYST)
  raiseDeviation(@Body() dto: CreateDeviationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.qaService.raiseDeviation(dto, actor);
  }

  @Patch('deviations/:id/close')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QA_MANAGER)
  closeDeviation(
    @Param('id') id: string,
    @Body() dto: CloseDeviationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.qaService.closeDeviation(id, dto, actor);
  }
}
