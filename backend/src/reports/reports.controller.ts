import {
  Controller,
  Get,
  Param,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ReportsService, type ReportFormat } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const FORMATS: ReportFormat[] = ['json', 'csv', 'xlsx'];

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.list(user.role);
  }

  @Get(':key')
  async run(
    @Param('key') key: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const format: ReportFormat = FORMATS.includes(query.format as ReportFormat)
      ? (query.format as ReportFormat)
      : 'json';
    const { format: _drop, ...params } = query;
    void _drop;

    const result = await this.reportsService.run(
      key,
      params,
      user.role,
      format,
    );

    if (format === 'json') return result;

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      return new StreamableFile(Buffer.from(this.reportsService.csv(result)), {
        type: 'text/csv; charset=utf-8',
        disposition: `attachment; filename="${key}-${stamp}.csv"`,
      });
    }
    const buf = await this.reportsService.xlsx(result, key);
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${key}-${stamp}.xlsx"`,
    });
  }
}
