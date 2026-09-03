import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { OfficeLocationsService } from './office-locations.service';
import { SettingsService } from './settings.service';
import { PunchService } from './punch.service';
import { RegularizationService } from './regularization.service';
import {
  AttendanceSummaryDto,
  MarkAttendanceDto,
  QueryAttendanceDto,
} from './dto/attendance.dto';
import {
  CreateOfficeDto,
  DecideRegularizationDto,
  QueryPunchEventsDto,
  QueryRegularizationsDto,
  UpdateAttendanceSettingsDto,
  UpdateOfficeDto,
} from './dto/punch.dto';
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

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly officesService: OfficeLocationsService,
    private readonly settingsService: SettingsService,
    private readonly punchService: PunchService,
    private readonly regularizationService: RegularizationService,
  ) {}

  // ---- office geofence + settings ----------------------------
  @Get('offices')
  @Roles(...HR_READ_ROLES)
  offices() {
    return this.officesService.list();
  }

  @Post('offices')
  @Roles(...HR_WRITE_ROLES)
  createOffice(
    @Body() dto: CreateOfficeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.officesService.create(dto, actor);
  }

  @Patch('offices/:id')
  @Roles(...HR_WRITE_ROLES)
  updateOffice(@Param('id') id: string, @Body() dto: UpdateOfficeDto) {
    return this.officesService.update(id, dto);
  }

  @Delete('offices/:id')
  @Roles(...HR_WRITE_ROLES)
  removeOffice(@Param('id') id: string) {
    return this.officesService.remove(id);
  }

  @Get('settings')
  @Roles(...HR_READ_ROLES)
  settings() {
    return this.settingsService.get();
  }

  @Put('settings')
  @Roles(...HR_WRITE_ROLES)
  updateSettings(
    @Body() dto: UpdateAttendanceSettingsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.settingsService.update(dto, actor);
  }

  // ---- punch events + regularization (HR view) -------------
  @Get('events')
  @Roles(...HR_READ_ROLES)
  events(@Query() query: QueryPunchEventsDto) {
    return this.punchService.events(query);
  }

  @Get('regularizations')
  @Roles(...HR_READ_ROLES)
  regularizations(@Query() query: QueryRegularizationsDto) {
    return this.regularizationService.list(query);
  }

  @Post('regularizations/:id/decide')
  @Roles(...HR_MANAGE_ROLES)
  decideRegularization(
    @Param('id') id: string,
    @Body() dto: DecideRegularizationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.regularizationService.decide(id, dto, actor);
  }

  @Get()
  @Roles(...HR_READ_ROLES)
  list(@Query() query: QueryAttendanceDto) {
    return this.attendanceService.listRange(query);
  }

  @Get('summary')
  @Roles(...HR_READ_ROLES)
  summary(@Query() query: AttendanceSummaryDto) {
    return this.attendanceService.summary(query);
  }

  @Put()
  @Roles(...HR_MANAGE_ROLES)
  mark(
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendanceService.markAttendance(dto, actor);
  }

  @Get('holidays')
  @Roles(...HR_READ_ROLES)
  holidays(@Query('year') year?: string) {
    return this.attendanceService.listHolidays(year ? Number(year) : undefined);
  }

  @Post('holidays')
  @Roles(...HR_WRITE_ROLES)
  addHoliday(@Body() body: { date: string; name: string }) {
    return this.attendanceService.addHoliday(body.date, body.name);
  }

  @Delete('holidays/:id')
  @Roles(...HR_WRITE_ROLES)
  removeHoliday(@Param('id') id: string) {
    return this.attendanceService.removeHoliday(id);
  }
}
