import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user';

interface RequestWithUser {
  user?: AuthUser;
}

const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS ?? 'admin-address';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.address !== ADMIN_ADDRESS) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
