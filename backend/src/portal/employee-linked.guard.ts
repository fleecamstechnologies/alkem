import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

/**
 * Guards the self-service portal: the caller must be a login that is linked to
 * an employee record. Runs after JwtAuthGuard.
 */
@Injectable()
export class EmployeeLinkedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user?.employeeId) {
      throw new ForbiddenException('This login is not linked to an employee');
    }
    return true;
  }
}
