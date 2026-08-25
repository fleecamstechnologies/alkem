import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './entities/audit-log.entity';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

interface RecordParams {
  entityName: string;
  entityId: string;
  action: AuditAction;
  user: AuthenticatedUser | null;
  changes?: Record<string, { old: unknown; new: unknown }>;
  reason?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async record(params: RecordParams): Promise<void> {
    const log = this.auditLogRepository.create({
      entityName: params.entityName,
      entityId: params.entityId,
      action: params.action,
      userId: params.user?.userId ?? null,
      userEmail: params.user?.email ?? null,
      changes: params.changes ?? null,
      reason: params.reason ?? null,
    });
    await this.auditLogRepository.save(log);
  }

  async findForEntity(entityName: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityName, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(limit = 200): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
