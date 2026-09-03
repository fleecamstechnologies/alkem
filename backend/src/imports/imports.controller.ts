import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ImportsService } from './imports.service';
import { ImportEntity, ImportJobRegistry } from './import-job.registry';
import { parseMapping, parseOptions } from './dto/import-options.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

const ALLOWED_EXT = new Set(['.csv', '.xlsx', '.xlsm']);
const MAX_BYTES = 512 * 1024 * 1024; // 512 MB
const IMPORT_ENTITIES = new Set<ImportEntity>([
  'customers',
  'payments',
  'employees',
  'attendance',
  'patients',
  'drugs',
]);

@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.DATA_ENTRY,
  UserRole.FINANCE,
  UserRole.HR_ADMIN,
  UserRole.RECEPTION,
  UserRole.PHARMACIST,
)
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly registry: ImportJobRegistry,
  ) {}

  @Post(':entity')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, cb) =>
          cb(null, `alkem-import-${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: MAX_BYTES },
    }),
  )
  upload(
    @Param('entity') entity: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('mapping') mappingRaw?: string,
    @Query('options') optionsRaw?: string,
  ) {
    if (!IMPORT_ENTITIES.has(entity as ImportEntity)) {
      throw new BadRequestException(
        'entity must be customers, payments, employees, attendance, patients or drugs',
      );
    }
    if (!file) throw new BadRequestException('file is required');
    if (!ALLOWED_EXT.has(extname(file.originalname).toLowerCase())) {
      throw new BadRequestException('file must be .csv or .xlsx');
    }

    const job = this.importsService.start(
      entity as ImportEntity,
      file.path ?? join(tmpdir(), file.filename),
      file.originalname,
      parseMapping(mappingRaw),
      parseOptions(optionsRaw),
    );
    return { jobId: job.id, status: job.status };
  }

  @Get(':jobId')
  status(@Param('jobId') jobId: string) {
    return this.registry.get(jobId);
  }
}
