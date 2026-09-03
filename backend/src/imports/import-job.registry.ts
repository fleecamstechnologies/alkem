import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type ImportEntity =
  | 'customers'
  | 'payments'
  | 'employees'
  | 'attendance'
  | 'patients'
  | 'drugs'
  | 'doctors';
export type JobStatus = 'running' | 'completed' | 'failed';

export interface ImportRowError {
  row: number;
  reason: string;
}

export interface ImportJob {
  id: string;
  entity: ImportEntity;
  status: JobStatus;
  fileName: string;
  total: number;
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: ImportRowError[];
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
}

const MAX_ERRORS_KEPT = 500;
const JOB_TTL_MS = 60 * 60 * 1000; // keep finished jobs queryable for an hour

/**
 * Process-local job tracker. Fine for a single API node running imports
 * synchronously. Swap for a Redis/BullMQ-backed store when imports need to
 * survive restarts or run across nodes.
 */
@Injectable()
export class ImportJobRegistry {
  private readonly jobs = new Map<string, ImportJob>();

  create(entity: ImportEntity, fileName: string): ImportJob {
    this.sweep();
    const job: ImportJob = {
      id: randomUUID(),
      entity,
      status: 'running',
      fileName,
      total: 0,
      processed: 0,
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      message: null,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): ImportJob {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException(`Import job ${id} not found`);
    return job;
  }

  addError(job: ImportJob, row: number, reason: string): void {
    job.failed += 1;
    if (job.errors.length < MAX_ERRORS_KEPT) {
      job.errors.push({ row, reason });
    }
  }

  finish(job: ImportJob, status: JobStatus, message?: string): void {
    job.status = status;
    job.finishedAt = new Date().toISOString();
    if (message) job.message = message;
  }

  private sweep(): void {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this.jobs) {
      if (job.finishedAt && Date.parse(job.finishedAt) < cutoff) {
        this.jobs.delete(id);
      }
    }
  }
}
