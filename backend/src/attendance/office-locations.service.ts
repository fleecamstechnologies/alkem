import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfficeLocation } from './entities/office-location.entity';
import { CreateOfficeDto, UpdateOfficeDto } from './dto/punch.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

/** Great-circle distance between two lat/lng points, in metres. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export interface NearestOffice {
  office: OfficeLocation;
  distanceM: number;
  withinGeofence: boolean;
}

@Injectable()
export class OfficeLocationsService {
  constructor(
    @InjectRepository(OfficeLocation)
    private readonly repo: Repository<OfficeLocation>,
  ) {}

  list(): Promise<OfficeLocation[]> {
    return this.repo.find({ order: { code: 'ASC' } });
  }

  async create(
    dto: CreateOfficeDto,
    actor: AuthenticatedUser,
  ): Promise<OfficeLocation> {
    if (await this.repo.findOne({ where: { code: dto.code } })) {
      throw new ConflictException(`Office ${dto.code} already exists`);
    }
    return this.repo.save(
      this.repo.create({
        code: dto.code,
        name: dto.name,
        latitude: String(dto.latitude),
        longitude: String(dto.longitude),
        radiusMeters: dto.radiusMeters ?? 200,
        address: dto.address ?? null,
        isActive: dto.isActive ?? true,
        createdByUserId: actor.userId,
      }),
    );
  }

  async update(id: string, dto: UpdateOfficeDto): Promise<OfficeLocation> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Office ${id} not found`);
    Object.assign(row, {
      name: dto.name ?? row.name,
      latitude: dto.latitude !== undefined ? String(dto.latitude) : row.latitude,
      longitude:
        dto.longitude !== undefined ? String(dto.longitude) : row.longitude,
      radiusMeters: dto.radiusMeters ?? row.radiusMeters,
      address: dto.address === undefined ? row.address : dto.address,
      isActive: dto.isActive ?? row.isActive,
    });
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Office ${id} not found`);
    await this.repo.delete(id);
  }

  /**
   * Nearest active office to a point. `withinGeofence` is true when the nearest
   * office's distance is within its own radius. Returns null only when there are
   * no active offices at all.
   */
  async nearest(lat: number, lng: number): Promise<NearestOffice | null> {
    const offices = await this.repo.find({ where: { isActive: true } });
    if (!offices.length) return null;
    let best: NearestOffice | null = null;
    for (const office of offices) {
      const distanceM = haversineMeters(
        lat,
        lng,
        Number(office.latitude),
        Number(office.longitude),
      );
      if (!best || distanceM < best.distanceM) {
        best = {
          office,
          distanceM,
          withinGeofence: distanceM <= office.radiusMeters,
        };
      }
    }
    return best;
  }
}
