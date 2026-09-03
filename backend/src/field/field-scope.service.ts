import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const PRIVILEGED: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SALES_MANAGER,
];

export interface RepScope {
  /** null => the caller may see every rep (privileged, no filter). */
  repEmployeeId: string | null;
  privileged: boolean;
}

@Injectable()
export class FieldScopeService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  isPrivileged(user: AuthenticatedUser): boolean {
    return PRIVILEGED.includes(user.role);
  }

  /**
   * Decide which rep(s) a request may touch.
   *  - privileged role: any `requested` id, or all when omitted.
   *  - linked employee: their own id, or a direct report's id, else forced self.
   *  - no link + not privileged: 403.
   */
  async resolve(
    user: AuthenticatedUser,
    requested?: string | number,
  ): Promise<RepScope> {
    if (this.isPrivileged(user)) {
      return {
        repEmployeeId: requested != null ? String(requested) : null,
        privileged: true,
      };
    }
    if (!user.employeeId) {
      throw new ForbiddenException('This login is not linked to an employee');
    }
    const self = user.employeeId;
    if (requested == null || String(requested) === self) {
      return { repEmployeeId: self, privileged: false };
    }
    // A manager may act for a direct report.
    const [row] = await this.ds.query(
      `SELECT reportingManagerId FROM employees WHERE id = ?`,
      [String(requested)],
    );
    if (row && String(row.reportingManagerId) === self) {
      return { repEmployeeId: String(requested), privileged: false };
    }
    throw new ForbiddenException('You can only act for yourself or your team');
  }

  /** May this caller approve/reject the given rep's tour plan? */
  async canManage(
    user: AuthenticatedUser,
    repEmployeeId: string,
  ): Promise<boolean> {
    if (this.isPrivileged(user)) return true;
    if (!user.employeeId) return false;
    const [row] = await this.ds.query(
      `SELECT reportingManagerId FROM employees WHERE id = ?`,
      [repEmployeeId],
    );
    return !!row && String(row.reportingManagerId) === user.employeeId;
  }

  /** For the dashboard: the set of rep ids a non-privileged caller may roll up. */
  async teamRepIds(user: AuthenticatedUser): Promise<string[]> {
    if (!user.employeeId) return [];
    const rows: Array<{ id: string }> = await this.ds.query(
      `SELECT id FROM employees WHERE reportingManagerId = ? AND deletedAt IS NULL`,
      [user.employeeId],
    );
    return [user.employeeId, ...rows.map((r) => r.id)];
  }
}
