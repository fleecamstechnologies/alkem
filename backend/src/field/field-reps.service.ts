import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FieldRep } from './entities/field-rep.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { Customer } from '../customers/entities/customer.entity';
import { RepProfileDto } from './field.dto';

@Injectable()
export class FieldRepsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  list() {
    return this.ds.query(
      `SELECT fr.id, fr.employeeId, fr.hq, fr.territory, fr.active,
              e.code AS employeeCode,
              CONCAT(e.firstName,' ',e.lastName) AS employeeName,
              (SELECT COUNT(*) FROM doctors d
                 WHERE d.assignedRepEmployeeId = fr.employeeId AND d.deletedAt IS NULL) AS doctors,
              (SELECT COUNT(*) FROM customers c
                 WHERE c.assignedRepEmployeeId = fr.employeeId AND c.deletedAt IS NULL) AS chemists
       FROM field_reps fr
       JOIN employees e ON e.id = fr.employeeId
       ORDER BY e.code`,
    );
  }

  async myProfile(employeeId: string): Promise<FieldRep> {
    const rep = await this.ds
      .getRepository(FieldRep)
      .findOne({ where: { employeeId } });
    if (!rep) throw new NotFoundException('You are not registered as a field rep');
    return rep;
  }

  async upsertProfile(
    employeeId: string,
    dto: RepProfileDto,
  ): Promise<FieldRep> {
    const repo = this.ds.getRepository(FieldRep);
    const emp = await this.ds.query(
      `SELECT id FROM employees WHERE id = ? AND deletedAt IS NULL`,
      [employeeId],
    );
    if (emp.length === 0) {
      throw new BadRequestException(`Employee ${employeeId} not found`);
    }
    let rep = await repo.findOne({ where: { employeeId } });
    if (!rep) rep = repo.create({ employeeId });
    rep.hq = dto.hq ?? rep.hq ?? null;
    rep.territory = dto.territory ?? rep.territory ?? null;
    rep.active = dto.active ?? rep.active ?? true;
    return repo.save(rep);
  }

  async assign(
    entityType: 'DOCTOR' | 'CUSTOMER',
    entityId: string,
    repEmployeeId: string,
  ): Promise<void> {
    const table = entityType === 'DOCTOR' ? Doctor : Customer;
    const repo = this.ds.getRepository(table);
    const row = await repo.findOne({ where: { id: entityId } });
    if (!row) {
      throw new NotFoundException(`${entityType} ${entityId} not found`);
    }
    await repo.update(entityId, {
      assignedRepEmployeeId: repEmployeeId,
    } as never);
  }

  async assignedCounts(repEmployeeId: string) {
    const [row] = await this.ds.query(
      `SELECT
         (SELECT COUNT(*) FROM doctors d
            WHERE d.assignedRepEmployeeId = ? AND d.deletedAt IS NULL) AS doctors,
         (SELECT COUNT(*) FROM customers c
            WHERE c.assignedRepEmployeeId = ? AND c.deletedAt IS NULL) AS chemists`,
      [repEmployeeId, repEmployeeId],
    );
    return { doctors: Number(row.doctors), chemists: Number(row.chemists) };
  }
}
