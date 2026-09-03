import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const DESK: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.RECEPTION];

@Injectable()
export class ClinicScopeService {
  /**
   * Which doctor's data a clinical list may show.
   *  - SUPER_ADMIN / RECEPTION: any `requested` id, or all (null).
   *  - CLINICIAN with `mine`: forced to their own linked doctor (403 if unlinked).
   *  - CLINICIAN without `mine`: may pass any doctorId (read-only cross-view).
   */
  resolveDoctor(
    user: AuthenticatedUser,
    requestedDoctorId?: string | number,
    mine?: string | boolean,
  ): string | null {
    const wantsMine = mine === '1' || mine === 'true' || mine === true;
    if (DESK.includes(user.role)) {
      return requestedDoctorId != null ? String(requestedDoctorId) : null;
    }
    // CLINICIAN
    if (wantsMine) {
      if (!user.doctorId) {
        throw new ForbiddenException('This login is not linked to a doctor');
      }
      return user.doctorId;
    }
    return requestedDoctorId != null ? String(requestedDoctorId) : null;
  }
}
