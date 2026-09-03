import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './entities/app-settings.entity';
import { UpdateAttendanceSettingsDto } from './dto/punch.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const CACHE_KEY = 'app:settings';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly repo: Repository<AppSettings>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async get(): Promise<AppSettings> {
    const cached = await this.cache.get<AppSettings>(CACHE_KEY);
    if (cached) return cached;
    let row = await this.repo.findOne({ where: {}, order: { id: 'ASC' } });
    if (!row) row = await this.repo.save(this.repo.create({}));
    await this.cache.set(CACHE_KEY, row, 60_000);
    return row;
  }

  async update(
    dto: UpdateAttendanceSettingsDto,
    actor: AuthenticatedUser,
  ): Promise<AppSettings> {
    const row = await this.get();
    if (dto.punchHalfDayHours !== undefined) {
      row.punchHalfDayHours = String(dto.punchHalfDayHours);
    }
    if (dto.punchFullDayHours !== undefined) {
      row.punchFullDayHours = String(dto.punchFullDayHours);
    }
    if (dto.defaultGeofenceMeters !== undefined) {
      row.defaultGeofenceMeters = dto.defaultGeofenceMeters;
    }
    row.updatedByUserId = actor.userId;
    const saved = await this.repo.save(row);
    await this.cache.del(CACHE_KEY);
    return saved;
  }
}
