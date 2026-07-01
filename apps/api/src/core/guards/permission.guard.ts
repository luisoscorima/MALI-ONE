import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppPermission } from '@mali-one/shared';
import { userHasPermission } from '../permissions/app-permissions';
import { PERMISSIONS_KEY } from './permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as
      | Parameters<typeof userHasPermission>[0]
      | undefined;
    if (!user) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }

    const allowed = required.some((permission) =>
      userHasPermission(user, permission),
    );
    if (!allowed) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }

    return true;
  }
}
