import { UserRole } from '../enums/user-role.enum';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}
