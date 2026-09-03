import { UserRole } from '../enums/user-role.enum';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  /** The employee record this login is tied to, if any (self-service portal). */
  employeeId: string | null;
  /** The doctor record this login is tied to, if any (clinician view). */
  doctorId: string | null;
}
